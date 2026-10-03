// Profil partagé (amis par code) : ce qui est publié, ce qui ne l'est pas, et la
// garantie qu'une liste privée ne quitte jamais l'appareil. Le service Firebase est
// simulé : ses règles de sécurité sont testées à part (npm run test:regles).
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/tmdb.js', () => ({
  getSeriesStructure: vi.fn(),
  getEpisodes: vi.fn(),
  getRecommendations: vi.fn(),
  getCardInfo: vi.fn(),
  getRuntime: vi.fn(),
}));
vi.mock('../src/firebase.js', () => ({
  isConfigured: () => true,
  publier: vi.fn(async () => {}),
  retirer: vi.fn(async () => {}),
  lire: vi.fn(),
}));

let store, db, partage, service, profil;

const film = (id, title) => ({ id, mediaType: 'movie', title, year: '2020' });
const serie = (id, title) => ({ id, mediaType: 'tv', title, year: '2019' });

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  db = await import('../src/db.js');
  store = await import('../src/store.js');
  partage = await import('../src/partage.js');
  service = await import('../src/firebase.js');
  vi.clearAllMocks();
  await db.initDb();
  [profil] = await store.listProfiles();

  await store.addToSuivi(profil.id, film(1, 'Vu 5 étoiles'));
  await store.setStatus(profil.id, 'movie', 1, 'vu');
  await store.setNote(profil.id, 'movie', 1, { note: 'AVIS SECRET', rating: 5 });
  await store.addToSuivi(profil.id, film(2, 'À voir'));
  await store.addToSuivi(profil.id, serie(3, 'Série abandonnée'));
  await store.setStatus(profil.id, 'tv', 3, 'abandonne');
});

const dernierEnvoi = () => service.publier.mock.calls.at(-1);

describe('codes', () => {
  it('le code ami fait 12 caractères sans ambiguïté, la clé 20', () => {
    for (let i = 0; i < 50; i++) {
      expect(partage.codeValide(partage.genererCode())).toBe(true);
      expect(partage.genererCle()).toMatch(/^[A-HJ-NP-Z2-9]{20}$/);
    }
  });
  it('se dicte et se retape : tirets, espaces et minuscules sont acceptés', () => {
    expect(partage.formater('K7F2M9QX3DTB')).toBe('K7F2-M9QX-3DTB');
    expect(partage.normaliser(' k7f2-m9qx 3dtb ')).toBe('K7F2M9QX3DTB');
  });
  it("l'empreinte est du SHA-256 en hexadécimal minuscule (ce que comparent les règles)", async () => {
    expect(await partage.empreinte('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });
});

describe('activation', () => {
  it("rien n'est envoyé tant que le partage n'est pas activé", async () => {
    expect(await partage.getPartage(profil.id)).toBeNull();
    await partage.publierSiActif(profil.id);
    expect(service.publier).not.toHaveBeenCalled();
  });

  it('active, envoie la fiche et garde code et clé en local', async () => {
    const { partage: p } = await partage.activer(profil.id, 'Léa');
    expect(p).toMatchObject({ actif: true, pseudo: 'Léa' });
    expect(partage.codeValide(p.code)).toBe(true);
    expect(p.cle).toHaveLength(20);

    const [code, cle, fiche] = dernierEnvoi();
    expect(code).toBe(p.code);
    expect(cle).toBe(p.cle);
    expect(fiche.cleHash).toBe(await partage.empreinte(p.cle));
    expect(fiche).toMatchObject({ v: 1, pseudo: 'Léa' });
  });

  it("si l'envoi échoue, la clé est gardée et le prochain essai reprend la même fiche", async () => {
    service.publier.mockRejectedValueOnce(new Error('Pas de connexion'));
    await expect(partage.activer(profil.id, 'Léa')).rejects.toThrow('Pas de connexion');
    const avant = await partage.getPartage(profil.id);
    expect(avant.actif).toBe(false);
    expect(avant.cle).toHaveLength(20);

    await partage.activer(profil.id, 'Léa');
    const apres = await partage.getPartage(profil.id);
    expect(apres).toMatchObject({ actif: true, code: avant.code, cle: avant.cle });
  });

  it('refuse un pseudo vide ou trop long', async () => {
    await expect(partage.activer(profil.id, '  ')).rejects.toThrow('pseudo');
    await expect(partage.activer(profil.id, 'x'.repeat(25))).rejects.toThrow('24');
  });
});

describe('ce qui est publié', () => {
  it("jamais d'avis écrit, jamais de date : des identifiants et des étoiles", async () => {
    await partage.activer(profil.id, 'Léa');
    const fiche = dernierEnvoi()[2];
    const texte = JSON.stringify(fiche);
    expect(texte).not.toContain('AVIS SECRET');
    expect(texte).not.toContain('2020');
    expect(Object.keys(fiche).sort()).toEqual(['avatar', 'cleHash', 'listes', 'pseudo', 'titres', 'v']);
    expect(fiche.titres).toContain('m1:5'); // film 1, 5 étoiles
    expect(fiche.titres).toContain('m2:0'); // pas noté
    expect(fiche.titres).toContain('t3:0');
  });

  it('les statuts sont des listes, les titres y pointent par leur position', async () => {
    await partage.activer(profil.id, 'Léa');
    const fiche = dernierEnvoi()[2];
    const vu = fiche.listes.find((l) => l.k === 's' && l.n === 'vu');
    expect(vu.ids.map((i) => fiche.titres[i])).toEqual(['m1:5']);
    expect(fiche.listes.map((l) => l.n)).toEqual(['a_voir', 'vu', 'abandonne']); // pas de liste vide
  });

  it('une liste privée ne quitte JAMAIS le téléphone : ni son nom, ni ses titres exclusifs', async () => {
    const secrete = await store.createListe(profil.id, 'Mes plaisirs coupables');
    const publique = await store.createListe(profil.id, 'Classiques');
    await store.addToListe(profil.id, secrete.id, film(10, 'Titre honteux'));
    await store.addToListe(profil.id, publique.id, film(11, 'Citizen Kane'));
    await store.addToListe(profil.id, secrete.id, film(2, 'À voir'));
    await store.setListePrive(profil.id, secrete.id, true);
    // Le film 10 est « à voir » (statut public) : on le passe au statut privé pour
    // qu'il ne reste QUE dans la liste privée.
    await store.setStatus(profil.id, 'movie', 10, 'abandonne');

    await partage.activer(profil.id, 'Léa');
    await partage.setStatutPrive(profil.id, 'abandonne', true);
    const fiche = dernierEnvoi()[2];
    const texte = JSON.stringify(fiche);
    expect(texte).not.toContain('plaisirs');
    expect(fiche.titres.some((t) => t.startsWith('m10:'))).toBe(false);
    expect(fiche.titres.some((t) => t.startsWith('m11:'))).toBe(true); // la liste publique est là
    expect(fiche.listes.some((l) => l.n === 'Classiques')).toBe(true);
  });

  it('un statut privé disparaît de la fiche, avec les titres qui ne sont que là', async () => {
    await partage.activer(profil.id, 'Léa');
    await partage.setStatutPrive(profil.id, 'abandonne', true);
    const fiche = dernierEnvoi()[2];
    expect(fiche.listes.some((l) => l.n === 'abandonne')).toBe(false);
    expect(fiche.titres).not.toContain('t3:0');
    expect(fiche.titres).toContain('m1:5');
  });

  it("passer une liste en privée la retire à la mise à jour suivante", async () => {
    const l = await store.createListe(profil.id, 'Visible');
    await store.addToListe(profil.id, l.id, film(30, 'Film de la liste'));
    await store.setStatus(profil.id, 'movie', 30, 'abandonne');
    await partage.activer(profil.id, 'Léa');
    await partage.setStatutPrive(profil.id, 'abandonne', true);
    expect(JSON.stringify(dernierEnvoi()[2])).toContain('Visible');

    await store.setListePrive(profil.id, l.id, true);
    await partage.publierSiActif(profil.id);
    expect(JSON.stringify(dernierEnvoi()[2])).not.toContain('Visible');
    expect(dernierEnvoi()[2].titres.some((t) => t.startsWith('m30:'))).toBe(false);
  });

  it("n'envoie rien si rien n'a changé, sauf si on force", async () => {
    await partage.activer(profil.id, 'Léa');
    service.publier.mockClear();
    expect((await partage.publierSiActif(profil.id)).envoye).toBe(false);
    expect(service.publier).not.toHaveBeenCalled();
    expect((await partage.publierSiActif(profil.id, { force: true })).envoye).toBe(true);
    await store.setNote(profil.id, 'movie', 1, { note: '', rating: 3 });
    service.publier.mockClear();
    expect((await partage.publierSiActif(profil.id)).envoye).toBe(true); // les étoiles ont changé
  });

  it('la mise à jour automatique ne lève jamais d’erreur', async () => {
    await partage.activer(profil.id, 'Léa');
    await store.setNote(profil.id, 'movie', 1, { note: '', rating: 2 });
    service.publier.mockRejectedValueOnce(new Error('hors ligne'));
    await expect(partage.publierAutomatique(profil.id)).resolves.toMatchObject({ envoye: false });
  });
});

describe('arrêt du partage', () => {
  it("retire la fiche du serveur, puis efface l'état local", async () => {
    const { partage: p } = await partage.activer(profil.id, 'Léa');
    await partage.desactiver(profil.id);
    expect(service.retirer).toHaveBeenCalledWith(p.code, p.cle);
    expect(await partage.getPartage(profil.id)).toBeNull();
  });
  it('hors ligne, on garde la clé : sinon la fiche en ligne serait orpheline', async () => {
    await partage.activer(profil.id, 'Léa');
    service.retirer.mockRejectedValueOnce(new Error('Pas de connexion'));
    await expect(partage.desactiver(profil.id)).rejects.toThrow('Pas de connexion');
    expect((await partage.getPartage(profil.id))?.actif).toBe(true);
  });
});

describe('sauvegarde', () => {
  it('la sauvegarde emporte code, clé et listes privées, et les rend sur un autre appareil', async () => {
    const l = await store.createListe(profil.id, 'Secrète');
    await store.setListePrive(profil.id, l.id, true);
    const { partage: p } = await partage.activer(profil.id, 'Léa');
    await partage.setStatutPrive(profil.id, 'abandonne', true);

    const backup = await import('../src/backup.js');
    const fichier = await backup.exportProfile(profil.id);
    expect(fichier.version).toBe(4);
    expect(fichier.partage).toMatchObject({ code: p.code, cle: p.cle, pseudo: 'Léa' });
    expect(fichier.listes[0].prive).toBe(1);

    const autreId = crypto.randomUUID();
    await backup.importProfile({ ...fichier, profile: { ...fichier.profile, id: autreId } });
    expect(await partage.getPartage(autreId)).toMatchObject({
      code: p.code,
      cle: p.cle,
      statutsPrives: ['abandonne'],
    });
    expect((await store.listListes(autreId))[0].prive).toBe(1);
  });

  it("une sauvegarde d'un profil jamais partagé ne contient pas de champ partage", async () => {
    const backup = await import('../src/backup.js');
    const fichier = await backup.exportProfile(profil.id);
    expect(fichier.partage).toBeUndefined();
  });

  it('supprimer un profil emporte sa ligne de partage', async () => {
    const autre = await store.createProfile('Autre');
    await partage.activer(autre.id, 'Bob');
    await store.deleteProfile(autre.id);
    expect(await partage.getPartage(autre.id)).toBeNull();
  });
});

describe('retrouver sa fiche (nouveau téléphone)', () => {
  const CODE = 'K7F2M9QX3DTB';
  const CLE = 'ABCDEFGHJKLMNPQRSTUV'; // 20 caractères valides

  it('avec le bon code de récupération, reprend la même fiche et la remplace', async () => {
    service.lire.mockResolvedValueOnce({ pseudo: 'Léa', cleHash: await partage.empreinte(CLE) });
    const { partage: p } = await partage.retrouver(profil.id, 'k7f2-m9qx-3dtb', 'abcd efgh-jklm nprs'.replace('nprs', 'NPQRSTUV').replace(/ /g, ''));
    expect(p).toMatchObject({ actif: true, code: CODE, cle: CLE, pseudo: 'Léa' });
    const [code, cle, fiche] = dernierEnvoi();
    expect([code, cle]).toEqual([CODE, CLE]);
    expect(fiche.cleHash).toBe(await partage.empreinte(CLE));
  });

  it('refuse une mauvaise clé sans rien écrire en local', async () => {
    service.lire.mockResolvedValueOnce({ pseudo: 'Léa', cleHash: await partage.empreinte('ZZZZZZZZZZZZZZZZZZZZ') });
    await expect(partage.retrouver(profil.id, CODE, CLE)).rejects.toThrow('ne correspond pas');
    expect(await partage.getPartage(profil.id)).toBeNull();
    expect(service.publier).not.toHaveBeenCalled();
  });

  it('refuse une fiche absente, des codes mal formés, et un partage déjà actif', async () => {
    service.lire.mockResolvedValueOnce(null);
    await expect(partage.retrouver(profil.id, CODE, CLE)).rejects.toThrow('Aucune fiche');
    await expect(partage.retrouver(profil.id, 'abc', CLE)).rejects.toThrow('code ami');
    await expect(partage.retrouver(profil.id, CODE, 'court')).rejects.toThrow('récupération');
    await partage.activer(profil.id, 'Léa');
    await expect(partage.retrouver(profil.id, CODE, CLE)).rejects.toThrow('déjà actif');
  });
});

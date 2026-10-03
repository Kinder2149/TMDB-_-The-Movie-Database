// Amis suivis par code : ajout, lecture (copie d'une heure, hors ligne), et surtout
// le nettoyage de ce qui vient d'un autre utilisateur. Le service Firebase est simulé.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/tmdb.js', () => ({
  getSeriesStructure: vi.fn(),
  getEpisodes: vi.fn(),
  getRecommendations: vi.fn(),
  getRuntime: vi.fn(),
  getCardInfo: vi.fn(async (mediaType, id) => ({ id, mediaType, title: `Titre ${id}` })),
}));
vi.mock('../src/photo.js', () => ({
  MAX_AVATAR: 4000,
  reduirePhoto: vi.fn(async () => ''),
}));
vi.mock('../src/firebase.js', () => ({
  isConfigured: () => true,
  publier: vi.fn(async () => {}),
  retirer: vi.fn(async () => {}),
  lire: vi.fn(),
}));

let store, db, amis, partage, service, tmdb, photo, profil;

const CODE = 'K7F2M9QX3DTB';
const fiche = (extra = {}) => ({
  v: 1,
  pseudo: 'Léa',
  avatar: 'bleu:film',
  maj: 1700000000000,
  titres: ['m603:5', 't1396:4', 'm10:0'],
  listes: [
    { k: 's', n: 'vu', ids: [0, 1] },
    { k: 'l', n: 'Classiques', ids: [0, 2] },
  ],
  ...extra,
});

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  db = await import('../src/db.js');
  store = await import('../src/store.js');
  amis = await import('../src/amis.js');
  partage = await import('../src/partage.js');
  service = await import('../src/firebase.js');
  photo = await import('../src/photo.js');
  tmdb = await import('../src/tmdb.js');
  vi.clearAllMocks();
  await db.initDb();
  [profil] = await store.listProfiles();
  service.lire.mockResolvedValue(fiche());
});

describe('décodage', () => {
  it('rend des listes de titres avec les étoiles de l’ami', () => {
    const f = amis.decoder(fiche());
    expect(f.pseudo).toBe('Léa');
    expect(f.nbTitres).toBe(3);
    expect(f.listes[0]).toMatchObject({ kind: 'statut', nom: 'vu' });
    expect(f.listes[0].items).toEqual([
      { mediaType: 'movie', id: 603, rating: 5 },
      { mediaType: 'tv', id: 1396, rating: 4 },
    ]);
    expect(f.listes[1].items[1]).toEqual({ mediaType: 'movie', id: 10, rating: null }); // 0 = pas noté
  });

  it('une fiche hostile ou abîmée ne casse rien et rien d’étranger n’en sort', () => {
    const f = amis.decoder({
      pseudo: 'x'.repeat(500),
      avatar: 'y'.repeat(500),
      maj: 'demain',
      titres: ['m1:5', '<script>alert(1)</script>', 'm99999999999:3', 'x12:2', 42, null, 'm7:9'],
      listes: [{ k: 'l', n: 'z'.repeat(500), ids: [0, 1, 2, 99, -1, 'a'] }, null, 'oups'],
    });
    expect(f.pseudo).toHaveLength(24);
    expect(f.avatar).toBe(''); // ni « couleur:symbole » ni miniature : ignoré
    expect(f.maj).toBeNull();
    expect(f.nbTitres).toBe(1); // seul « m1:5 » est valide
    expect(f.listes[0].nom).toHaveLength(60);
    expect(f.listes[0].items).toEqual([{ mediaType: 'movie', id: 1, rating: 5 }]);
    expect(f.listes).toHaveLength(3); // les entrées bizarres deviennent des listes vides, pas des erreurs
  });

  it('un contenu totalement vide donne une fiche vide plutôt qu’une erreur', () => {
    expect(amis.decoder(null)).toMatchObject({ pseudo: 'Ami', listes: [], nbTitres: 0 });
    expect(amis.decoder({ titres: 'non', listes: 7 })).toMatchObject({ listes: [], nbTitres: 0 });
  });
});

describe('ajouter un ami', () => {
  it('accepte le code tel qu’on le tape (minuscules, tirets, espaces)', async () => {
    const ami = await amis.ajouterAmi(profil.id, ' k7f2-m9qx 3dtb ');
    expect(ami).toMatchObject({ code: CODE, pseudo: 'Léa' });
    expect(service.lire).toHaveBeenCalledWith(CODE);
    expect(await amis.listerAmis(profil.id)).toHaveLength(1);
  });

  it('refuse un code mal formé sans interroger le serveur', async () => {
    for (const mauvais of ['', 'abc', 'K7F2M9QX3DT0', 'K7F2M9QX3DTBX']) {
      await expect(amis.ajouterAmi(profil.id, mauvais)).rejects.toThrow('pas valide');
    }
    expect(service.lire).not.toHaveBeenCalled();
  });

  it('dit clairement quand aucune fiche ne correspond', async () => {
    service.lire.mockResolvedValueOnce(null);
    await expect(amis.ajouterAmi(profil.id, CODE)).rejects.toThrow('Aucune fiche');
    expect(await amis.listerAmis(profil.id)).toHaveLength(0);
  });

  it('refuse un doublon et son propre code', async () => {
    await amis.ajouterAmi(profil.id, CODE);
    await expect(amis.ajouterAmi(profil.id, CODE)).rejects.toThrow('déjà');

    await partage.activer(profil.id, 'Moi');
    const mien = (await partage.getPartage(profil.id)).code;
    await expect(amis.ajouterAmi(profil.id, mien)).rejects.toThrow('propres profils');
  });

  it('plafonne à 100 amis', async () => {
    for (let i = 0; i < amis.MAX_AMIS; i++) {
      const code = partage.genererCode();
      await db.run(
        'INSERT INTO amis (profile_id, code, pseudo) VALUES (?, ?, ?)',
        [profil.id, code, `Ami ${i}`]
      );
    }
    await expect(amis.ajouterAmi(profil.id, CODE)).rejects.toThrow('100');
  });

  it('chaque profil a ses propres amis', async () => {
    const autre = await store.createProfile('Autre');
    await amis.ajouterAmi(profil.id, CODE);
    expect(await amis.listerAmis(autre.id)).toHaveLength(0);
  });
});

describe('ouvrir la fiche d’un ami', () => {
  beforeEach(async () => {
    await amis.ajouterAmi(profil.id, CODE);
    service.lire.mockClear();
  });

  it('utilise la copie du téléphone pendant une heure, sans toucher au serveur', async () => {
    const f = await amis.ouvrirAmi(profil.id, CODE);
    expect(f.pseudo).toBe('Léa');
    expect(service.lire).not.toHaveBeenCalled();
  });

  it('relit le serveur quand la copie a plus d’une heure, ou sur demande', async () => {
    await db.run('UPDATE amis SET lu = ? WHERE code = ?', [Math.floor((Date.now() - amis.DELAI_CACHE) / 1000) - 5, CODE]);
    service.lire.mockResolvedValueOnce(fiche({ pseudo: 'Léa 2' }));
    expect((await amis.ouvrirAmi(profil.id, CODE)).pseudo).toBe('Léa 2');
    expect(service.lire).toHaveBeenCalledTimes(1);

    service.lire.mockResolvedValueOnce(fiche({ pseudo: 'Léa 3' }));
    expect((await amis.ouvrirAmi(profil.id, CODE, { force: true })).pseudo).toBe('Léa 3');
    // et le pseudo de la liste suit
    expect((await amis.listerAmis(profil.id))[0].pseudo).toBe('Léa 3');
  });

  it('hors connexion, garde la copie plutôt que rien', async () => {
    await db.run('UPDATE amis SET lu = 0 WHERE code = ?', [CODE]);
    service.lire.mockRejectedValueOnce(new Error('Pas de connexion'));
    const f = await amis.ouvrirAmi(profil.id, CODE);
    expect(f).toMatchObject({ pseudo: 'Léa', horsLigne: true });
  });

  it('une fiche supprimée est signalée sans effacer l’ami', async () => {
    await db.run('UPDATE amis SET lu = 0 WHERE code = ?', [CODE]);
    service.lire.mockResolvedValueOnce(null);
    expect(await amis.ouvrirAmi(profil.id, CODE)).toMatchObject({ disparu: true, pseudo: 'Léa' });
    const [ligne] = await amis.listerAmis(profil.id);
    expect(ligne.disparu).toBe(1);
    // elle réapparaît : l’ami est de nouveau lisible
    service.lire.mockResolvedValueOnce(fiche());
    expect((await amis.ouvrirAmi(profil.id, CODE, { force: true })).disparu).toBeUndefined();
  });

  it('retirer un ami l’oublie', async () => {
    await amis.retirerAmi(profil.id, CODE);
    expect(await amis.listerAmis(profil.id)).toHaveLength(0);
    await expect(amis.ouvrirAmi(profil.id, CODE)).rejects.toThrow('plus dans ta liste');
  });
});

describe('affiches', () => {
  it('charge titres et affiches depuis TMDB, garde les étoiles de l’ami, et mémorise', async () => {
    const items = [
      { mediaType: 'movie', id: 603, rating: 5 },
      { mediaType: 'tv', id: 1396, rating: null },
    ];
    const cartes = await amis.chargerCartes(items);
    expect(cartes.map((c) => [c.title, c.rating])).toEqual([['Titre 603', 5], ['Titre 1396', null]]);
    await amis.chargerCartes(items);
    expect(tmdb.getCardInfo).toHaveBeenCalledTimes(2); // pas redemandé
  });

  it('un titre que TMDB ne connaît plus est simplement absent', async () => {
    tmdb.getCardInfo.mockRejectedValueOnce(new Error('404'));
    const cartes = await amis.chargerCartes([
      { mediaType: 'movie', id: 1, rating: 1 },
      { mediaType: 'movie', id: 2, rating: 2 },
    ]);
    expect(cartes.map((c) => c.id)).toEqual([2]);
  });
});

describe('sauvegarde et suppression de profil', () => {
  it('les amis suivent la sauvegarde (code, pseudo, avatar), pas la copie de leur fiche', async () => {
    await amis.ajouterAmi(profil.id, CODE);
    const backup = await import('../src/backup.js');
    const fichier = await backup.exportProfile(profil.id);
    expect(fichier.amis).toEqual([
      expect.objectContaining({ code: CODE, pseudo: 'Léa', avatar: 'bleu:film' }),
    ]);
    expect(JSON.stringify(fichier.amis)).not.toContain('titres');

    const autreId = crypto.randomUUID();
    await backup.importProfile({ ...fichier, profile: { ...fichier.profile, id: autreId } });
    expect(await amis.listerAmis(autreId)).toHaveLength(1);
    // pas de copie : le premier affichage sur ce nouvel appareil relit le serveur
    service.lire.mockClear();
    await amis.ouvrirAmi(autreId, CODE);
    expect(service.lire).toHaveBeenCalledTimes(1);
  });

  it('supprimer un profil emporte ses amis', async () => {
    const autre = await store.createProfile('Autre');
    await amis.ajouterAmi(autre.id, CODE);
    await store.deleteProfile(autre.id);
    expect(await amis.listerAmis(autre.id)).toHaveLength(0);
  });

  it('un avatar en photo part sous forme de miniature, jamais en taille réelle', async () => {
    const mini = `data:image/jpeg;base64,${'A'.repeat(1500)}`;
    photo.reduirePhoto.mockResolvedValueOnce(mini);
    await store.setProfileAvatar(profil.id, `data:image/png;base64,${'A'.repeat(50000)}`);
    await partage.activer(profil.id, 'Moi');
    expect(service.publier.mock.calls.at(-1)[2].avatar).toBe(mini);
  });

  it('si la miniature est impossible ou trop lourde, rien ne part (l’ami voit l’initiale)', async () => {
    photo.reduirePhoto.mockResolvedValueOnce('');
    await store.setProfileAvatar(profil.id, `data:image/png;base64,${'A'.repeat(500)}`);
    await partage.activer(profil.id, 'Moi');
    expect(service.publier.mock.calls.at(-1)[2].avatar).toBe('');

    photo.reduirePhoto.mockResolvedValueOnce(`data:image/jpeg;base64,${'A'.repeat(5000)}`);
    await partage.publierSiActif(profil.id, { force: true });
    expect(service.publier.mock.calls.at(-1)[2].avatar).toBe('');
  });

  it('on n’affiche d’un ami que des avatars sûrs', () => {
    const mini = `data:image/jpeg;base64,${'QUJD'.repeat(100)}`;
    expect(amis.avatarSur('bleu:film')).toBe('bleu:film');
    expect(amis.avatarSur(mini)).toBe(mini);
    expect(amis.avatarSur('data:image/svg+xml;base64,PHN2Zz4=')).toBe('');
    expect(amis.avatarSur('javascript:alert(1)')).toBe('');
    expect(amis.avatarSur(`data:image/jpeg;base64,${'A'.repeat(5000)}`)).toBe('');
    expect(amis.avatarSur(42)).toBe('');
  });
});

describe('« Chez tes amis »', () => {
  const CODE2 = 'M2N3P4Q5R6S7';
  const ajouter = async (code, f) => {
    service.lire.mockResolvedValueOnce(f);
    await amis.ajouterAmi(profil.id, code);
  };

  it('classe d’abord ce que plusieurs amis ont aimé, puis par leurs notes', async () => {
    await ajouter(CODE, fiche({ pseudo: 'Léa', titres: ['m1:5', 'm2:4', 'm3:2'], listes: [{ k: 'l', n: 'x', ids: [0, 1, 2] }] }));
    await ajouter(CODE2, fiche({ pseudo: 'Max', titres: ['m2:5', 'm4:4'], listes: [{ k: 'l', n: 'y', ids: [0, 1] }] }));
    const reco = await amis.recommandationsAmis(profil.id);
    expect(reco.map((r) => r.id)).toEqual([2, 1, 4]); // 2 : aimé par deux amis ; 3 (2 étoiles) écarté
    expect(reco[0].amis).toEqual([
      { pseudo: 'Léa', rating: 4 },
      { pseudo: 'Max', rating: 5 },
    ]);
  });

  it('un titre vu sans note compte comme une approbation tiède, sans étoiles affichées', async () => {
    await ajouter(CODE, fiche({ pseudo: 'Léa', titres: ['m9:0'], listes: [{ k: 's', n: 'vu', ids: [0] }] }));
    const reco = await amis.recommandationsAmis(profil.id);
    expect(reco).toEqual([{ mediaType: 'movie', id: 9, amis: [{ pseudo: 'Léa', rating: null }] }]);
  });

  it('un titre « à voir » ou « abandonné » d’un ami n’est jamais recommandé', async () => {
    await ajouter(CODE, fiche({ titres: ['m5:0', 'm6:0'], listes: [{ k: 's', n: 'a_voir', ids: [0] }, { k: 's', n: 'abandonne', ids: [1] }] }));
    expect(await amis.recommandationsAmis(profil.id)).toEqual([]);
  });

  it('un ami injoignable est ignoré, les autres comptent', async () => {
    await ajouter(CODE, fiche({ titres: ['m1:5'], listes: [{ k: 'l', n: 'x', ids: [0] }] }));
    await ajouter(CODE2, fiche({ titres: ['m2:5'], listes: [{ k: 'l', n: 'y', ids: [0] }] }));
    await db.run('UPDATE amis SET lu = 0, fiche = NULL WHERE code = ?', [CODE]); // plus de copie
    service.lire.mockImplementation(async (c) => {
      if (c === CODE) throw new Error('hors ligne');
      return fiche({ titres: ['m2:5'], listes: [{ k: 'l', n: 'y', ids: [0] }] });
    });
    await db.run('UPDATE amis SET lu = 0 WHERE code = ?', [CODE2]);
    const reco = await amis.recommandationsAmis(profil.id);
    expect(reco.map((r) => r.id)).toEqual([2]);
  });

  it('sans ami, rien', async () => {
    expect(await amis.recommandationsAmis(profil.id)).toEqual([]);
  });
});

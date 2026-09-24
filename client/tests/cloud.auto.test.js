// Sauvegarde automatique : ce qui part tout seul, et surtout ce qui ne part pas.
//
// Fichier séparé de `cloud.test.js` parce qu'il remplace **une seule** fonction
// de Google — celle qui délivre l'autorisation. Tout le reste est le vrai code :
// l'export du profil, la construction de l'envoi, l'écriture dans le Drive.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/tmdb.js', () => ({
  getSeasons: vi.fn().mockResolvedValue([]),
  getSeriesStructure: vi.fn().mockResolvedValue({ seasons: [], lastAired: null }),
  getEpisodes: vi.fn().mockResolvedValue([]),
  getRecommendations: vi.fn().mockResolvedValue([]),
  getCardInfo: vi.fn(),
  getRuntime: vi.fn(),
}));

// L'autorisation est le seul point remplacé : `null` = Google ne la donne pas
// sans écran, et la sauvegarde automatique doit alors renoncer en silence.
const autorisation = vi.fn();
vi.mock('../src/google.js', async (importOriginal) => {
  const vrai = await importOriginal();
  return { ...vrai, getAccessToken: (...args) => autorisation(...args) };
});

const COMPTE = { userId: '1', email: 'kinder@example.com', displayName: 'Kinder' };

let db, store, backup, envois, profil;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  autorisation.mockReset();
  envois = [];

  globalThis.fetch = vi.fn(async (url, options = {}) => {
    const adresse = String(url);
    if (adresse.includes('/upload/drive/v3/files')) {
      envois.push(adresse);
      return { ok: true, status: 200, json: async () => ({ id: `id-${envois.length}` }) };
    }
    return { ok: true, status: 200, json: async () => ({ files: [] }) };
  });

  db = await import('../src/db.js');
  store = await import('../src/store.js');
  backup = await import('../src/backup.js');
  await db.initDb();
  [profil] = await store.listProfiles();

  localStorage.setItem('google-account', JSON.stringify(COMPTE));
});

afterEach(() => {
  delete globalThis.fetch;
});

describe('sauvegarde automatique', () => {
  it('ne part pas quand il n’y a rien de nouveau', async () => {
    const resultat = await backup.sauvegardeAutomatique();
    expect(resultat).toEqual({ fait: false, raison: 'rien-a-sauvegarder' });
    expect(autorisation).not.toHaveBeenCalled();
    expect(envois).toHaveLength(0);
  });

  it('envoie le suivi et éteint le rappel quand tout va bien', async () => {
    autorisation.mockResolvedValue('jeton-valide');
    await store.addToSuivi(profil.id, { id: 1, mediaType: 'movie', title: 'Un film' });
    backup.markChanged();
    expect(backup.hasPendingChanges()).toBe(true);

    const resultat = await backup.sauvegardeAutomatique();
    expect(resultat).toMatchObject({ fait: true, profils: 1 });
    expect(envois).toHaveLength(1);
    expect(backup.hasPendingChanges()).toBe(false);
    expect(backup.lastCloudBackup()).toBeInstanceOf(Date);
  });

  it('ne demande jamais d’écran à Google', async () => {
    autorisation.mockResolvedValue('jeton-valide');
    backup.markChanged();
    await backup.sauvegardeAutomatique();
    // C'est toute la différence avec le bouton « Sauvegarder maintenant » :
    // ici, on n'a pas le droit d'interrompre l'utilisateur.
    expect(autorisation).toHaveBeenCalledWith({ interactive: false });
  });

  it('renonce en silence quand l’autorisation n’est pas disponible', async () => {
    autorisation.mockResolvedValue(null);
    backup.markChanged();

    const resultat = await backup.sauvegardeAutomatique();
    expect(resultat).toEqual({ fait: false, raison: 'autorisation-indisponible' });
    expect(envois).toHaveLength(0);
    // Le rappel reste levé : le bandeau reviendra, l'échec ne passe pas inaperçu.
    expect(backup.hasPendingChanges()).toBe(true);
  });

  it('garde le rappel levé quand l’envoi échoue en route', async () => {
    autorisation.mockResolvedValue('jeton-valide');
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 503,
      text: async () => 'Drive indisponible',
    }));
    backup.markChanged();

    const resultat = await backup.sauvegardeAutomatique();
    expect(resultat.fait).toBe(false);
    expect(resultat.raison).toBe('echec');
    expect(backup.hasPendingChanges()).toBe(true);
    expect(backup.lastCloudBackup()).toBeNull();
  });

  it('ne lance pas deux envois en même temps', async () => {
    autorisation.mockResolvedValue('jeton-valide');
    backup.markChanged();

    // Quitter puis revenir très vite déclenche deux fois de suite : le second
    // appel doit se ranger, pas doubler l'envoi.
    const [premier, second] = await Promise.all([
      backup.sauvegardeAutomatique(),
      backup.sauvegardeAutomatique(),
    ]);
    const resultats = [premier, second];
    expect(resultats.filter((r) => r.fait)).toHaveLength(1);
    expect(resultats.some((r) => r.raison === 'deja-en-cours')).toBe(true);
    expect(envois).toHaveLength(1);
  });

  it('prévient l’écran dès qu’il y a du nouveau, et quand c’est envoyé', async () => {
    autorisation.mockResolvedValue('jeton-valide');
    const vus = [];
    const stop = backup.surChangementDeSauvegarde((enAttente) => vus.push(enAttente));

    backup.markChanged();
    await backup.sauvegardeAutomatique();
    stop();
    backup.markChanged(); // après désabonnement : plus rien ne doit arriver

    // Sans cet avertissement, le bandeau n'apparaissait qu'au lancement
    // suivant : on pouvait cocher dix épisodes sans être prévenu.
    expect(vus).toEqual([true, false]);
  });

  it('garde la trace de la dernière tentative, réussie ou non', async () => {
    autorisation.mockResolvedValue(null);
    backup.markChanged();
    await backup.sauvegardeAutomatique();

    let essai = backup.dernierEssaiAutomatique();
    expect(essai).toMatchObject({ fait: false, raison: 'autorisation-indisponible' });
    expect(essai.quand).toBeTruthy();

    autorisation.mockResolvedValue('jeton-valide');
    await backup.sauvegardeAutomatique();
    essai = backup.dernierEssaiAutomatique();
    expect(essai).toMatchObject({ fait: true, profils: 1 });
  });

  it('est activée par défaut dès qu’un compte est relié', () => {
    // On range le refus, pas l'accord : une installation neuve part protégée.
    expect(backup.sauvegardeAutoActive()).toBe(true);
  });

  it('ne part plus une fois l’interrupteur coupé, et repart quand on le remet', async () => {
    autorisation.mockResolvedValue('jeton-valide');
    backup.markChanged();

    backup.reglerSauvegardeAuto(false);
    let resultat = await backup.sauvegardeAutomatique();
    expect(resultat).toEqual({ fait: false, raison: 'desactivee' });
    expect(envois).toHaveLength(0);
    expect(autorisation).not.toHaveBeenCalled();
    // Le drapeau reste levé : le bouton manuel reste la porte de sortie.
    expect(backup.hasPendingChanges()).toBe(true);

    backup.reglerSauvegardeAuto(true);
    resultat = await backup.sauvegardeAutomatique();
    expect(resultat).toMatchObject({ fait: true });
    expect(envois).toHaveLength(1);
  });

  it('la déconnexion remet l’interrupteur à son état d’origine', () => {
    backup.reglerSauvegardeAuto(false);
    backup.forgetCloudState();
    expect(backup.sauvegardeAutoActive()).toBe(true);
  });

  it('ne réclame rien tant qu’aucun compte Google n’est relié', async () => {
    localStorage.removeItem('google-account');
    backup.markChanged(); // sans compte, ne lève même pas le drapeau

    const resultat = await backup.sauvegardeAutomatique();
    expect(resultat).toEqual({ fait: false, raison: 'rien-a-sauvegarder' });
    expect(autorisation).not.toHaveBeenCalled();
  });

  it('garde le rappel levé si on modifie quelque chose pendant l’envoi', async () => {
    autorisation.mockResolvedValue('jeton-valide');
    backup.markChanged();
    // Un changement survient pendant que l'envoi est en route.
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).includes('/upload/drive/v3/files')) {
        backup.markChanged();
        return { ok: true, status: 200, json: async () => ({ id: 'id-1' }) };
      }
      return { ok: true, status: 200, json: async () => ({ files: [] }) };
    });

    const resultat = await backup.sauvegardeAutomatique();
    expect(resultat).toMatchObject({ fait: true });
    // Cette modification n'est pas partie : elle ne doit pas être déclarée sauvegardée.
    expect(backup.hasPendingChanges()).toBe(true);
  });
});

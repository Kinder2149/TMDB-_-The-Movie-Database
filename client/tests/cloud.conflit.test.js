// Deux appareils, un seul Drive : la sauvegarde ne doit jamais écraser ce
// qu'un autre appareil a écrit depuis la dernière fois.
//
// Un faux Drive en mémoire remplace le réseau ; « l'autre appareil » écrit
// dedans directement. Tout le reste est le vrai code.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/tmdb.js', () => ({
  getSeasons: vi.fn().mockResolvedValue([]),
  getSeriesStructure: vi.fn().mockResolvedValue({ seasons: [], lastAired: null }),
  getEpisodes: vi.fn().mockResolvedValue([]),
  getRecommendations: vi.fn().mockResolvedValue([]),
  getCardInfo: vi.fn(),
  getRuntime: vi.fn(),
}));

const autorisation = vi.fn();
vi.mock('../src/google.js', async (importOriginal) => {
  const vrai = await importOriginal();
  return { ...vrai, getAccessToken: (...args) => autorisation(...args) };
});

const COMPTE = { userId: '1', email: 'kinder@example.com', displayName: 'Kinder' };

let db, store, backup, drive, horloge, profil;

// Faux Drive : chaque écriture donne une nouvelle date de modification.
function fauxDrive() {
  drive = { files: [] };
  horloge = 0;
  const date = () => new Date(Date.UTC(2026, 8, 1, 0, 0, ++horloge)).toISOString();

  // Ce que ferait un autre appareil : écrire le fichier d'un profil.
  drive.ecrireAilleurs = (profileId, contenu) => {
    const nom = `profil-${profileId}.json`;
    const f = drive.files.find((x) => x.name === nom);
    if (f) Object.assign(f, { contents: contenu, modifiedTime: date() });
    else
      drive.files.push({
        id: `f${drive.files.length + 1}`,
        name: nom,
        contents: contenu,
        modifiedTime: date(),
        appProperties: { profileId, profileName: 'Mon profil' },
      });
  };

  globalThis.fetch = vi.fn(async (url, options = {}) => {
    const adresse = String(url);
    if (adresse.includes('/upload/drive/v3/files')) {
      const parties = String(options.body).split('\r\n\r\n');
      const nom = JSON.parse(parties[1].split('\r\n--')[0]).name;
      const contenu = parties[2].split('\r\n--')[0];
      const id = adresse.match(/files\/([^?]+)\?/)?.[1];
      let f = id ? drive.files.find((x) => x.id === id) : null;
      if (f) Object.assign(f, { contents: contenu, modifiedTime: date() });
      else {
        f = {
          id: `f${drive.files.length + 1}`,
          name: nom,
          contents: contenu,
          modifiedTime: date(),
          appProperties: {},
        };
        drive.files.push(f);
      }
      return { ok: true, status: 200, json: async () => ({ id: f.id, modifiedTime: f.modifiedTime }) };
    }
    if (adresse.includes('alt=media')) {
      const id = adresse.match(/files\/([^?]+)\?/)[1];
      const f = drive.files.find((x) => x.id === id);
      return { ok: true, status: 200, json: async () => JSON.parse(f.contents) };
    }
    return { ok: true, status: 200, json: async () => ({ files: drive.files }) };
  });
}

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  autorisation.mockReset();
  autorisation.mockResolvedValue('jeton');
  fauxDrive();

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

describe('deux appareils sur le même Drive', () => {
  it('un premier envoi, puis un second, passent sans conflit', async () => {
    await backup.backupToDrive('jeton');
    await store.addToSuivi(profil.id, { id: 1, mediaType: 'movie', title: 'Un film' });
    await backup.backupToDrive('jeton');
    expect(drive.files).toHaveLength(1);
    expect(drive.files[0].contents).toContain('Un film');
  });

  it('un autre appareil a écrit : rien n’est écrasé', async () => {
    await backup.backupToDrive('jeton');
    drive.ecrireAilleurs(profil.id, drive.files[0].contents.replace('Mon profil', 'Écrit ailleurs'));
    const avant = drive.files[0].contents;

    await store.addToSuivi(profil.id, { id: 2, mediaType: 'movie', title: 'Ici' });
    await expect(backup.backupToDrive('jeton')).rejects.toBeInstanceOf(backup.ConflitSauvegarde);
    expect(drive.files[0].contents).toBe(avant);
  });

  it('un conflit n’écrit aucun des profils, même ceux qui n’en ont pas', async () => {
    await store.createProfile('Marie');
    await backup.backupToDrive('jeton');
    const [premier] = drive.files;
    drive.ecrireAilleurs(premier.name.slice(7, -5), premier.contents);
    const avant = drive.files.map((f) => f.contents);

    await expect(backup.backupToDrive('jeton')).rejects.toBeInstanceOf(backup.ConflitSauvegarde);
    expect(drive.files.map((f) => f.contents)).toEqual(avant);
  });

  it('la sauvegarde automatique renonce, garde le rappel et n’écrase rien', async () => {
    await backup.backupToDrive('jeton');
    drive.ecrireAilleurs(profil.id, drive.files[0].contents);
    const avant = drive.files[0].contents;
    backup.markChanged();

    const resultat = await backup.sauvegardeAutomatique();
    expect(resultat).toMatchObject({ fait: false, raison: 'conflit' });
    expect(backup.hasPendingChanges()).toBe(true);
    expect(drive.files[0].contents).toBe(avant);
  });

  it('« garder ce téléphone » écrase, puis le suivant repart normalement', async () => {
    await backup.backupToDrive('jeton');
    drive.ecrireAilleurs(profil.id, drive.files[0].contents);
    await store.addToSuivi(profil.id, { id: 3, mediaType: 'movie', title: 'Mon choix' });

    await backup.backupToDrive('jeton', { ecraser: true });
    expect(drive.files[0].contents).toContain('Mon choix');
    await expect(backup.backupToDrive('jeton')).resolves.toMatchObject({ profils: 1 });
  });

  it('« reprendre le Drive » remplace le téléphone, sans conflit ensuite', async () => {
    await backup.backupToDrive('jeton');
    const donnees = JSON.parse(drive.files[0].contents);
    donnees.suivi = [{ tmdbId: 9, mediaType: 'movie', title: 'Venu du Drive', status: 'a_voir' }];
    drive.ecrireAilleurs(profil.id, JSON.stringify(donnees));

    let conflit;
    try {
      await backup.backupToDrive('jeton');
    } catch (e) {
      conflit = e;
    }
    await backup.restoreFromDrive('jeton', conflit.conflits);
    const local = await backup.exportProfile(profil.id);
    expect(local.suivi.map((s) => s.title)).toEqual(['Venu du Drive']);
    await expect(backup.backupToDrive('jeton')).resolves.toMatchObject({ profils: 1 });
  });

  it('un appareil qui avait déjà sauvegardé avant les versions adopte celle du Drive', async () => {
    await backup.backupToDrive('jeton');
    localStorage.removeItem('cloud-versions'); // état d'avant cette mise à jour
    await expect(backup.backupToDrive('jeton')).resolves.toMatchObject({ profils: 1 });
  });

  it('un appareil neuf qui n’a jamais vu ce fichier ne l’écrase pas', async () => {
    await backup.backupToDrive('jeton');
    localStorage.removeItem('cloud-versions');
    localStorage.removeItem('cloud-last-backup'); // réinstallation, restauration refusée
    await expect(backup.backupToDrive('jeton')).rejects.toBeInstanceOf(backup.ConflitSauvegarde);
  });
});

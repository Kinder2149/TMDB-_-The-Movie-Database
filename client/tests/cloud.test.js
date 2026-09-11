// Sauvegarde cloud dans le Drive de l'utilisateur.
//
// C'est la partie la plus récente et la plus exposée : elle écrit chez
// l'utilisateur, à travers un service qu'on ne maîtrise pas. Google est ici
// remplacé par un Drive de test — on vérifie ce que l'application *lui
// demande* (créer ou remplacer, quel fichier, quel dossier) et ce qu'elle fait
// de ses réponses, y compris de ses refus.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('../src/tmdb.js', () => ({
  getSeasons: vi.fn().mockResolvedValue([]),
  getSeriesStructure: vi.fn().mockResolvedValue({ seasons: [], lastAired: null }),
  getEpisodes: vi.fn().mockResolvedValue([]),
  getRecommendations: vi.fn().mockResolvedValue([]),
  getCardInfo: vi.fn(),
}));

const COMPTE = { userId: '1', email: 'kinder@example.com', displayName: 'Kinder' };
const JETON = 'jeton-de-test';

// --- Drive de test -----------------------------------------------------
// Retient ce qui a été envoyé, et sait rejouer les refus de Google.
function creerFauxDrive() {
  const drive = {
    fichiers: [], // { id, name, appProperties, contenu, modifiedTime }
    appels: [],
    refus: null, // { status, body }
  };

  drive.fetch = vi.fn(async (url, options = {}) => {
    const adresse = String(url);
    drive.appels.push({ url: adresse, method: options.method || 'GET', body: options.body,
      headers: options.headers || {} });

    if (drive.refus) {
      const { status, body } = drive.refus;
      return { ok: false, status, text: async () => body };
    }

    // Téléchargement d'un fichier
    const media = adresse.match(/files\/([^?]+)\?alt=media/);
    if (media) {
      const fichier = drive.fichiers.find((f) => f.id === media[1]);
      return { ok: true, status: 200, json: async () => JSON.parse(fichier.contenu) };
    }

    // Envoi (création ou remplacement)
    if (adresse.includes('/upload/drive/v3/files')) {
      const limite = options.headers['Content-Type'].split('boundary=')[1];
      const parties = String(options.body).split(`--${limite}`);
      const metadata = JSON.parse(parties[1].split('\r\n\r\n')[1].trim());
      const contenu = parties[2].split('\r\n\r\n')[1].trim();
      const idExistant = adresse.match(/files\/([^?]+)\?uploadType/)?.[1];

      if (idExistant) {
        const fichier = drive.fichiers.find((f) => f.id === idExistant);
        Object.assign(fichier, { ...metadata, contenu, modifiedTime: '2026-08-23T10:00:00Z' });
        return { ok: true, status: 200, json: async () => ({ id: fichier.id }) };
      }
      const nouveau = {
        id: `id-${drive.fichiers.length + 1}`,
        ...metadata,
        contenu,
        modifiedTime: '2026-08-23T10:00:00Z',
      };
      drive.fichiers.push(nouveau);
      return { ok: true, status: 200, json: async () => ({ id: nouveau.id }) };
    }

    // Suppression d'un fichier
    if (options.method === 'DELETE') {
      const id = adresse.match(/files\/([^?]+)$/)[1];
      drive.fichiers = drive.fichiers.filter((f) => f.id !== id);
      return { ok: true, status: 204 };
    }

    // Liste du dossier caché
    return {
      ok: true,
      status: 200,
      json: async () => ({
        files: drive.fichiers.map(({ id, name, modifiedTime, appProperties }) => ({
          id,
          name,
          modifiedTime,
          appProperties,
        })),
      }),
    };
  });

  return drive;
}

let db, store, backup, google, drive, profil;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  drive = creerFauxDrive();
  globalThis.fetch = drive.fetch;
  db = await import('../src/db.js');
  store = await import('../src/store.js');
  backup = await import('../src/backup.js');
  google = await import('../src/google.js');
  await db.initDb();
  [profil] = await store.listProfiles();
});

afterEach(() => {
  delete globalThis.fetch;
});

describe('accès au Drive', () => {
  it('ne regarde que le dossier caché réservé à l’application', async () => {
    await google.listDriveFiles(JETON);
    const { url, headers } = drive.appels[0];
    expect(url).toContain('spaces=appDataFolder');
    expect(url).toContain('appProperties');
    expect(headers.Authorization).toBe(`Bearer ${JETON}`);
  });

  it('demande l’autorisation la plus étroite qui existe', () => {
    expect(google.DRIVE_SCOPE).toBe('https://www.googleapis.com/auth/drive.appdata');
  });

  it('crée le fichier dans le dossier caché la première fois', async () => {
    await google.uploadDriveFile(JETON, {
      name: 'profil-x.json',
      contents: '{"a":1}',
      appProperties: { profileId: 'x' },
    });
    const envoi = drive.appels.at(-1);
    expect(envoi.method).toBe('POST');
    expect(envoi.body).toContain('"parents":["appDataFolder"]');
    expect(drive.fichiers).toHaveLength(1);
    expect(drive.fichiers[0].contenu).toBe('{"a":1}');
  });

  it('remplace le fichier existant au lieu d’en empiler un second', async () => {
    await google.uploadDriveFile(JETON, { name: 'profil-x.json', contents: '{"a":1}' });
    await google.uploadDriveFile(JETON, {
      fileId: 'id-1',
      name: 'profil-x.json',
      contents: '{"a":2}',
    });
    const envoi = drive.appels.at(-1);
    expect(envoi.method).toBe('PATCH');
    // Drive refuse de voir le dossier parent changer : il n'est posé qu'à la création.
    expect(envoi.body).not.toContain('parents');
    expect(drive.fichiers).toHaveLength(1);
    expect(drive.fichiers[0].contenu).toBe('{"a":2}');
  });

  it('relaie l’explication de Google plutôt qu’un message passe-partout', async () => {
    drive.refus = {
      status: 403,
      body: JSON.stringify({ error: { message: 'Drive API has not been used' } }),
    };
    await expect(google.listDriveFiles(JETON)).rejects.toThrow(
      /403.*Drive API has not been used/
    );

    drive.refus = { status: 401, body: '' };
    await expect(google.listDriveFiles(JETON)).rejects.toThrow(/401.*Reconnectez-vous/);

    drive.refus = { status: 500, body: 'panne' };
    await expect(google.listDriveFiles(JETON)).rejects.toThrow(/500/);
  });
});

describe('compte et état de la sauvegarde', () => {
  it('démarre sans compte, et ne réclame alors jamais de sauvegarde', async () => {
    expect(google.getAccount()).toBeNull();
    await store.addToSuivi(profil.id, { id: 1, mediaType: 'movie', title: 'Un film' });
    backup.markChanged();
    expect(backup.hasPendingChanges()).toBe(false);
  });

  it('signale qu’il y a du nouveau à sauvegarder dès qu’un compte est relié', () => {
    localStorage.setItem('google-account', JSON.stringify(COMPTE));
    expect(backup.hasPendingChanges()).toBe(false);
    backup.markChanged();
    expect(backup.hasPendingChanges()).toBe(true);
  });

  it('oublie l’état de sauvegarde à la déconnexion', () => {
    localStorage.setItem('google-account', JSON.stringify(COMPTE));
    backup.markChanged();
    backup.forgetCloudState();
    expect(backup.hasPendingChanges()).toBe(false);
    expect(backup.lastCloudBackup()).toBeNull();
  });
});

describe('sauvegarder dans le Drive', () => {
  beforeEach(() => {
    localStorage.setItem('google-account', JSON.stringify(COMPTE));
  });

  it('envoie tous les profils de l’appareil, un fichier chacun', async () => {
    await store.addToSuivi(profil.id, { id: 1, mediaType: 'movie', title: 'Un film' });
    const marie = await store.createProfile('Marie');

    const resultat = await backup.backupToDrive(JETON);

    expect(resultat).toEqual({ profils: 2 });
    expect(drive.fichiers.map((f) => f.name).sort()).toEqual(
      [`profil-${profil.id}.json`, `profil-${marie.id}.json`].sort()
    );
    // Le nom du profil voyage à côté du fichier : on peut l'annoncer sans
    // rien télécharger.
    const fichier = drive.fichiers.find((f) => f.name === `profil-${marie.id}.json`);
    expect(fichier.appProperties).toEqual({ profileId: marie.id, profileName: 'Marie' });
    expect(JSON.parse(fichier.contenu).format).toBe('suivi-films-series');
  });

  it('écrase la sauvegarde précédente au lieu de la doubler', async () => {
    await backup.backupToDrive(JETON);
    await store.addToSuivi(profil.id, { id: 1, mediaType: 'movie', title: 'Ajouté après' });
    await backup.backupToDrive(JETON);

    expect(drive.fichiers).toHaveLength(1);
    expect(JSON.parse(drive.fichiers[0].contenu).suivi).toHaveLength(1);
  });

  it('note la date de la sauvegarde et solde ce qui restait à envoyer', async () => {
    backup.markChanged();
    expect(backup.hasPendingChanges()).toBe(true);

    await backup.backupToDrive(JETON);

    expect(backup.hasPendingChanges()).toBe(false);
    expect(backup.lastCloudBackup()).toBeInstanceOf(Date);
  });

  it('ne prétend pas avoir sauvegardé quand Google refuse', async () => {
    backup.markChanged();
    drive.refus = { status: 403, body: '' };
    await expect(backup.backupToDrive(JETON)).rejects.toThrow();
    expect(backup.lastCloudBackup()).toBeNull();
    expect(backup.hasPendingChanges()).toBe(true); // il reste à sauvegarder
  });
});

describe('restaurer depuis le Drive', () => {
  beforeEach(() => {
    localStorage.setItem('google-account', JSON.stringify(COMPTE));
  });

  it('annonce ce que contient le Drive sans rien télécharger', async () => {
    await backup.backupToDrive(JETON);
    drive.appels.length = 0;

    const sauvegardes = await backup.listCloudBackups(JETON);

    expect(sauvegardes).toHaveLength(1);
    expect(sauvegardes[0]).toMatchObject({
      profileId: profil.id,
      profileName: 'Mon profil',
    });
    expect(sauvegardes[0].modifiedAt).toBeInstanceOf(Date);
    expect(drive.appels).toHaveLength(1); // la liste seule, aucun téléchargement
  });

  it('retrouve l’identifiant du profil même sans étiquette', async () => {
    drive.fichiers.push({ id: 'id-9', name: 'profil-abcd-1234.json', contenu: '{}' });
    const [sauvegarde] = await backup.listCloudBackups(JETON);
    expect(sauvegarde.profileId).toBe('abcd-1234');
    expect(sauvegarde.profileName).toBe('Profil');
  });

  it('rend son suivi à un appareil neuf', async () => {
    await store.addToSuivi(profil.id, { id: 1, mediaType: 'movie', title: 'Un film' });
    await store.setStatus(profil.id, 'movie', 1, 'vu');
    await backup.backupToDrive(JETON);

    // Appareil neuf : plus rien en base, mais le même Drive.
    await db.run('DELETE FROM profiles');

    const sauvegardes = await backup.listCloudBackups(JETON);
    const restaure = await backup.restoreFromDrive(JETON, sauvegardes);

    expect(restaure).toBe(profil.id);
    const suivi = await store.listSuivi(profil.id);
    expect(suivi).toHaveLength(1);
    expect(suivi[0].status).toBe('vu');
  });

  it('refuse un fichier qui n’est pas une sauvegarde de l’application', async () => {
    drive.fichiers.push({
      id: 'id-9',
      name: 'profil-abcd.json',
      contenu: JSON.stringify({ format: 'autre-appli' }),
    });
    const sauvegardes = await backup.listCloudBackups(JETON);
    await expect(backup.restoreFromDrive(JETON, sauvegardes)).rejects.toThrow(
      "n'est pas une sauvegarde"
    );
  });
});

// Constaté par Kinder le 2026-09-11 : les profils supprimés revenaient à
// chaque restauration, parce que leur fichier restait dans le Drive.
describe('profil supprimé', () => {
  beforeEach(() => {
    localStorage.setItem('google-account', JSON.stringify(COMPTE));
  });

  it('n’est plus proposé à la restauration, même avant la sauvegarde suivante', async () => {
    const marie = await store.createProfile('Marie');
    await backup.backupToDrive(JETON);
    await store.deleteProfile(marie.id);
    backup.oublierProfil(marie.id);

    const sauvegardes = await backup.listCloudBackups(JETON);
    expect(sauvegardes.map((s) => s.profileId)).toEqual([profil.id]);
  });

  it('quitte le Drive à la sauvegarde suivante', async () => {
    const marie = await store.createProfile('Marie');
    await backup.backupToDrive(JETON);
    await store.deleteProfile(marie.id);
    backup.oublierProfil(marie.id);
    expect(backup.hasPendingChanges()).toBe(true); // la suppression est à envoyer

    await backup.backupToDrive(JETON);

    expect(drive.fichiers.map((f) => f.name)).toEqual([`profil-${profil.id}.json`]);
  });

  it('ne retire jamais un profil simplement absent de l’appareil', async () => {
    // Téléphone neuf pas encore restauré : les profils du Drive y sont absents,
    // une sauvegarde ne doit surtout pas les effacer.
    drive.fichiers.push({
      id: 'id-9',
      name: 'profil-autre-appareil.json',
      appProperties: { profileId: 'autre-appareil', profileName: 'Marie' },
      contenu: '{}',
    });
    await backup.backupToDrive(JETON);
    expect(drive.fichiers.map((f) => f.name)).toContain('profil-autre-appareil.json');
  });
});

describe('proposition de restauration au premier branchement', () => {
  beforeEach(() => {
    localStorage.setItem('google-account', JSON.stringify(COMPTE));
  });

  it('propose une sauvegarde dont le profil est inconnu de l’appareil', async () => {
    drive.fichiers.push({
      id: 'id-9',
      name: 'profil-autre-appareil.json',
      appProperties: { profileId: 'autre-appareil', profileName: 'Marie' },
      contenu: '{}',
    });
    const propositions = await backup.cloudRestoreSuggestions(JETON);
    expect(propositions.map((p) => p.profileName)).toEqual(['Marie']);
  });

  it('propose de remplir un profil local encore vide', async () => {
    await backup.backupToDrive(JETON); // profil local vide
    const propositions = await backup.cloudRestoreSuggestions(JETON);
    expect(propositions.map((p) => p.profileId)).toEqual([profil.id]);
  });

  it('ne propose jamais d’écraser un suivi déjà rempli', async () => {
    await backup.backupToDrive(JETON);
    await store.addToSuivi(profil.id, { id: 1, mediaType: 'movie', title: 'Un film' });
    expect(await backup.cloudRestoreSuggestions(JETON)).toEqual([]);
  });

  it('ne propose rien quand le Drive est vide', async () => {
    expect(await backup.cloudRestoreSuggestions(JETON)).toEqual([]);
  });
});

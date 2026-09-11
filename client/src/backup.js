// Couche Logique — sauvegarde, restauration et export (tranche 4, PLAN_ANDROID).
//
// Sans serveur, tout vit sur l'appareil : perdre l'appareil sans sauvegarde,
// c'est perdre son suivi. Ce fichier est donc ce qui rend le « tout en local »
// tenable, pas une commodité.
//
// La sauvegarde s'appuie sur l'**UUID portable** du profil : restaurer réécrit
// le profil portant le même identifiant. Exporter, réinstaller, restaurer rend
// donc exactement l'état d'origine — c'est précisément ce pour quoi cet UUID
// avait été choisi (voir PROJET_CONTEXTE.md).

import { query, run, runMany } from './db.js';

export const BACKUP_FORMAT = 'suivi-films-series';
// Version 2 : les sauvegardes emportent la note personnelle (avis + étoiles).
// Le numéro monte parce qu'une version plus ancienne de l'application, qui ne
// connaît pas ces champs, les perdrait en silence en restaurant puis en
// ré-exportant. Elle refuse donc le fichier plutôt que d'effacer des avis.
export const BACKUP_VERSION = 2;

// --- Sauvegarde complète ---

// Renvoie l'intégralité d'un profil sous forme d'objet (profil, suivi,
// épisodes vus, listes et leur contenu).
export async function exportProfile(profileId) {
  const [profil] = await query('SELECT id, name, avatar FROM profiles WHERE id = ?', [
    profileId,
  ]);
  if (!profil) throw new Error('Profil introuvable.');

  const suivi = await query(
    `SELECT tmdb_id AS tmdbId, media_type AS mediaType, title, year,
            release_date AS releaseDate, poster_url AS posterUrl, status,
            note, rating, runtime, release_region AS releaseRegion,
            added_at AS addedAt
     FROM suivi WHERE profile_id = ? ORDER BY added_at`,
    [profileId]
  );

  const episodesVus = await query(
    `SELECT series_id AS seriesId, season_number AS season,
            episode_number AS episode, marked_at AS markedAt
     FROM episodes_vus WHERE profile_id = ?
     ORDER BY series_id, season_number, episode_number`,
    [profileId]
  );

  const listesRows = await query(
    'SELECT id, name, created_at AS createdAt FROM listes WHERE profile_id = ? ORDER BY created_at',
    [profileId]
  );
  const listes = [];
  for (const l of listesRows) {
    const items = await query(
      `SELECT tmdb_id AS tmdbId, media_type AS mediaType, added_at AS addedAt
       FROM liste_items WHERE liste_id = ? AND profile_id = ? ORDER BY added_at`,
      [l.id, profileId]
    );
    // Les listes s'exportent par leur *nom*, pas par leur numéro local : deux
    // appareils n'attribuent pas les mêmes numéros.
    listes.push({ name: l.name, createdAt: l.createdAt, items });
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile: { id: profil.id, name: profil.name, avatar: profil.avatar ?? null },
    suivi,
    episodesVus,
    listes,
  };
}

// Vérifie qu'un fichier ouvert est bien une sauvegarde exploitable, avant de
// toucher quoi que ce soit en base.
export function validateBackup(data) {
  if (!data || typeof data !== 'object') throw new Error('Fichier illisible.');
  if (data.format !== BACKUP_FORMAT) {
    throw new Error("Ce fichier n'est pas une sauvegarde de cette application.");
  }
  if (data.version > BACKUP_VERSION) {
    throw new Error(
      'Cette sauvegarde vient d\'une version plus récente de l\'application.'
    );
  }
  if (!data.profile?.id || !data.profile?.name) throw new Error('Profil absent du fichier.');
  if (!Array.isArray(data.suivi)) throw new Error('Suivi absent du fichier.');
  return data;
}

// Résumé lisible avant restauration : on annonce ce qui va être écrit.
export function describeBackup(data) {
  return {
    profil: data.profile.name,
    titres: data.suivi.length,
    episodes: (data.episodesVus || []).length,
    listes: (data.listes || []).length,
    date: data.exportedAt ? data.exportedAt.slice(0, 10) : null,
  };
}

// --- Restauration ---

// Réécrit le profil portant l'identifiant de la sauvegarde : son contenu est
// remplacé, pas fusionné (une restauration doit rendre l'état exact du fichier).
// Renvoie l'id du profil restauré, à activer ensuite dans l'UI.
export async function importProfile(data) {
  validateBackup(data);
  const { id, name } = data.profile;

  const existe = (await query('SELECT id FROM profiles WHERE id = ?', [id])).length > 0;
  if (existe) {
    await run('UPDATE profiles SET name = ?, avatar = ? WHERE id = ?', [
      name,
      data.profile.avatar ?? null,
      id,
    ]);
    // Les suppressions en cascade emportent listes, éléments et épisodes.
    await run('DELETE FROM suivi WHERE profile_id = ?', [id]);
    await run('DELETE FROM episodes_vus WHERE profile_id = ?', [id]);
    await run('DELETE FROM listes WHERE profile_id = ?', [id]);
  } else {
    await run('INSERT INTO profiles (id, name, avatar) VALUES (?, ?, ?)', [
      id,
      name,
      data.profile.avatar ?? null,
    ]);
  }

  if (data.suivi.length > 0) {
    await runMany(
      data.suivi.map((s) => ({
        sql: `INSERT OR REPLACE INTO suivi
                (profile_id, tmdb_id, media_type, title, year, release_date,
                 poster_url, status, note, rating, runtime, release_region,
                 added_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`,
        params: [
          id,
          s.tmdbId,
          s.mediaType,
          s.title,
          s.year ?? null,
          s.releaseDate ?? null,
          s.posterUrl ?? null,
          s.status || 'a_voir',
          // Absents d'une sauvegarde d'avant la note : simplement vides.
          s.note ?? null,
          s.rating ?? null,
          s.runtime ?? null,
          s.releaseRegion ?? null,
          s.addedAt ?? null,
        ],
      }))
    );
  }

  const episodes = data.episodesVus || [];
  if (episodes.length > 0) {
    await runMany(
      episodes.map((e) => ({
        sql: `INSERT OR REPLACE INTO episodes_vus
                (profile_id, series_id, season_number, episode_number, marked_at)
              VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))`,
        params: [id, e.seriesId, e.season, e.episode, e.markedAt ?? null],
      }))
    );
  }

  for (const l of data.listes || []) {
    const { lastId } = await run(
      `INSERT INTO listes (profile_id, name, created_at)
       VALUES (?, ?, COALESCE(?, datetime('now')))`,
      [id, l.name, l.createdAt ?? null]
    );
    const items = (l.items || []).filter((it) =>
      // Un élément de liste doit exister dans le suivi (contrainte de la base).
      data.suivi.some((s) => s.tmdbId === it.tmdbId && s.mediaType === it.mediaType)
    );
    if (items.length > 0) {
      await runMany(
        items.map((it) => ({
          sql: `INSERT OR IGNORE INTO liste_items
                  (liste_id, profile_id, tmdb_id, media_type, added_at)
                VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))`,
          params: [lastId, id, it.tmdbId, it.mediaType, it.addedAt ?? null],
        }))
      );
    }
  }

  return id;
}

// --- Export vers d'autres plateformes ---

const CSV_STATUS_VU = new Set(['vu']);

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Export au format CSV que Letterboxd et Trakt savent importer.
// Letterboxd n'accepte que des **films** : les séries sont écartées, et on
// l'annonce à l'utilisateur plutôt que de les perdre en silence.
export function toLetterboxdCsv(suivi) {
  const films = suivi.filter((s) => s.mediaType === 'movie');
  const lignes = [
    ['Title', 'Year', 'tmdbID', 'WatchedDate', 'Rating', 'Review'].join(','),
  ];
  for (const f of films) {
    lignes.push(
      [
        csvCell(f.title),
        csvCell(f.year),
        csvCell(f.tmdbId),
        // Letterboxd attend une date de visionnage : on ne la connaît pas,
        // on ne fournit donc que celle des titres marqués « vu ».
        csvCell(CSV_STATUS_VU.has(f.status) ? (f.addedAt || '').slice(0, 10) : ''),
        // Letterboxd lit la note sur 5 et l'avis : nos deux champs y trouvent
        // leur place telle quelle.
        csvCell(f.rating ?? ''),
        csvCell(f.note ?? ''),
      ].join(',')
    );
  }
  return { csv: lignes.join('\n'), films: films.length, series: suivi.length - films.length };
}

// --- Sauvegarde cloud : le Drive de l'utilisateur ---
//
// Même sauvegarde que ci-dessus, déposée dans le dossier caché que Google
// réserve à l'application dans le Drive de l'utilisateur. Un fichier par
// profil, nommé d'après son **UUID portable** : c'est ce qui permet de
// retrouver ses données sur un autre appareil sans rien fusionner à l'aveugle.
//
// Constaté à la mise au point : Google réaffiche son écran de compte à chaque
// nouvelle autorisation. Une sauvegarde ne peut donc pas partir toute seule
// pendant que l'utilisateur fait autre chose. On enregistre à la place qu'il
// y a « quelque chose à sauvegarder », et l'application le lui propose en un
// geste — voir `hasPendingChanges()`.

import {
  listDriveFiles,
  uploadDriveFile,
  downloadDriveFile,
  deleteDriveFile,
  getAccessToken,
  getAccount,
} from './google.js';

const PENDING_KEY = 'cloud-pending';
const LAST_BACKUP_KEY = 'cloud-last-backup';

// --- Profils supprimés ---
//
// Supprimer un profil ne touchait pas sa sauvegarde Drive (filet de sécurité).
// Conséquence constatée par Kinder le 2026-09-11 : « Restaurer depuis Drive »
// ramenait tous les profils du Drive, et les profils supprimés revenaient à
// chaque fois, sauvegarde ou pas.
//
// Désormais une suppression est **retenue** : le profil n'est plus proposé à
// la restauration, et son fichier est retiré du Drive à la sauvegarde
// suivante. On ne retire que ce qui a été explicitement supprimé — jamais
// « tout ce qui n'est pas sur l'appareil », qui viderait le Drive depuis un
// téléphone neuf pas encore restauré.
const SUPPRIMES_KEY = 'cloud-profils-supprimes';

function profilsSupprimes() {
  try {
    return new Set(JSON.parse(readLocal(SUPPRIMES_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

export function oublierProfil(profileId) {
  const ids = profilsSupprimes();
  ids.add(profileId);
  writeLocal(SUPPRIMES_KEY, JSON.stringify([...ids]));
  markChanged(); // la sauvegarde suivante retire son fichier du Drive
}

const cloudFileName = (profileId) => `profil-${profileId}.json`;

function readLocal(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible : on perd seulement l'indication d'attente */
  }
}

// L'écran doit savoir *quand* l'état « à sauvegarder » bouge. Sans ça, le
// bandeau n'apparaissait qu'au lancement suivant : on pouvait cocher dix
// épisodes sans jamais être prévenu qu'il y avait du nouveau à envoyer.
const abonnes = new Set();

export function surChangementDeSauvegarde(callback) {
  abonnes.add(callback);
  return () => abonnes.delete(callback);
}

function prevenir() {
  for (const callback of abonnes) callback(hasPendingChanges());
}

// Signale qu'une donnée a changé depuis la dernière sauvegarde. Appelé par
// `api.js` à chaque modification (titre ajouté, épisode coché, statut changé).
// Volontairement sans effet si aucun compte n'est relié : on ne réclame rien
// à qui n'a pas demandé de sauvegarde cloud.
export function markChanged() {
  if (!getAccount()) return;
  writeLocal(PENDING_KEY, new Date().toISOString());
  prevenir();
}

// Vrai s'il y a des modifications non sauvegardées dans le Drive.
export function hasPendingChanges() {
  return !!getAccount() && !!readLocal(PENDING_KEY);
}

// --- Sauvegarde automatique ---
//
// Déclenchée quand on quitte l'application, et de nouveau au retour si la
// précédente n'a pas abouti. Trois règles, qui font tout le comportement :
//
//  1. **Rien à sauvegarder, rien ne part.** Aucun envoi inutile, aucune donnée
//     mobile consommée pour rien.
//  2. **Jamais d'écran.** `interactive: false` : si Google réclame un accord,
//     on renonce en silence plutôt que de faire surgir un écran de compte
//     pendant que l'utilisateur fait autre chose.
//  3. **Un échec ne s'efface pas.** Le drapeau « à sauvegarder » n'est levé que
//     par une sauvegarde réussie : réseau coupé, autorisation révoquée, ou
//     Android qui coupe l'application avant la fin de l'envoi, et le bandeau
//     revient. Une sauvegarde ratée ne peut donc pas passer inaperçue.
//
// Android ne garantit pas de laisser une application finir un envoi quand on la
// quitte : c'est « la plupart du temps », pas « toujours ». D'où la règle 3, et
// d'où la seconde tentative au retour — celle-là a tout son temps.
const LAST_AUTO_KEY = 'cloud-last-auto';
const AUTO_OFF_KEY = 'cloud-auto-off';

// Activée par défaut dès qu'un compte Google est relié : personne ne relie un
// compte pour *ne pas* être sauvegardé. On range donc le refus, pas l'accord —
// ainsi une installation neuve, ou une sauvegarde restaurée, part protégée.
export function sauvegardeAutoActive() {
  return readLocal(AUTO_OFF_KEY) !== '1';
}

export function reglerSauvegardeAuto(active) {
  writeLocal(AUTO_OFF_KEY, active ? null : '1');
  prevenir();
}

let autoEnCours = false;

// Ce qu'a donné la dernière tentative automatique, affiché dans l'écran de
// sauvegarde. Une tentative qui échoue en silence n'est pas diagnosticable
// autrement : l'application tourne sur un téléphone, pas sous nos yeux.
function noterEssai(resultat) {
  writeLocal(
    LAST_AUTO_KEY,
    JSON.stringify({ ...resultat, quand: new Date().toISOString() })
  );
  return resultat;
}

export function dernierEssaiAutomatique() {
  try {
    const brut = readLocal(LAST_AUTO_KEY);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

export async function sauvegardeAutomatique() {
  // L'interrupteur est lu ici, à chaque tentative : le couper doit avoir effet
  // tout de suite, sans relancer l'application.
  if (!sauvegardeAutoActive()) return { fait: false, raison: 'desactivee' };
  if (!hasPendingChanges()) return { fait: false, raison: 'rien-a-sauvegarder' };
  if (autoEnCours) return { fait: false, raison: 'deja-en-cours' };

  autoEnCours = true;
  try {
    const jeton = await getAccessToken({ interactive: false });
    if (!jeton) return noterEssai({ fait: false, raison: 'autorisation-indisponible' });
    const { profils } = await backupToDrive(jeton);
    return noterEssai({ fait: true, profils });
  } catch (error) {
    return noterEssai({ fait: false, raison: 'echec', message: error.message });
  } finally {
    autoEnCours = false;
  }
}

// Date de la dernière sauvegarde réussie, ou null. Affichée en clair : c'est
// la seule façon pour l'utilisateur de savoir où il en est.
export function lastCloudBackup() {
  const value = readLocal(LAST_BACKUP_KEY);
  return value ? new Date(value) : null;
}

export function forgetCloudState() {
  writeLocal(PENDING_KEY, null);
  writeLocal(LAST_BACKUP_KEY, null);
  writeLocal(LAST_AUTO_KEY, null);
  writeLocal(AUTO_OFF_KEY, null);
  prevenir();
}

// Envoie **tous** les profils de l'appareil dans le Drive. Sauvegarder à
// moitié n'aurait pas de sens : on change d'appareil avec tout son suivi.
export async function backupToDrive(token) {
  const profils = await query('SELECT id, name FROM profiles ORDER BY created_at');
  const existants = await listDriveFiles(token);
  let envoyes = 0;

  for (const profil of profils) {
    const data = await exportProfile(profil.id);
    const nom = cloudFileName(profil.id);
    const existant = existants.find((f) => f.name === nom);
    await uploadDriveFile(token, {
      fileId: existant?.id,
      name: nom,
      contents: JSON.stringify(data),
      // Le nom du profil est rangé à côté du fichier : on peut annoncer
      // « profil Marie » avant de télécharger quoi que ce soit.
      appProperties: { profileId: profil.id, profileName: profil.name },
    });
    envoyes += 1;
  }

  // Profils supprimés sur l'appareil : leur fichier quitte le Drive. Un profil
  // recréé depuis (même identifiant, restauré par fichier) est gardé.
  const supprimes = profilsSupprimes();
  const locaux = new Set(profils.map((p) => p.id));
  for (const f of existants) {
    const id = f.appProperties?.profileId || f.name.slice(7, -5);
    if (f.name.startsWith('profil-') && supprimes.has(id) && !locaux.has(id)) {
      await deleteDriveFile(token, f.id);
    }
  }
  writeLocal(SUPPRIMES_KEY, null);

  writeLocal(LAST_BACKUP_KEY, new Date().toISOString());
  writeLocal(PENDING_KEY, null);
  prevenir();
  return { profils: envoyes };
}

// Ce que contient le Drive, sans rien télécharger : de quoi annoncer à
// l'utilisateur ce qu'il s'apprête à restaurer.
export async function listCloudBackups(token) {
  const fichiers = await listDriveFiles(token);
  // Un profil supprimé sur l'appareil n'est plus proposé, même si la
  // sauvegarde qui retirera son fichier n'est pas encore partie.
  const supprimes = profilsSupprimes();
  return fichiers
    .filter((f) => f.name.startsWith('profil-'))
    .map((f) => ({
      fileId: f.id,
      profileId: f.appProperties?.profileId || f.name.slice(7, -5),
      profileName: f.appProperties?.profileName || 'Profil',
      modifiedAt: f.modifiedTime ? new Date(f.modifiedTime) : null,
    }))
    .filter((s) => !supprimes.has(s.profileId));
}

// Restaure tout ce que contient le Drive. Chaque profil restauré **remplace**
// celui qui porte le même identifiant ; les autres ne sont pas touchés.
// Renvoie l'id du premier profil restauré, à activer dans l'UI.
export async function restoreFromDrive(token, sauvegardes) {
  let premier = null;
  for (const s of sauvegardes) {
    const data = validateBackup(await downloadDriveFile(token, s.fileId));
    const id = await importProfile(data);
    if (!premier) premier = id;
  }
  writeLocal(PENDING_KEY, null);
  return premier;
}

// Sauvegardes qu'il est **pertinent** de proposer au premier branchement d'un
// compte : celles dont le profil n'existe pas sur cet appareil, ou dont le
// profil local est vide.
//
// La règle est volontairement prudente. Proposer de restaurer par-dessus un
// suivi déjà rempli reviendrait à proposer d'en perdre une partie : on ne le
// fait jamais de soi-même. L'utilisateur garde le bouton « Restaurer depuis
// Drive… » pour les cas que cette règle écarte.
export async function cloudRestoreSuggestions(token) {
  const sauvegardes = await listCloudBackups(token);
  if (sauvegardes.length === 0) return [];

  const locaux = await query('SELECT id FROM profiles');
  const connus = new Set(locaux.map((p) => p.id));
  const proposables = [];

  for (const s of sauvegardes) {
    if (!connus.has(s.profileId)) {
      proposables.push(s);
      continue;
    }
    const [{ n }] = await query(
      'SELECT COUNT(*) AS n FROM suivi WHERE profile_id = ?',
      [s.profileId]
    );
    if (n === 0) proposables.push(s);
  }
  return proposables;
}

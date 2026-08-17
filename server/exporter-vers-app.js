// Récupération du suivi du PC vers l'application Android (tranche 4, PLAN_ANDROID).
//
// Outil à usage unique : lit la base locale du serveur (server/data/suivi.sqlite)
// et écrit un fichier de sauvegarde au format de l'application, à restaurer
// depuis l'écran « Sauvegarde ».
//
// Le serveur n'est plus utilisé, mais son code et sa base restent dans le dépôt :
// c'est de là que viennent les données à récupérer.
//
// Usage :
//   node server/exporter-vers-app.js              (tous les profils)
//   node server/exporter-vers-app.js <id-profil>  (un seul profil)

import Database from 'better-sqlite3';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'data', 'suivi.sqlite');

// Doit rester aligné sur client/src/backup.js.
const BACKUP_FORMAT = 'suivi-films-series';
const BACKUP_VERSION = 1;

function exporterProfil(db, profil) {
  const suivi = db
    .prepare(
      `SELECT tmdb_id AS tmdbId, media_type AS mediaType, title, year,
              release_date AS releaseDate, poster_url AS posterUrl, status,
              added_at AS addedAt
       FROM suivi WHERE profile_id = ? ORDER BY added_at`
    )
    .all(profil.id);

  const episodesVus = db
    .prepare(
      `SELECT series_id AS seriesId, season_number AS season,
              episode_number AS episode, marked_at AS markedAt
       FROM episodes_vus WHERE profile_id = ?
       ORDER BY series_id, season_number, episode_number`
    )
    .all(profil.id);

  // Les listes s'exportent par leur nom : les numéros locaux ne voyagent pas.
  const listes = db
    .prepare('SELECT id, name, created_at AS createdAt FROM listes WHERE profile_id = ? ORDER BY created_at')
    .all(profil.id)
    .map((l) => ({
      name: l.name,
      createdAt: l.createdAt,
      items: db
        .prepare(
          `SELECT tmdb_id AS tmdbId, media_type AS mediaType, added_at AS addedAt
           FROM liste_items WHERE liste_id = ? AND profile_id = ? ORDER BY added_at`
        )
        .all(l.id, profil.id),
    }));

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile: { id: profil.id, name: profil.name },
    suivi,
    episodesVus,
    listes,
  };
}

function nomFichier(nom) {
  const base = (nom || 'profil')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `suivi-${base}-${new Date().toISOString().slice(0, 10)}.json`;
}

let db;
try {
  db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
} catch {
  console.error(`Base introuvable : ${DB_PATH}`);
  console.error("Rien à récupérer (aucun suivi n'a été enregistré sur ce PC).");
  process.exit(1);
}

const filtre = process.argv[2];
const profils = db
  .prepare('SELECT id, name FROM profiles ORDER BY created_at')
  .all()
  .filter((p) => !filtre || p.id === filtre);

if (profils.length === 0) {
  console.error(filtre ? `Aucun profil avec l'id ${filtre}.` : 'Aucun profil dans la base.');
  process.exit(1);
}

for (const profil of profils) {
  const data = exporterProfil(db, profil);
  const fichier = join(__dirname, nomFichier(profil.name));
  writeFileSync(fichier, JSON.stringify(data, null, 2), 'utf8');
  console.log(
    `${profil.name} → ${fichier}\n` +
      `   ${data.suivi.length} titre(s), ${data.episodesVus.length} épisode(s) vu(s), ` +
      `${data.listes.length} liste(s)`
  );
}

db.close();
console.log(
  '\nTransférez ce ou ces fichiers sur le téléphone, puis ouvrez\n' +
    "l'écran « Sauvegarde » de l'application et choisissez « Restaurer »."
);

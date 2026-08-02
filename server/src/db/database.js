import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
const DB_PATH = join(DATA_DIR, 'suivi.sqlite');

let db;

// Couche Données. Ouvre le fichier local et crée la table de suivi.
// On ne stocke QUE ce que TMDB ne peut pas nous redonner à volonté sans
// re-requête : l'identité de l'élément suivi + de quoi l'afficher.
export function initDb() {
  mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS suivi (
      tmdb_id    INTEGER NOT NULL,
      media_type TEXT    NOT NULL,           -- 'movie' | 'tv'
      title      TEXT    NOT NULL,
      year       TEXT,
      poster_url TEXT,
      status     TEXT    NOT NULL DEFAULT 'a_voir',  -- films : 'a_voir' | 'vu'
      added_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (tmdb_id, media_type)
    );
  `);

  // Migration : ajoute la colonne "status" aux bases créées avant la tranche 3
  // (les titres déjà suivis prennent la valeur par défaut 'a_voir').
  const hasStatus = db
    .prepare('PRAGMA table_info(suivi)')
    .all()
    .some((col) => col.name === 'status');
  if (!hasStatus) {
    db.exec("ALTER TABLE suivi ADD COLUMN status TEXT NOT NULL DEFAULT 'a_voir'");
  }

  // Épisodes de séries marqués « vu ». Une ligne présente = épisode vu.
  db.exec(`
    CREATE TABLE IF NOT EXISTS episodes_vus (
      series_id      INTEGER NOT NULL,
      season_number  INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      marked_at      TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (series_id, season_number, episode_number)
    );
  `);

  console.log(`Base locale SQLite prête : ${DB_PATH}`);
  return db;
}

export function getDb() {
  if (!db) throw new Error("La base n'est pas initialisée.");
  return db;
}

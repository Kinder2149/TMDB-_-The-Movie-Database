import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
const DB_PATH = join(DATA_DIR, 'suivi.sqlite');

let db;

// Couche Données. Ouvre le fichier local et crée les tables.
// On ne stocke QUE ce que TMDB ne peut pas nous redonner à volonté sans
// re-requête : l'identité de l'élément suivi + de quoi l'afficher.
//
// Chaque donnée de suivi appartient à un "profil". Le profil est identifié par
// un UUID *portable* (pas un rowid local) : c'est ce qui permettra, en V2, de
// rattacher un profil local à un compte en ligne sans re-migrer. En V1 tout
// reste local et sans mot de passe : un profil = une simple ligne.
export function initDb() {
  mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Profils : identité portable (UUID) + nom lisible.
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id         TEXT PRIMARY KEY,          -- UUID portable
      name       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS suivi (
      profile_id TEXT    NOT NULL,
      tmdb_id    INTEGER NOT NULL,
      media_type TEXT    NOT NULL,           -- 'movie' | 'tv'
      title      TEXT    NOT NULL,
      year       TEXT,
      poster_url TEXT,
      status     TEXT    NOT NULL DEFAULT 'a_voir',  -- films : 'a_voir' | 'vu'
      added_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (profile_id, tmdb_id, media_type),
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
  `);

  // Épisodes de séries marqués « vu ». Une ligne présente = épisode vu.
  db.exec(`
    CREATE TABLE IF NOT EXISTS episodes_vus (
      profile_id     TEXT    NOT NULL,
      series_id      INTEGER NOT NULL,
      season_number  INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      marked_at      TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (profile_id, series_id, season_number, episode_number),
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
  `);

  // Migration : ajoute la colonne "status" aux bases créées avant la tranche 3
  // (les titres déjà suivis prennent la valeur par défaut 'a_voir').
  // Note : ne s'applique qu'aux bases qui ont DÉJÀ la colonne profile_id
  // (les plus anciennes passent par migrateToProfiles() ci-dessous).
  const suiviCols = db.prepare('PRAGMA table_info(suivi)').all();
  const hasProfileId = suiviCols.some((c) => c.name === 'profile_id');
  const hasStatus = suiviCols.some((c) => c.name === 'status');
  if (hasProfileId && !hasStatus) {
    db.exec("ALTER TABLE suivi ADD COLUMN status TEXT NOT NULL DEFAULT 'a_voir'");
  }

  // Migration des bases d'avant les profils : rattache le suivi existant à un
  // profil par défaut, sans rien perdre.
  migrateToProfiles();

  // Toujours garantir au moins un profil (base neuve incluse).
  ensureDefaultProfile();

  console.log(`Base locale SQLite prête : ${DB_PATH}`);
  return db;
}

// S'assure qu'au moins un profil existe. Renvoie l'id d'un profil par défaut.
function ensureDefaultProfile() {
  const existing = db.prepare('SELECT id FROM profiles ORDER BY created_at LIMIT 1').get();
  if (existing) return existing.id;
  const id = randomUUID();
  db.prepare('INSERT INTO profiles (id, name) VALUES (?, ?)').run(id, 'Mon profil');
  return id;
}

// Reconstruit suivi/episodes_vus au format "avec profil" pour les bases créées
// avant l'introduction des profils (SQLite ne sait pas ALTER une clé primaire).
// Les lignes existantes sont rattachées à un profil par défaut → aucune perte.
function migrateToProfiles() {
  const needsSuivi = tableExists('suivi') && !columnExists('suivi', 'profile_id');
  const needsEpisodes =
    tableExists('episodes_vus') && !columnExists('episodes_vus', 'profile_id');
  if (!needsSuivi && !needsEpisodes) return;

  const defaultId = ensureDefaultProfile();

  const run = db.transaction(() => {
    if (needsSuivi) {
      db.exec('ALTER TABLE suivi RENAME TO suivi_old');
      db.exec(`
        CREATE TABLE suivi (
          profile_id TEXT    NOT NULL,
          tmdb_id    INTEGER NOT NULL,
          media_type TEXT    NOT NULL,
          title      TEXT    NOT NULL,
          year       TEXT,
          poster_url TEXT,
          status     TEXT    NOT NULL DEFAULT 'a_voir',
          added_at   TEXT    NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (profile_id, tmdb_id, media_type),
          FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );
      `);
      // Les anciennes bases peuvent ne pas avoir la colonne status : COALESCE.
      db.prepare(
        `INSERT INTO suivi (profile_id, tmdb_id, media_type, title, year, poster_url, status, added_at)
         SELECT ?, tmdb_id, media_type, title, year, poster_url,
                COALESCE(status, 'a_voir'), added_at
         FROM suivi_old`
      ).run(defaultId);
      db.exec('DROP TABLE suivi_old');
    }

    if (needsEpisodes) {
      db.exec('ALTER TABLE episodes_vus RENAME TO episodes_vus_old');
      db.exec(`
        CREATE TABLE episodes_vus (
          profile_id     TEXT    NOT NULL,
          series_id      INTEGER NOT NULL,
          season_number  INTEGER NOT NULL,
          episode_number INTEGER NOT NULL,
          marked_at      TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (profile_id, series_id, season_number, episode_number),
          FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        );
      `);
      db.prepare(
        `INSERT INTO episodes_vus (profile_id, series_id, season_number, episode_number, marked_at)
         SELECT ?, series_id, season_number, episode_number, marked_at
         FROM episodes_vus_old`
      ).run(defaultId);
      db.exec('DROP TABLE episodes_vus_old');
    }
  });
  run();
  console.log('Migration profils : suivi existant rattaché au profil par défaut.');
}

function tableExists(name) {
  return !!db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
}

function columnExists(table, column) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((c) => c.name === column);
}

export function getDb() {
  if (!db) throw new Error("La base n'est pas initialisée.");
  return db;
}

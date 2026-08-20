// Couche Données — la base SQLite embarquée dans l'appareil.
//
// Déplacé depuis server/src/db/database.js (tranche 2 du PLAN_ANDROID).
// Le schéma est identique à celui du serveur : mêmes tables, mêmes clés,
// mêmes cascades. Seul le moteur change.
//
// Deux moteurs, une seule porte (`query` / `run` / `runMany`) :
//   - téléphone : le SQLite natif d'Android (plugin Capacitor) ;
//   - PC        : sql.js, le même SQLite compilé pour le navigateur, rangé
//                 dans le stockage local. Sert à développer et à tester.
// Le SQL est rigoureusement le même des deux côtés — c'est tout l'intérêt
// d'avoir gardé SQLite plutôt que de réécrire le stockage.
//
// Deux différences avec la version serveur, toutes deux volontaires :
//  1. Aucun code de migration : chaque installation part d'une base neuve.
//     (La récupération du suivi du PC se fera par import, en tranche 4.)
//  2. Les lectures/écritures sont *asynchrones* — un moteur embarqué ne répond
//     pas instantanément. Cette asynchronicité s'arrête à `api.js`, qui était
//     déjà asynchrone : aucun écran n'est touché.

import { Capacitor } from '@capacitor/core';

const DB_NAME = 'suivi';
const isWeb = Capacitor.getPlatform() === 'web';

let engine = null;
let ready = null; // promesse d'initialisation, partagée par tous les appelants

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS profiles (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS suivi (
    profile_id   TEXT    NOT NULL,
    tmdb_id      INTEGER NOT NULL,
    media_type   TEXT    NOT NULL,
    title        TEXT    NOT NULL,
    year         TEXT,
    release_date TEXT,
    poster_url   TEXT,
    status       TEXT    NOT NULL DEFAULT 'a_voir',
    added_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (profile_id, tmdb_id, media_type),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS episodes_vus (
    profile_id     TEXT    NOT NULL,
    series_id      INTEGER NOT NULL,
    season_number  INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    marked_at      TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (profile_id, series_id, season_number, episode_number),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS listes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT NOT NULL,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS liste_items (
    liste_id   INTEGER NOT NULL,
    profile_id TEXT    NOT NULL,
    tmdb_id    INTEGER NOT NULL,
    media_type TEXT    NOT NULL,
    added_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (liste_id, tmdb_id, media_type),
    FOREIGN KEY (liste_id) REFERENCES listes(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id, tmdb_id, media_type)
      REFERENCES suivi(profile_id, tmdb_id, media_type) ON DELETE CASCADE
  );
`;

// --- Moteur PC : sql.js + stockage du navigateur ---
//
// sql.js travaille sur une base en mémoire ; c'est à nous de la ranger après
// chaque écriture, sinon elle disparaît au rechargement.
async function createWebEngine() {
  const [{ default: initSqlJs }, idb] = await Promise.all([
    import('sql.js'),
    import('idb-keyval'),
  ]);
  const SQL = await initSqlJs({ locateFile: () => '/assets/sql-wasm.wasm' });

  const STORE_KEY = `db:${DB_NAME}`;
  const saved = await idb.get(STORE_KEY);
  const database = saved ? new SQL.Database(new Uint8Array(saved)) : new SQL.Database();

  const save = () => idb.set(STORE_KEY, database.export());

  return {
    execute: async (sql) => {
      database.exec(sql);
      await save();
    },
    query: async (sql, params) => {
      const stmt = database.prepare(sql);
      try {
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        return rows;
      } finally {
        stmt.free();
      }
    },
    run: async (sql, params) => {
      database.run(sql, params);
      const changes = database.getRowsModified();
      const res = database.exec('SELECT last_insert_rowid() AS id');
      await save();
      return { changes, lastId: res[0]?.values?.[0]?.[0] ?? null };
    },
    runMany: async (statements) => {
      database.run('BEGIN');
      try {
        for (const { sql, params } of statements) database.run(sql, params);
        database.run('COMMIT');
      } catch (err) {
        database.run('ROLLBACK');
        throw err;
      }
      await save();
    },
  };
}

// --- Moteur téléphone : SQLite natif ---
async function createNativeEngine() {
  const { CapacitorSQLite, SQLiteConnection } = await import(
    '@capacitor-community/sqlite'
  );
  const sqlite = new SQLiteConnection(CapacitorSQLite);

  // Une connexion peut survivre à un rechargement : on la réutilise.
  const existing = await sqlite.isConnection(DB_NAME, false);
  const database = existing.result
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);

  if (!(await database.isDBOpen()).result) await database.open();

  return {
    execute: (sql) => database.execute(sql),
    query: async (sql, params) => (await database.query(sql, params)).values || [],
    run: async (sql, params) => {
      const res = await database.run(sql, params, false);
      return {
        changes: res.changes?.changes ?? 0,
        lastId: res.changes?.lastId ?? null,
      };
    },
    // `true` = une seule transaction pour tout le lot. Sans elle, chaque ligne
    // est validée séparément : la restauration d'une grosse sauvegarde passait
    // de quelques secondes à plus d'une minute.
    runMany: (statements) =>
      database.executeSet(
        statements.map(({ sql, params }) => ({ statement: sql, values: params })),
        true
      ),
  };
}

// Ouvre la base et crée les tables. Idempotent : appelable de partout.
export function initDb() {
  if (ready) return ready;
  ready = (async () => {
    engine = isWeb ? await createWebEngine() : await createNativeEngine();
    await engine.execute('PRAGMA foreign_keys = ON;');
    await engine.execute(SCHEMA);
    await migrateSchema();
    await ensureDefaultProfile();
    return engine;
  })();
  return ready;
}

// --- Accès bas niveau ---

export async function query(sql, params = []) {
  await initDb();
  return engine.query(sql, params);
}

export async function run(sql, params = []) {
  await initDb();
  return engine.run(sql, params);
}

// Plusieurs écritures en un seul bloc (cocher toute une saison).
export async function runMany(statements) {
  if (statements.length === 0) return;
  await initDb();
  return engine.runMany(statements);
}

// --- Migrations de schéma ---
//
// Les bases déjà installées sur les téléphones ne connaissent pas les colonnes
// ajoutées après coup. On les ajoute ici, une par une, sans jamais toucher aux
// données existantes : `ALTER TABLE ... ADD COLUMN` conserve toutes les lignes.
// Chaque migration est vérifiée avant d'être appliquée, donc rejouable sans
// risque à chaque démarrage.
async function migrateSchema() {
  // Langue dans laquelle la fiche enregistrée a été téléchargée. Vide pour les
  // bases d'avant ce réglage : elles seront renseignées au premier choix de
  // langue, sans re-télécharger quoi que ce soit si la langue ne change pas.
  await addColumnIfMissing('suivi', 'lang', 'TEXT');
}

async function addColumnIfMissing(table, column, type) {
  const cols = await engine.query(`PRAGMA table_info(${table})`, []);
  if (cols.some((c) => c.name === column)) return;
  await engine.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

// Garantit qu'au moins un profil existe (base neuve incluse), et renvoie son id.
// Appelée pendant l'initialisation : utilise le moteur directement, sinon elle
// s'attendrait elle-même.
async function ensureDefaultProfile() {
  const rows = await engine.query('SELECT id FROM profiles ORDER BY created_at LIMIT 1', []);
  if (rows.length > 0) return rows[0].id;
  const id = crypto.randomUUID();
  await engine.run('INSERT INTO profiles (id, name) VALUES (?, ?)', [id, 'Mon profil']);
  return id;
}

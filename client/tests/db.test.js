// La base embarquée : ce sur quoi tout le reste repose.
//
// On vérifie ici ce qui ferait perdre des données sans qu'on s'en aperçoive :
// le schéma réellement créé, les suppressions en cascade, la migration d'une
// base déjà installée sur un téléphone, et le profil par défaut.
import { describe, it, expect, beforeEach, vi } from 'vitest';

let db;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  db = await import('../src/db.js');
  await db.initDb();
});

describe('base embarquée', () => {
  it('crée les 5 tables du schéma', async () => {
    const rows = await db.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    );
    const tables = rows.map((r) => r.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        'profiles',
        'suivi',
        'episodes_vus',
        'listes',
        'liste_items',
      ])
    );
  });

  it('garantit un profil par défaut sur une installation neuve', async () => {
    const profils = await db.query('SELECT id, name FROM profiles');
    expect(profils).toHaveLength(1);
    expect(profils[0].name).toBe('Mon profil');
    // L'identifiant est un UUID portable, pas un numéro de ligne.
    expect(profils[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('applique la migration de la colonne « lang », et sait la rejouer', async () => {
    const colonnes = await db.query('PRAGMA table_info(suivi)');
    expect(colonnes.map((c) => c.name)).toContain('lang');

    // Un second démarrage ne doit rien casser (initDb est appelable partout).
    await expect(db.initDb()).resolves.toBeTruthy();
  });

  it('supprime en cascade tout ce qui appartient à un profil', async () => {
    const [{ id }] = await db.query('SELECT id FROM profiles');
    await db.run(
      "INSERT INTO suivi (profile_id, tmdb_id, media_type, title) VALUES (?, 1, 'tv', 'X')",
      [id]
    );
    await db.run(
      'INSERT INTO episodes_vus (profile_id, series_id, season_number, episode_number) VALUES (?, 1, 1, 1)',
      [id]
    );
    const { lastId } = await db.run('INSERT INTO listes (profile_id, name) VALUES (?, ?)', [
      id,
      'Soirée',
    ]);
    await db.run(
      "INSERT INTO liste_items (liste_id, profile_id, tmdb_id, media_type) VALUES (?, ?, 1, 'tv')",
      [lastId, id]
    );

    await db.run('DELETE FROM profiles WHERE id = ?', [id]);

    for (const table of ['suivi', 'episodes_vus', 'listes', 'liste_items']) {
      const restant = await db.query(`SELECT COUNT(*) AS n FROM ${table}`);
      expect(restant[0].n, `${table} devrait être vide`).toBe(0);
    }
  });

  it('refuse un élément de liste qui ne serait pas dans le suivi', async () => {
    const [{ id }] = await db.query('SELECT id FROM profiles');
    const { lastId } = await db.run('INSERT INTO listes (profile_id, name) VALUES (?, ?)', [
      id,
      'Soirée',
    ]);
    await expect(
      db.run(
        "INSERT INTO liste_items (liste_id, profile_id, tmdb_id, media_type) VALUES (?, ?, 999, 'movie')",
        [lastId, id]
      )
    ).rejects.toThrow();
  });

  it('écrit tout le lot ou rien du tout (runMany)', async () => {
    const [{ id }] = await db.query('SELECT id FROM profiles');
    await expect(
      db.runMany([
        {
          sql: "INSERT INTO suivi (profile_id, tmdb_id, media_type, title) VALUES (?, 1, 'movie', 'Bon')",
          params: [id],
        },
        // Profil inexistant : la clé étrangère refuse, tout le lot doit tomber.
        {
          sql: "INSERT INTO suivi (profile_id, tmdb_id, media_type, title) VALUES ('inconnu', 2, 'movie', 'Mauvais')",
          params: [],
        },
      ])
    ).rejects.toThrow();
    const suivi = await db.query('SELECT tmdb_id FROM suivi');
    expect(suivi).toHaveLength(0);
  });
});

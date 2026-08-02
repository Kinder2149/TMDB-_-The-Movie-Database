import { getDb } from './database.js';

// Accès à la table des épisodes vus (couche Données). Présence = vu.

export function listWatchedEpisodes(seriesId) {
  return getDb()
    .prepare(
      `SELECT season_number AS season, episode_number AS episode
       FROM episodes_vus WHERE series_id = ?`
    )
    .all(seriesId);
}

export function markEpisode(seriesId, season, episode) {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO episodes_vus (series_id, season_number, episode_number)
       VALUES (?, ?, ?)`
    )
    .run(seriesId, season, episode);
}

export function unmarkEpisode(seriesId, season, episode) {
  getDb()
    .prepare(
      `DELETE FROM episodes_vus
       WHERE series_id = ? AND season_number = ? AND episode_number = ?`
    )
    .run(seriesId, season, episode);
}

// Coche toute une saison d'un coup (liste des numéros d'épisodes).
export function markSeason(seriesId, season, episodeNumbers) {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO episodes_vus (series_id, season_number, episode_number)
     VALUES (?, ?, ?)`
  );
  const run = db.transaction((nums) => {
    for (const e of nums) stmt.run(seriesId, season, e);
  });
  run(episodeNumbers);
}

export function unmarkSeason(seriesId, season) {
  getDb()
    .prepare('DELETE FROM episodes_vus WHERE series_id = ? AND season_number = ?')
    .run(seriesId, season);
}

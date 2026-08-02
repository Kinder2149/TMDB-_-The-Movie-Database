import { getDb } from './database.js';

// Accès à la table des épisodes vus (couche Données). Présence = vu.
// Scopé par profil (profileId en 1er paramètre).

export function listWatchedEpisodes(profileId, seriesId) {
  return getDb()
    .prepare(
      `SELECT season_number AS season, episode_number AS episode
       FROM episodes_vus WHERE profile_id = ? AND series_id = ?`
    )
    .all(profileId, seriesId);
}

export function markEpisode(profileId, seriesId, season, episode) {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO episodes_vus (profile_id, series_id, season_number, episode_number)
       VALUES (?, ?, ?, ?)`
    )
    .run(profileId, seriesId, season, episode);
}

export function unmarkEpisode(profileId, seriesId, season, episode) {
  getDb()
    .prepare(
      `DELETE FROM episodes_vus
       WHERE profile_id = ? AND series_id = ? AND season_number = ? AND episode_number = ?`
    )
    .run(profileId, seriesId, season, episode);
}

// Coche toute une saison d'un coup (liste des numéros d'épisodes).
export function markSeason(profileId, seriesId, season, episodeNumbers) {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO episodes_vus (profile_id, series_id, season_number, episode_number)
     VALUES (?, ?, ?, ?)`
  );
  const run = db.transaction((nums) => {
    for (const e of nums) stmt.run(profileId, seriesId, season, e);
  });
  run(episodeNumbers);
}

export function unmarkSeason(profileId, seriesId, season) {
  getDb()
    .prepare(
      'DELETE FROM episodes_vus WHERE profile_id = ? AND series_id = ? AND season_number = ?'
    )
    .run(profileId, seriesId, season);
}

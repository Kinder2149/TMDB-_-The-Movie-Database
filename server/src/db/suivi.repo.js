import { getDb } from './database.js';

// Accès à la table de suivi (couche Données). Aucune logique métier ici.

// listStatus classe chaque titre dans une des deux listes V1 :
//  - 'a_voir'      → liste « À voir »
//  - 'vu_encours'  → liste « Vu / En cours »
// Film : selon status. Série : selon qu'au moins un épisode est vu.
export function listSuivi() {
  return getDb()
    .prepare(
      `SELECT
         s.tmdb_id AS id,
         s.media_type AS mediaType,
         s.title,
         s.year,
         s.poster_url AS posterUrl,
         s.status,
         CASE
           WHEN s.media_type = 'movie' THEN
             CASE WHEN s.status = 'vu' THEN 'vu_encours' ELSE 'a_voir' END
           ELSE
             CASE WHEN EXISTS (
               SELECT 1 FROM episodes_vus e WHERE e.series_id = s.tmdb_id
             ) THEN 'vu_encours' ELSE 'a_voir' END
         END AS listStatus
       FROM suivi s
       ORDER BY s.added_at DESC`
    )
    .all();
}

// Change l'état vu/à voir d'un film. Renvoie true si une ligne a été modifiée.
export function setStatus(id, mediaType, status) {
  const info = getDb()
    .prepare('UPDATE suivi SET status = ? WHERE tmdb_id = ? AND media_type = ?')
    .run(status, id, mediaType);
  return info.changes > 0;
}

// Idempotent : ré-ajouter un élément déjà suivi ne crée pas de doublon.
export function addToSuivi(item) {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO suivi (tmdb_id, media_type, title, year, poster_url)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(item.id, item.mediaType, item.title, item.year, item.posterUrl);
}

export function removeFromSuivi(id, mediaType) {
  getDb()
    .prepare('DELETE FROM suivi WHERE tmdb_id = ? AND media_type = ?')
    .run(id, mediaType);
}

import { getDb } from './database.js';

// Accès aux listes personnalisées et à leurs éléments (couche Données).

export function listListes(profileId) {
  return getDb()
    .prepare(
      `SELECT l.id, l.name,
              (SELECT COUNT(*) FROM liste_items li WHERE li.liste_id = l.id) AS count
       FROM listes l
       WHERE l.profile_id = ?
       ORDER BY l.created_at`
    )
    .all(profileId);
}

export function createListe(profileId, name) {
  const info = getDb()
    .prepare('INSERT INTO listes (profile_id, name) VALUES (?, ?)')
    .run(profileId, name);
  return { id: info.lastInsertRowid, name, count: 0 };
}

export function renameListe(profileId, id, name) {
  const info = getDb()
    .prepare('UPDATE listes SET name = ? WHERE id = ? AND profile_id = ?')
    .run(name, id, profileId);
  return info.changes > 0;
}

export function deleteListe(profileId, id) {
  const info = getDb()
    .prepare('DELETE FROM listes WHERE id = ? AND profile_id = ?')
    .run(id, profileId);
  return info.changes > 0;
}

// Éléments d'une liste, avec métadonnées + statut (jointure sur le suivi).
export function listItems(profileId, listeId) {
  return getDb()
    .prepare(
      `SELECT s.tmdb_id AS id, s.media_type AS mediaType, s.title, s.year,
              s.poster_url AS posterUrl, s.status
       FROM liste_items li
       JOIN suivi s
         ON s.profile_id = li.profile_id
        AND s.tmdb_id = li.tmdb_id
        AND s.media_type = li.media_type
       WHERE li.liste_id = ? AND li.profile_id = ?
       ORDER BY li.added_at DESC`
    )
    .all(listeId, profileId);
}

export function addItem(profileId, listeId, tmdbId, mediaType) {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO liste_items (liste_id, profile_id, tmdb_id, media_type)
       VALUES (?, ?, ?, ?)`
    )
    .run(listeId, profileId, tmdbId, mediaType);
}

export function removeItem(profileId, listeId, tmdbId, mediaType) {
  getDb()
    .prepare(
      `DELETE FROM liste_items
       WHERE liste_id = ? AND profile_id = ? AND tmdb_id = ? AND media_type = ?`
    )
    .run(listeId, profileId, tmdbId, mediaType);
}

// Ids des listes contenant un titre (pour cocher dans la fiche).
export function listesForItem(profileId, tmdbId, mediaType) {
  return getDb()
    .prepare(
      `SELECT liste_id AS listeId FROM liste_items
       WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?`
    )
    .all(profileId, tmdbId, mediaType)
    .map((r) => r.listeId);
}

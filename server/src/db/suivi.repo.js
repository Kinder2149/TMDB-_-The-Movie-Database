import { getDb } from './database.js';

// Accès à la table de suivi (couche Données). Aucune logique métier ici.
// Toutes les fonctions sont *scopées par profil* (profileId en 1er paramètre) :
// une donnée de suivi appartient toujours à un profil.

// Chaque titre porte un statut parmi : 'a_voir' | 'en_cours' | 'vu' | 'abandonne'.
// Films : choisi par l'utilisateur. Séries : dérivé des épisodes par l'UI
// (sauf 'abandonne', manuel). La classification en listes lit ce statut.
export function listSuivi(profileId) {
  return getDb()
    .prepare(
      `SELECT
         s.tmdb_id AS id,
         s.media_type AS mediaType,
         s.title,
         s.year,
         s.release_date AS releaseDate,
         s.poster_url AS posterUrl,
         s.status
       FROM suivi s
       WHERE s.profile_id = ?
       ORDER BY s.added_at DESC`
    )
    .all(profileId);
}

// Change l'état vu/à voir d'un film. Renvoie true si une ligne a été modifiée.
export function setStatus(profileId, id, mediaType, status) {
  const info = getDb()
    .prepare(
      'UPDATE suivi SET status = ? WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?'
    )
    .run(status, profileId, id, mediaType);
  return info.changes > 0;
}

// Idempotent : ré-ajouter un élément déjà suivi ne crée pas de doublon.
export function addToSuivi(profileId, item) {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO suivi (profile_id, tmdb_id, media_type, title, year, release_date, poster_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      profileId,
      item.id,
      item.mediaType,
      item.title,
      item.year,
      item.releaseDate ?? null,
      item.posterUrl
    );
}

export function removeFromSuivi(profileId, id, mediaType) {
  getDb()
    .prepare('DELETE FROM suivi WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?')
    .run(profileId, id, mediaType);
}

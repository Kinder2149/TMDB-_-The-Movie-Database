// Couche Logique — les règles métier qui vivaient dans les routes du serveur.
//
// Déplacé depuis server/src/routes/ et server/src/db/*.repo.js (tranche 2 du
// PLAN_ANDROID). Les requêtes SQL sont reprises telles quelles ; ce qui
// disparaît, c'est l'emballage HTTP (statuts 400/404, req/res) devenu inutile
// une fois le serveur supprimé.
//
// Toutes les fonctions sont scopées par profil (profileId en 1er paramètre) :
// une donnée de suivi appartient toujours à un profil.

import { query, run, runMany } from './db.js';
import { getSeasons, getEpisodes, getRecommendations } from './tmdb.js';

// --- Profils ---

// L'ouverture de la base garantit déjà un profil par défaut : cette liste
// n'est jamais vide, même sur une installation neuve.
export function listProfiles() {
  return query('SELECT id, name, created_at AS createdAt FROM profiles ORDER BY created_at');
}

export async function createProfile(name) {
  const id = crypto.randomUUID();
  await run('INSERT INTO profiles (id, name) VALUES (?, ?)', [id, name]);
  return { id, name };
}

export async function renameProfile(id, name) {
  const { changes } = await run('UPDATE profiles SET name = ? WHERE id = ?', [name, id]);
  if (changes === 0) throw new Error('Profil introuvable.');
}

// --- Suivi ---

const STATUSES = ['a_voir', 'en_cours', 'vu', 'abandonne'];

export function listSuivi(profileId) {
  return query(
    `SELECT s.tmdb_id AS id, s.media_type AS mediaType, s.title, s.year,
            s.release_date AS releaseDate, s.poster_url AS posterUrl, s.status
     FROM suivi s
     WHERE s.profile_id = ?
     ORDER BY s.added_at DESC`,
    [profileId]
  );
}

// Idempotent : ré-ajouter un élément déjà suivi ne crée pas de doublon.
export async function addToSuivi(profileId, item) {
  if (!item?.id || !item?.mediaType || !item?.title) {
    throw new Error('Champs requis manquants.');
  }
  await run(
    `INSERT OR IGNORE INTO suivi
       (profile_id, tmdb_id, media_type, title, year, release_date, poster_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      profileId,
      item.id,
      item.mediaType,
      item.title,
      item.year ?? null,
      item.releaseDate ?? null,
      item.posterUrl ?? null,
    ]
  );
}

export async function removeFromSuivi(profileId, mediaType, id) {
  await run('DELETE FROM suivi WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?', [
    profileId,
    id,
    mediaType,
  ]);
}

export async function setStatus(profileId, mediaType, id, status) {
  if (!STATUSES.includes(status)) throw new Error('Statut invalide.');
  const { changes } = await run(
    'UPDATE suivi SET status = ? WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?',
    [status, profileId, id, mediaType]
  );
  if (changes === 0) throw new Error('Titre absent du suivi.');
}

// --- Épisodes vus (présence d'une ligne = épisode vu) ---

function listWatchedEpisodes(profileId, seriesId) {
  return query(
    `SELECT season_number AS season, episode_number AS episode
     FROM episodes_vus WHERE profile_id = ? AND series_id = ?`,
    [profileId, seriesId]
  );
}

export async function markEpisode(profileId, seriesId, season, episode) {
  await run(
    `INSERT OR IGNORE INTO episodes_vus
       (profile_id, series_id, season_number, episode_number)
     VALUES (?, ?, ?, ?)`,
    [profileId, seriesId, season, episode]
  );
}

export async function unmarkEpisode(profileId, seriesId, season, episode) {
  await run(
    `DELETE FROM episodes_vus
     WHERE profile_id = ? AND series_id = ? AND season_number = ? AND episode_number = ?`,
    [profileId, seriesId, season, episode]
  );
}

// Coche toute une saison d'un coup (un seul bloc d'écriture).
export async function markWholeSeason(profileId, seriesId, season, episodeNumbers) {
  await runMany(
    episodeNumbers.map((e) => ({
      sql: `INSERT OR IGNORE INTO episodes_vus
              (profile_id, series_id, season_number, episode_number)
            VALUES (?, ?, ?, ?)`,
      params: [profileId, seriesId, season, e],
    }))
  );
}

export async function unmarkWholeSeason(profileId, seriesId, season) {
  await run(
    'DELETE FROM episodes_vus WHERE profile_id = ? AND series_id = ? AND season_number = ?',
    [profileId, seriesId, season]
  );
}

// Épisodes d'une saison (TMDB) enrichis de leur état vu (base locale).
export async function getSeasonEpisodes(profileId, seriesId, season) {
  const episodes = await getEpisodes(seriesId, season);
  const rows = await listWatchedEpisodes(profileId, seriesId);
  const watched = new Set(rows.filter((e) => e.season === season).map((e) => e.episode));
  return episodes.map((e) => ({ ...e, watched: watched.has(e.episodeNumber) }));
}

// Progression d'une série : { total, watched, next }.
// Prochain à voir = premier épisode non coché, dans l'ordre, déjà diffusé.
export async function getProgress(profileId, seriesId) {
  const seasons = [...(await getSeasons(seriesId))].sort(
    (a, b) => a.seasonNumber - b.seasonNumber
  );
  const watched = await listWatchedEpisodes(profileId, seriesId);

  const total = seasons.reduce((sum, s) => sum + s.episodeCount, 0);

  const watchedBySeason = new Map();
  for (const w of watched) {
    if (!watchedBySeason.has(w.season)) watchedBySeason.set(w.season, new Set());
    watchedBySeason.get(w.season).add(w.episode);
  }

  const today = new Date().toISOString().slice(0, 10);
  let next = null;
  for (const s of seasons) {
    const seen = watchedBySeason.get(s.seasonNumber) || new Set();
    if (seen.size >= s.episodeCount) continue; // saison complète
    const eps = [...(await getEpisodes(seriesId, s.seasonNumber))].sort(
      (a, b) => a.episodeNumber - b.episodeNumber
    );
    const firstUnwatched = eps.find((e) => !seen.has(e.episodeNumber));
    if (firstUnwatched) {
      if (firstUnwatched.airDate && firstUnwatched.airDate <= today) {
        next = {
          season: s.seasonNumber,
          episode: firstUnwatched.episodeNumber,
          name: firstUnwatched.name,
        };
      }
      break; // premier non-vu trouvé (diffusé → next ; à venir → à jour)
    }
  }

  return { total, watched: watched.length, next };
}

// --- Listes personnalisées ---

export function listListes(profileId) {
  return query(
    `SELECT l.id, l.name,
            (SELECT COUNT(*) FROM liste_items li WHERE li.liste_id = l.id) AS count
     FROM listes l
     WHERE l.profile_id = ?
     ORDER BY l.created_at`,
    [profileId]
  );
}

export async function createListe(profileId, name) {
  const { lastId } = await run('INSERT INTO listes (profile_id, name) VALUES (?, ?)', [
    profileId,
    name,
  ]);
  return { id: lastId, name, count: 0 };
}

export async function deleteListe(profileId, id) {
  await run('DELETE FROM listes WHERE id = ? AND profile_id = ?', [id, profileId]);
}

export function getListeItems(profileId, listeId) {
  return query(
    `SELECT s.tmdb_id AS id, s.media_type AS mediaType, s.title, s.year,
            s.release_date AS releaseDate, s.poster_url AS posterUrl, s.status
     FROM liste_items li
     JOIN suivi s
       ON s.profile_id = li.profile_id
      AND s.tmdb_id = li.tmdb_id
      AND s.media_type = li.media_type
     WHERE li.liste_id = ? AND li.profile_id = ?
     ORDER BY li.added_at DESC`,
    [listeId, profileId]
  );
}

// « Ajouter à une liste = suivre » : on garantit la présence dans le suivi.
export async function addToListe(profileId, listeId, item) {
  await addToSuivi(profileId, item);
  await run(
    `INSERT OR IGNORE INTO liste_items (liste_id, profile_id, tmdb_id, media_type)
     VALUES (?, ?, ?, ?)`,
    [listeId, profileId, item.id, item.mediaType]
  );
}

export async function removeFromListe(profileId, listeId, mediaType, tmdbId) {
  await run(
    `DELETE FROM liste_items
     WHERE liste_id = ? AND profile_id = ? AND tmdb_id = ? AND media_type = ?`,
    [listeId, profileId, tmdbId, mediaType]
  );
}

// Ids des listes contenant un titre (pour cocher dans la fiche).
export async function getItemListes(profileId, mediaType, tmdbId) {
  const rows = await query(
    `SELECT liste_id AS listeId FROM liste_items
     WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?`,
    [profileId, tmdbId, mediaType]
  );
  return rows.map((r) => r.listeId);
}

// --- Suggestions ---

// Agrège les recommandations TMDB des titres vus / en cours, écarte ce qui est
// déjà suivi, et classe par nombre de recommandations puis popularité.
export async function getSuggestions(profileId) {
  const suivi = await listSuivi(profileId);
  const suiviKeys = new Set(suivi.map((i) => `${i.mediaType}-${i.id}`));

  // Graines : ce qu'on a vu ou commencé en priorité, sinon tout le suivi.
  let seeds = suivi.filter((i) => i.status === 'vu' || i.status === 'en_cours');
  if (seeds.length === 0) seeds = [...suivi];
  // Mélange : « Actualiser » propose d'autres suggestions à chaque appel.
  for (let i = seeds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
  }
  seeds = seeds.slice(0, 12); // borne le nombre d'appels TMDB

  const lists = await Promise.all(
    seeds.map((s) =>
      getRecommendations(s.mediaType, s.id)
        .then((recs) => ({ seed: s, recs }))
        .catch(() => ({ seed: s, recs: [] }))
    )
  );

  const agg = new Map();
  for (const { seed, recs } of lists) {
    for (const r of recs) {
      const key = `${r.mediaType}-${r.id}`;
      if (suiviKeys.has(key)) continue; // déjà dans le suivi
      const cur = agg.get(key);
      if (cur) {
        cur.score += 1;
        if (r._pop > cur._pop) cur._pop = r._pop;
      } else {
        agg.set(key, { ...r, score: 1, reason: seed.title });
      }
    }
  }

  return [...agg.values()]
    .sort((a, b) => b.score - a.score || b._pop - a._pop)
    .slice(0, 30)
    .map(({ _pop, score, ...rest }) => rest);
}

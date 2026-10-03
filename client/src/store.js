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
import {
  getSeriesStructure,
  getEpisodes,
  getRecommendations,
  getCardInfo,
  getRuntime,
  getNotifInfo,
} from './tmdb.js';
import { TMDB_LANG, getCatalogLanguage, getCatalogRegion } from './lang.js';
import { classifyNotif } from './status.js';

// --- Profils ---

// L'ouverture de la base garantit déjà un profil par défaut : cette liste
// n'est jamais vide, même sur une installation neuve.
export function listProfiles() {
  return query(
    `SELECT p.id, p.name, p.avatar, p.created_at AS createdAt,
            (SELECT COUNT(*) FROM suivi s WHERE s.profile_id = p.id) AS titres
     FROM profiles p ORDER BY p.created_at`
  );
}

export async function createProfile(name, avatar = null) {
  const id = crypto.randomUUID();
  await run('INSERT INTO profiles (id, name, avatar) VALUES (?, ?, ?)', [id, name, avatar]);
  return { id, name, avatar };
}

export async function renameProfile(id, name) {
  const { changes } = await run('UPDATE profiles SET name = ? WHERE id = ?', [name, id]);
  if (changes === 0) throw new Error('Profil introuvable.');
}

export async function setProfileAvatar(id, avatar) {
  const { changes } = await run('UPDATE profiles SET avatar = ? WHERE id = ?', [
    avatar || null,
    id,
  ]);
  if (changes === 0) throw new Error('Profil introuvable.');
}

// Ce qu'un profil emporterait avec lui : sert à l'annoncer avant de supprimer.
export async function countProfileData(id) {
  const [titres] = await query('SELECT COUNT(*) AS n FROM suivi WHERE profile_id = ?', [id]);
  const [episodes] = await query(
    'SELECT COUNT(*) AS n FROM episodes_vus WHERE profile_id = ?',
    [id]
  );
  const [listes] = await query('SELECT COUNT(*) AS n FROM listes WHERE profile_id = ?', [id]);
  return { titres: titres.n, episodes: episodes.n, listes: listes.n };
}

// Supprime un profil et **tout** son contenu (les cascades de la base s'en
// chargent : suivi, épisodes vus, listes).
//
// On refuse de supprimer le dernier profil : l'application n'a de sens qu'avec
// au moins un, et l'ouverture en recréerait un vide dans la foulée — autant
// le dire clairement plutôt que de faire disparaître les données sans raison
// visible. La sauvegarde Drive du profil, elle, n'est pas touchée : c'est le
// filet de sécurité, il doit survivre à une suppression locale.
export async function deleteProfile(id) {
  const profils = await listProfiles();
  if (!profils.some((p) => p.id === id)) throw new Error('Profil introuvable.');
  if (profils.length <= 1) {
    throw new Error("C'est le seul profil : il ne peut pas être supprimé.");
  }
  // Les cascades de la base le feraient, mais elles dépendent d'un réglage de
  // connexion : on efface explicitement, dans l'ordre, pour que la suppression
  // soit complète sur les deux moteurs (téléphone et PC).
  await run(
    'DELETE FROM liste_items WHERE liste_id IN (SELECT id FROM listes WHERE profile_id = ?)',
    [id]
  );
  await run('DELETE FROM listes WHERE profile_id = ?', [id]);
  await run('DELETE FROM partage WHERE profile_id = ?', [id]);
  await run('DELETE FROM amis WHERE profile_id = ?', [id]);
  await run('DELETE FROM episodes_vus WHERE profile_id = ?', [id]);
  await run('DELETE FROM suivi WHERE profile_id = ?', [id]);
  await run('DELETE FROM profiles WHERE id = ?', [id]);
  return profils.find((p) => p.id !== id).id; // profil sur lequel se rabattre
}

// --- Suivi ---

const STATUSES = ['a_voir', 'en_cours', 'vu', 'abandonne'];

export function listSuivi(profileId) {
  return query(
    `SELECT s.tmdb_id AS id, s.media_type AS mediaType, s.title, s.year,
            s.release_date AS releaseDate, s.poster_url AS posterUrl, s.status,
            s.note, s.rating, s.genres, s.added_at AS addedAt
     FROM suivi s
     WHERE s.profile_id = ?
     ORDER BY s.added_at DESC`,
    [profileId]
  );
}

// --- Note personnelle ---
//
// Un avis écrit et une note en étoiles, tous deux facultatifs. Ils vivent sur
// la ligne de suivi : retirer un titre du suivi emporte donc sa note, ce qui
// est le comportement attendu (on ne garde pas l'avis d'un titre qu'on ne
// suit plus).

export async function getNote(profileId, mediaType, id) {
  const [row] = await query(
    'SELECT note, rating FROM suivi WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?',
    [profileId, id, mediaType]
  );
  return row ? { note: row.note ?? '', rating: row.rating ?? null } : null;
}

export async function setNote(profileId, mediaType, id, { note, rating }) {
  if (rating != null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
    throw new Error('Note invalide.');
  }
  const texte = (note ?? '').trim();
  const { changes } = await run(
    `UPDATE suivi SET note = ?, rating = ?
     WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?`,
    [texte || null, rating ?? null, profileId, id, mediaType]
  );
  if (changes === 0) throw new Error('Titre absent du suivi.');
}

// Idempotent : ré-ajouter un élément déjà suivi ne crée pas de doublon.
export async function addToSuivi(profileId, item) {
  if (!item?.id || !item?.mediaType || !item?.title) {
    throw new Error('Champs requis manquants.');
  }
  await run(
    `INSERT OR IGNORE INTO suivi
       (profile_id, tmdb_id, media_type, title, year, release_date, poster_url, lang, genres)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profileId,
      item.id,
      item.mediaType,
      item.title,
      item.year ?? null,
      item.releaseDate ?? null,
      item.posterUrl ?? null,
      getCatalogLanguage(),
      item.genreKeys ? item.genreKeys.join(',') : null,
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
  // Pour un film, passer à « Vu » pour la première fois pose un premier
  // visionnage à la date du jour (M4, D2) — sans dupliquer si on repasse par
  // « Vu » après un aller-retour vers un autre statut.
  const [avant] = await query(
    'SELECT status FROM suivi WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?',
    [profileId, id, mediaType]
  );
  const { changes } = await run(
    'UPDATE suivi SET status = ? WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?',
    [status, profileId, id, mediaType]
  );
  if (changes === 0) throw new Error('Titre absent du suivi.');
  if (mediaType === 'movie' && status === 'vu' && avant?.status !== 'vu') {
    await addVisionnage(profileId, mediaType, id, {});
  }
  // Terminé ou abandonné : plus la peine de surveiller une sortie ou un
  // prochain épisode pour un titre que l'utilisateur ne suit plus vraiment.
  if (status === 'vu' || status === 'abandonne') {
    await run(
      `UPDATE suivi SET notif_en_attente = 0
       WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?`,
      [profileId, id, mediaType]
    );
  }
}

// --- Journal de visionnages (M4) ---
//
// Une ligne par visionnage — pas un compteur — pour pouvoir répondre à « la
// dernière fois, c'était quand ? » et pas seulement « combien de fois ».
// Séparé du suivi et des épisodes cochés : cocher un épisode dit « je l'ai vu
// (au moins une fois) », le journal dit « et voici quand, à chaque fois ».
// `season`/`episode` restent vides pour un film.
export async function addVisionnage(profileId, mediaType, tmdbId, { season, episode, date } = {}) {
  await run(
    `INSERT INTO visionnages (profile_id, tmdb_id, media_type, season_number, episode_number, date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [profileId, tmdbId, mediaType, season ?? null, episode ?? null, date || today()]
  );
}

// Tous les visionnages d'un titre, du plus récent au plus ancien.
export function listVisionnages(profileId, mediaType, tmdbId) {
  return query(
    `SELECT id, season_number AS season, episode_number AS episode, date
     FROM visionnages
     WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?
     ORDER BY date DESC, id DESC`,
    [profileId, tmdbId, mediaType]
  );
}

export async function deleteVisionnage(profileId, id) {
  await run('DELETE FROM visionnages WHERE id = ? AND profile_id = ?', [id, profileId]);
}

// Corrige la date d'un visionnage (« en fait, c'était en 2019 »). Une date
// invalide est refusée : la colonne ne doit jamais contenir autre chose
// qu'AAAA-MM-JJ, les tris et la sauvegarde s'y fient.
export async function updateVisionnageDate(profileId, id, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || Number.isNaN(Date.parse(date))) {
    throw new Error('Date invalide.');
  }
  await run('UPDATE visionnages SET date = ? WHERE id = ? AND profile_id = ?', [
    date,
    id,
    profileId,
  ]);
}

// « J'ai revu toute la saison » : un visionnage de plus pour chaque épisode
// déjà vu de la saison. Les épisodes pas cochés ne sont pas touchés — revoir
// n'est pas voir. Renvoie le nombre d'épisodes concernés.
export async function rewatchSeason(profileId, seriesId, season, date) {
  const vus = (await listWatchedEpisodes(profileId, seriesId)).filter(
    (e) => e.season === season
  );
  const jour = date || today();
  await runMany(
    vus.map((e) => ({
      sql: `INSERT INTO visionnages
              (profile_id, tmdb_id, media_type, season_number, episode_number, date)
            VALUES (?, ?, 'tv', ?, ?, ?)`,
      params: [profileId, seriesId, season, e.episode, jour],
    }))
  );
  return vus.length;
}

function today() {
  return new Date().toISOString().slice(0, 10);
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
  const { changes } = await run(
    `INSERT OR IGNORE INTO episodes_vus
       (profile_id, series_id, season_number, episode_number)
     VALUES (?, ?, ?, ?)`,
    [profileId, seriesId, season, episode]
  );
  // `changes === 0` : l'épisode était déjà coché, on ne repose pas un
  // visionnage à chaque clic — « J'ai revu cet épisode » sert à ça.
  if (changes > 0) {
    await addVisionnage(profileId, 'tv', seriesId, { season, episode });
  }
}

export async function unmarkEpisode(profileId, seriesId, season, episode) {
  await run(
    `DELETE FROM episodes_vus
     WHERE profile_id = ? AND series_id = ? AND season_number = ? AND episode_number = ?`,
    [profileId, seriesId, season, episode]
  );
}

// Coche toute une saison d'un coup (un seul bloc d'écriture). Ne pose un
// visionnage que pour les épisodes qui n'étaient pas déjà cochés : sinon,
// recocher une saison déjà vue en repasserait tous les épisodes pour vus « à
// l'instant », faussant le journal.
export async function markWholeSeason(profileId, seriesId, season, episodeNumbers) {
  const deja = new Set(
    (await listWatchedEpisodes(profileId, seriesId))
      .filter((e) => e.season === season)
      .map((e) => e.episode)
  );
  const nouveaux = episodeNumbers.filter((e) => !deja.has(e));
  const date = today();
  await runMany([
    ...episodeNumbers.map((e) => ({
      sql: `INSERT OR IGNORE INTO episodes_vus
              (profile_id, series_id, season_number, episode_number)
            VALUES (?, ?, ?, ?)`,
      params: [profileId, seriesId, season, e],
    })),
    ...nouveaux.map((e) => ({
      sql: `INSERT INTO visionnages
              (profile_id, tmdb_id, media_type, season_number, episode_number, date)
            VALUES (?, ?, 'tv', ?, ?, ?)`,
      params: [profileId, seriesId, season, e, date],
    })),
  ]);
}

export async function unmarkWholeSeason(profileId, seriesId, season) {
  await run(
    'DELETE FROM episodes_vus WHERE profile_id = ? AND series_id = ? AND season_number = ?',
    [profileId, seriesId, season]
  );
}

// Marque d'un coup tous les épisodes *déjà diffusés* d'une saison. On va
// chercher la vraie liste des épisodes plutôt que de supposer une numérotation
// de 1 à N : certaines saisons ont des trous.
export async function markSeasonWatched(profileId, seriesId, season) {
  const numeros = airedOnly(await getEpisodes(seriesId, season));
  await markWholeSeason(profileId, seriesId, season, numeros);
  return numeros.length;
}

// « J'ai vu toute la série » : tout ce qui est sorti, saison par saison.
// Les épisodes annoncés mais pas encore diffusés ne sont pas cochés — sinon
// la série serait déclarée finie avant de l'être.
export async function markSeriesWatched(profileId, seriesId) {
  const { seasons } = await getSeriesStructure(seriesId);
  const deja = new Set(
    (await listWatchedEpisodes(profileId, seriesId)).map((e) => `${e.season}-${e.episode}`)
  );
  const date = today();
  const ecritures = [];
  let coches = 0;
  for (const s of seasons) {
    for (const numero of airedOnly(await getEpisodes(seriesId, s.seasonNumber))) {
      coches += 1;
      ecritures.push({
        sql: `INSERT OR IGNORE INTO episodes_vus
                (profile_id, series_id, season_number, episode_number)
              VALUES (?, ?, ?, ?)`,
        params: [profileId, seriesId, s.seasonNumber, numero],
      });
      if (!deja.has(`${s.seasonNumber}-${numero}`)) {
        ecritures.push({
          sql: `INSERT INTO visionnages
                  (profile_id, tmdb_id, media_type, season_number, episode_number, date)
                VALUES (?, ?, 'tv', ?, ?, ?)`,
          params: [profileId, seriesId, s.seasonNumber, numero, date],
        });
      }
    }
  }
  await runMany(ecritures);
  return coches;
}

export async function unmarkSeriesWatched(profileId, seriesId) {
  await run('DELETE FROM episodes_vus WHERE profile_id = ? AND series_id = ?', [
    profileId,
    seriesId,
  ]);
}

// Numéros des épisodes déjà diffusés. Un épisode sans date de diffusion est
// considéré comme sorti : c'est le cas de vieilles fiches incomplètes, où
// refuser de cocher serait plus gênant que l'inverse.
function airedOnly(episodes) {
  const today = new Date().toISOString().slice(0, 10);
  return episodes
    .filter((e) => !e.airDate || e.airDate <= today)
    .map((e) => e.episodeNumber);
}

// Saisons d'une série avec, pour chacune, le nombre d'épisodes diffusés et le
// nombre d'épisodes vus. Sert à la fiche : elle peut afficher l'avancement de
// chaque saison et proposer de la cocher entière sans avoir à la déplier.
// Un seul appel TMDB, le même que pour la liste des saisons.
export async function getSeasonsProgress(profileId, seriesId) {
  const { seasons, lastAired } = await getSeriesStructure(seriesId);
  const vus = await listWatchedEpisodes(profileId, seriesId);

  return seasons.map((s) => {
    const vusSaison = vus.filter((v) => v.season === s.seasonNumber).length;
    let aired = 0;
    if (lastAired) {
      if (s.seasonNumber < lastAired.season) aired = s.episodeCount;
      else if (s.seasonNumber === lastAired.season) {
        aired = Math.min(lastAired.episode, s.episodeCount);
      }
    }
    return {
      ...s,
      aired: Math.min(s.episodeCount, Math.max(aired, vusSaison)),
      watched: vusSaison,
    };
  });
}

// Épisodes d'une saison (TMDB) enrichis de leur état vu (base locale).
export async function getSeasonEpisodes(profileId, seriesId, season) {
  const episodes = await getEpisodes(seriesId, season);
  const rows = await listWatchedEpisodes(profileId, seriesId);
  const watched = new Set(rows.filter((e) => e.season === season).map((e) => e.episode));
  return episodes.map((e) => ({ ...e, watched: watched.has(e.episodeNumber) }));
}

// Nombre d'épisodes réellement diffusés, déduit du dernier épisode sorti :
// tout ce qui précède sa saison, plus ce qui est sorti dans sa saison. Les
// saisons annoncées après lui ne comptent pas encore.
function countAired(seasons, lastAired) {
  if (!lastAired) return 0; // rien n'est encore sorti
  let n = 0;
  for (const s of seasons) {
    if (s.seasonNumber < lastAired.season) n += s.episodeCount;
    else if (s.seasonNumber === lastAired.season) {
      n += Math.min(lastAired.episode, s.episodeCount);
    }
  }
  return n;
}

// Progression d'une série : { total, aired, watched, next }.
//   total   = tous les épisodes annoncés (ce que la série fera au bout du compte) ;
//   aired   = ceux réellement diffusés (ce qu'on peut regarder aujourd'hui) ;
//   watched = ceux cochés ;
//   next    = premier épisode non coché, dans l'ordre, déjà diffusé.
// C'est `aired` qui sert à dire « je suis à jour » — pas `total`, qui compte
// les épisodes déjà programmés mais pas encore sortis.
export async function getProgress(profileId, seriesId) {
  const { seasons: brut, lastAired } = await getSeriesStructure(seriesId);
  const seasons = [...brut].sort((a, b) => a.seasonNumber - b.seasonNumber);
  const watched = await listWatchedEpisodes(profileId, seriesId);

  const total = seasons.reduce((sum, s) => sum + s.episodeCount, 0);
  // Garde-fou : si TMDB ne sait pas dire ce qui est sorti, on ne prétend pas
  // qu'il y a moins d'épisodes diffusés que d'épisodes déjà cochés.
  const aired = Math.min(total, Math.max(countAired(seasons, lastAired), watched.length));

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
          airDate: firstUnwatched.airDate,
        };
      }
      break; // premier non-vu trouvé (diffusé → next ; à venir → à jour)
    }
  }

  return { total, aired, watched: watched.length, next };
}

// --- Listes personnalisées ---

// `covers` : les affiches des 4 derniers titres ajoutés, pour la mosaïque de la carte.
export async function listListes(profileId) {
  const lignes = await query(
    `SELECT l.id, l.name, l.prive,
            (SELECT COUNT(*) FROM liste_items li WHERE li.liste_id = l.id) AS count,
            (SELECT group_concat(p.poster_url, '|') FROM
               (SELECT s.poster_url AS poster_url
                FROM liste_items li2
                JOIN suivi s ON s.profile_id = li2.profile_id
                            AND s.tmdb_id = li2.tmdb_id
                            AND s.media_type = li2.media_type
                WHERE li2.liste_id = l.id AND s.poster_url IS NOT NULL AND s.poster_url != ''
                ORDER BY li2.added_at DESC, li2.rowid DESC
                LIMIT 4) p) AS covers
     FROM listes l
     WHERE l.profile_id = ?
     ORDER BY l.created_at`,
    [profileId]
  );
  return lignes.map((l) => ({ ...l, covers: l.covers ? l.covers.split('|') : [] }));
}

export async function createListe(profileId, name) {
  const { lastId } = await run('INSERT INTO listes (profile_id, name) VALUES (?, ?)', [
    profileId,
    name,
  ]);
  return { id: lastId, name, count: 0 };
}

// Une liste privée n'est jamais envoyée dans la fiche partagée.
export async function setListePrive(profileId, id, prive) {
  const { changes } = await run('UPDATE listes SET prive = ? WHERE id = ? AND profile_id = ?', [
    prive ? 1 : 0,
    id,
    profileId,
  ]);
  if (changes === 0) throw new Error('Liste introuvable.');
}

export async function deleteListe(profileId, id) {
  await run('DELETE FROM listes WHERE id = ? AND profile_id = ?', [id, profileId]);
}

export function getListeItems(profileId, listeId) {
  return query(
    `SELECT s.tmdb_id AS id, s.media_type AS mediaType, s.title, s.year,
            s.release_date AS releaseDate, s.poster_url AS posterUrl, s.status,
            s.note, s.rating, s.genres
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

// --- Langue du catalogue ---
//
// Seuls les 4 champs de catalogue enregistrés localement (titre, année, date de
// sortie, affiche) sont concernés. Statuts, épisodes vus, listes, dates d'ajout
// et tout ce que l'utilisateur a saisi ne sont jamais touchés : aucune requête
// de ce bloc n'écrit dans ces colonnes ni dans ces tables.

// Titres dont la fiche n'est pas encore dans la langue demandée. Un titre
// suivi par plusieurs profils n'est téléchargé qu'une fois.
function pendingTitles(lang) {
  return query(
    `SELECT DISTINCT tmdb_id AS id, media_type AS mediaType
     FROM suivi WHERE lang IS NULL OR lang <> ?`,
    [lang]
  );
}

export async function countPendingLanguage(lang) {
  return (await pendingTitles(lang)).length;
}

// Marque les fiches déjà enregistrées comme étant dans cette langue, sans rien
// re-télécharger. Sert au tout premier choix : les bases existantes sont en
// français, choisir « Français » ne doit lancer aucune migration.
export async function stampLanguage(lang) {
  await run('UPDATE suivi SET lang = ? WHERE lang IS NULL', [lang]);
}

// Re-télécharge en une passe toutes les fiches enregistrées dans la nouvelle
// langue. Reprend là où elle s'est arrêtée : chaque fiche réussie est marquée,
// donc une coupure réseau ne fait perdre que ce qui n'était pas encore fait.
export async function migrateCatalogLanguage(lang, onProgress) {
  const titles = await pendingTitles(lang);
  const total = titles.length;
  let done = 0;
  let failed = 0;
  onProgress?.({ done, total });

  // Par paquets : on ne veut ni un titre après l'autre (trop lent) ni 300
  // appels simultanés (TMDB coupe).
  const BATCH = 5;
  for (let i = 0; i < titles.length; i += BATCH) {
    const batch = titles.slice(i, i + BATCH);
    const infos = await Promise.all(
      batch.map((t) =>
        getCardInfo(t.mediaType, t.id, TMDB_LANG[lang], getCatalogRegion(lang))
          .then((info) => ({ t, info }))
          .catch(() => ({ t, info: null }))
      )
    );
    for (const { t, info } of infos) {
      if (!info) {
        failed += 1; // fiche non marquée : elle sera retentée
        continue;
      }
      // Repli sur la valeur d'origine plutôt qu'un champ vide quand la fiche
      // n'est pas traduite (COALESCE garde ce qui est déjà enregistré).
      await run(
        `UPDATE suivi
            SET title = COALESCE(?, title),
                year = COALESCE(?, year),
                release_date = COALESCE(?, release_date),
                poster_url = COALESCE(?, poster_url),
                lang = ?,
                release_region = ?
          WHERE tmdb_id = ? AND media_type = ?`,
        [
          info.title || null,
          info.year || null,
          info.releaseDate || null,
          info.posterUrl || null,
          lang,
          regionAttendue(t.mediaType, getCatalogRegion(lang)),
          t.id,
          t.mediaType,
        ]
      );
      done += 1;
    }
    onProgress?.({ done, total });
  }

  return { total, done, failed };
}

// --- Rattrapage : dates de sortie manquantes ---
//
// La date de sortie complète n'a été ajoutée au suivi qu'en cours de route
// (12/08/2026). Les titres enregistrés avant sont restés sans date — et sans
// date, l'application ne peut pas savoir qu'un film n'est pas encore sorti :
// « Avatar 4 » et « Avatar 5 » réapparaissaient donc dans « À voir » malgré
// le filtre. On va chercher ce qui manque auprès de TMDB, au démarrage.
//
// Ne touche que les lignes sans date : aucune date déjà connue n'est écrasée,
// et rien d'autre que la date (et l'année si elle manquait) n'est modifié.
// Pays dont la date d'une ligne devrait provenir. Une série n'a pas de date
// par pays chez TMDB : elle est rangée sous 'monde', ce qui la met une fois
// pour toutes à l'écart des mises à jour de pays.
const regionAttendue = (mediaType, region) => (mediaType === 'movie' ? region : 'monde');

export async function backfillReleaseDates(region = getCatalogRegion()) {
  // Deux cas d'un coup : les fiches sans date (celles d'avant que
  // l'application ne retienne la date de sortie) et celles dont la date vient
  // d'un autre pays (changement de langue). Une ligne déjà à jour n'est jamais
  // redemandée — c'est ce qui rend ce rattrapage gratuit au lancement suivant.
  const aFaire = await query(
    `SELECT DISTINCT tmdb_id AS id, media_type AS mediaType
     FROM suivi
     WHERE release_region IS NULL
        OR genres IS NULL
        OR (media_type = 'movie' AND release_region <> ?)`,
    [region]
  );
  if (aFaire.length === 0) return 0;

  const langue = TMDB_LANG[getCatalogLanguage()];
  let completes = 0;
  const BATCH = 5; // ni un par un (trop lent) ni tout d'un coup (TMDB coupe)
  for (let i = 0; i < aFaire.length; i += BATCH) {
    const infos = await Promise.all(
      aFaire.slice(i, i + BATCH).map((t) =>
        getCardInfo(t.mediaType, t.id, langue, region)
          .then((info) => ({ t, info }))
          .catch(() => ({ t, info: null }))
      )
    );
    for (const { t, info } of infos) {
      // Échec réseau : on ne marque rien, ce sera retenté au prochain
      // lancement. Fiche obtenue mais sans date connue chez TMDB : on marque
      // quand même le pays, sinon on la redemanderait indéfiniment sans jamais
      // rien obtenir de plus.
      if (!info) continue;
      await run(
        `UPDATE suivi
            SET release_date = COALESCE(?, release_date),
                year = COALESCE(year, ?),
                genres = COALESCE(NULLIF(?, ''), genres, ''),
                release_region = ?
          WHERE tmdb_id = ? AND media_type = ?`,
        [
          info.releaseDate ?? null,
          info.year ?? null,
          // Jamais NULL ici : une fiche obtenue sans genre connu est marquée
          // '' pour ne pas être redemandée sans fin (même logique que la région).
          (info.genreKeys ?? []).join(','),
          regionAttendue(t.mediaType, region),
          t.id,
          t.mediaType,
        ]
      );
      if (info.releaseDate || info.genreKeys?.length) completes += 1;
    }
  }
  return completes;
}

// --- Notifications de sortie : cycle de vérification (figé le 2026-09-27) ---
//
// Ne traite que les éléments « en attente » (`notif_en_attente = 1`) — jamais
// toute la bibliothèque. Un élément le reste tant qu'il n'a pas été notifié
// (étape ultérieure) : une date trouvée aujourd'hui peut encore être reportée
// demain, donc on continue de la vérifier plutôt que de la figer.
// Appelé au plus une fois par lancement — le rythme « une fois par jour » de
// la décision figée est imposé par l'appelant (App.jsx), pas ici : cette
// fonction, elle, retraite sans condition tout ce qui lui est donné.
export async function checkNotifications(profileId, region = getCatalogRegion()) {
  const aVerifier = await query(
    `SELECT tmdb_id AS id, media_type AS mediaType
     FROM suivi WHERE profile_id = ? AND notif_en_attente = 1`,
    [profileId]
  );
  if (aVerifier.length === 0) return 0;

  const langue = TMDB_LANG[getCatalogLanguage()];
  let verifies = 0;
  const BATCH = 5;
  for (let i = 0; i < aVerifier.length; i += BATCH) {
    const infos = await Promise.all(
      aVerifier.slice(i, i + BATCH).map((t) =>
        getNotifInfo(t.mediaType, t.id, langue, region)
          .then((info) => ({ t, info }))
          .catch(() => ({ t, info: null }))
      )
    );
    for (const { t, info } of infos) {
      // Échec réseau : rien ne change, ce sera retenté au prochain cycle.
      if (!info) continue;
      const { date, enAttente } = classifyNotif({
        isSeries: t.mediaType === 'tv',
        releaseDate: info.releaseDate,
        status: info.status,
        nextEpisodeDate: info.nextEpisodeDate,
        seriesEnded: info.seriesEnded,
      });
      await run(
        `UPDATE suivi SET notif_date = ?, notif_en_attente = ?
         WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?`,
        [date, enAttente ? 1 : 0, profileId, t.id, t.mediaType]
      );
      verifies += 1;
    }
  }
  return verifies;
}

// --- Notifications de sortie : titres dus (figé le 2026-09-27) ---
//
// À chaque lancement (pas seulement une fois par jour : c'est une lecture
// locale, sans appel réseau, rien ne justifie de l'espacer) — les titres
// « en attente » dont la date est aujourd'hui ou déjà passée. Les fait sortir
// du cycle dans le même mouvement (décision 5 : un titre notifié n'est plus
// jamais revérifié) ; à l'appelant de les notifier réellement, ce module ne
// connaît que la base.
export async function takeDueNotifications(profileId, aujourdhui = today()) {
  const dus = await query(
    `SELECT tmdb_id AS id, media_type AS mediaType, title
     FROM suivi
     WHERE profile_id = ? AND notif_en_attente = 1
       AND notif_date IS NOT NULL AND notif_date <= ?`,
    [profileId, aujourdhui]
  );
  if (dus.length === 0) return [];
  await runMany(
    dus.map((t) => ({
      sql: `UPDATE suivi SET notif_en_attente = 0
            WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?`,
      params: [profileId, t.id, t.mediaType],
    }))
  );
  return dus;
}

// --- Statistiques ---
//
// Le temps passé se calcule sur ce qu'on a **réellement regardé** :
//   - un film compte s'il est marqué « vu » (sa durée entière) ;
//   - une série compte par épisode coché (durée d'un épisode × épisodes vus).
// Un titre dont TMDB ignore la durée n'est pas estimé : il est compté à part,
// pour que le total affiché reste un total et pas une approximation muette.

// Va chercher les durées manquantes. Même principe que les dates de sortie :
// seules les lignes vides sont demandées, donc l'appel suivant ne refait rien.
export async function backfillRuntimes(onProgress) {
  const manquants = await query(
    'SELECT DISTINCT tmdb_id AS id, media_type AS mediaType FROM suivi WHERE runtime IS NULL'
  );
  const total = manquants.length;
  let done = 0;
  onProgress?.({ done, total });
  if (total === 0) return { total, done };

  const BATCH = 5;
  for (let i = 0; i < manquants.length; i += BATCH) {
    const durees = await Promise.all(
      manquants.slice(i, i + BATCH).map((t) =>
        getRuntime(t.mediaType, t.id)
          .then((minutes) => ({ t, minutes }))
          .catch(() => ({ t, minutes: null }))
      )
    );
    for (const { t, minutes } of durees) {
      // Durée inconnue chez TMDB : on note 0 plutôt que de laisser vide, sinon
      // on la redemanderait à chaque ouverture de l'écran sans jamais l'obtenir.
      await run('UPDATE suivi SET runtime = ? WHERE tmdb_id = ? AND media_type = ?', [
        minutes ?? 0,
        t.id,
        t.mediaType,
      ]);
      done += 1;
    }
    onProgress?.({ done, total });
  }
  return { total, done };
}

// [{ key, n }] : les `max` genres les plus fréquents (ex æquo : ordre alphabétique).
// Le champ `genres` est une liste séparée par des virgules, vide ou NULL si inconnue.
export function compterGenres(titres, max = 5) {
  const n = new Map();
  for (const t of titres) {
    for (const g of new Set((t.genres || '').split(',').filter(Boolean))) {
      n.set(g, (n.get(g) || 0) + 1);
    }
  }
  return [...n]
    .map(([key, nb]) => ({ key, n: nb }))
    .sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : 1))
    .slice(0, max);
}

export async function getStats(profileId) {
  const suivi = await query(
    `SELECT tmdb_id AS id, media_type AS mediaType, status, runtime, rating, genres
     FROM suivi WHERE profile_id = ?`,
    [profileId]
  );
  const episodes = await query(
    `SELECT series_id AS seriesId, COUNT(*) AS vus
     FROM episodes_vus WHERE profile_id = ? GROUP BY series_id`,
    [profileId]
  );
  const vusParSerie = new Map(episodes.map((e) => [e.seriesId, e.vus]));

  const films = suivi.filter((t) => t.mediaType === 'movie');
  const series = suivi.filter((t) => t.mediaType === 'tv');

  const filmsVus = films.filter((t) => t.status === 'vu');
  const minutesFilms = filmsVus.reduce((n, t) => n + (t.runtime || 0), 0);

  let minutesSeries = 0;
  let episodesVus = 0;
  for (const serie of series) {
    const vus = vusParSerie.get(serie.id) || 0;
    episodesVus += vus;
    minutesSeries += vus * (serie.runtime || 0);
  }

  // Titres qui pèsent dans le calcul mais dont la durée est inconnue : c'est
  // ce qui explique un total plus bas que la réalité.
  const sansDuree =
    filmsVus.filter((t) => !t.runtime).length +
    series.filter((t) => !t.runtime && (vusParSerie.get(t.id) || 0) > 0).length;

  const parStatut = {};
  for (const st of STATUSES) {
    parStatut[st] = suivi.filter((t) => (t.status || 'a_voir') === st).length;
  }

  // Les étoiles données depuis les fiches : combien de titres notés, et la
  // moyenne. Un titre sans note n'entre pas dans le calcul.
  const notes = suivi.filter((t) => t.rating != null).map((t) => t.rating);
  const noteMoyenne = notes.length
    ? Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 10) / 10
    : null;

  // Genres les plus regardés : parmi les titres vus ou en cours, ceux dont le genre est connu.
  const parGenre = compterGenres(suivi.filter((t) => t.status === 'vu' || t.status === 'en_cours'), 5);

  return {
    titres: suivi.length,
    parGenre,
    films: films.length,
    series: series.length,
    filmsVus: filmsVus.length,
    episodesVus,
    minutesFilms,
    minutesSeries,
    minutesTotal: minutesFilms + minutesSeries,
    sansDuree,
    enAttenteDeMesure: suivi.filter((t) => t.runtime == null).length,
    notes: notes.length,
    noteMoyenne,
    parStatut,
  };
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
  // 12 graines au plus (borne le nombre d'appels TMDB), moitié films moitié
  // séries : un film ne recommande que des films, une série que des séries.
  // Tirées au hasard dans tout le suivi, les graines donnaient parfois un bloc
  // de films seuls, parfois de séries seules.
  seeds = moitieMoitie(seeds, 12);

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

  const classees = [...agg.values()].sort(
    (a, b) => b.score - a.score || b._pop - a._pop
  );
  // Même règle au résultat : 15 films et 15 séries, et si un type manque, l'autre
  // comble — on ne rend jamais moins que ce qu'on a.
  return moitieMoitie(classees, 30).map(({ _pop, score, ...rest }) => rest);
}

// Prend `n` éléments, autant de films que de séries, en gardant l'ordre de
// chaque type. Quand un type n'en a pas assez, l'autre complète.
export function moitieMoitie(liste, n) {
  const films = liste.filter((i) => i.mediaType === 'movie');
  const series = liste.filter((i) => i.mediaType !== 'movie');
  const partFilms = Math.min(films.length, Math.max(Math.ceil(n / 2), n - series.length));
  const partSeries = Math.min(series.length, n - partFilms);
  const garde = new Set([...films.slice(0, partFilms), ...series.slice(0, partSeries)]);
  return liste.filter((i) => garde.has(i));
}

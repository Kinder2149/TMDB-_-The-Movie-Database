// Seul point de contact entre l'UI et le back. L'UI ne connaît que cette API.
//
// Migration vers l'app autonome (PLAN_ANDROID) : les fonctions changent
// d'intérieur, jamais de signature — l'UI n'a rien à savoir.
//   - Catalogue (recherche, tendances, genres, acteurs, fiches, saisons)
//     → tranche 1 : appelle TMDB directement, plus aucun serveur.
//   - Suivi, profils, listes, épisodes cochés
//     → encore /api, passeront sur la base embarquée en tranche 2.
import * as tmdb from './tmdb.js';

// --- Profil actif ---
// L'UI garde en mémoire (et dans localStorage) l'id du profil actif, et l'envoie
// au back via l'en-tête X-Profile-Id sur toutes les requêtes de suivi.
// En V2, cet id viendra d'un compte connecté ; le back ne changera pas.
const PROFILE_KEY = 'activeProfileId';
let activeProfileId = localStorage.getItem(PROFILE_KEY) || null;

export function getActiveProfileId() {
  return activeProfileId;
}

export function setActiveProfileId(id) {
  activeProfileId = id;
  if (id) localStorage.setItem(PROFILE_KEY, id);
  else localStorage.removeItem(PROFILE_KEY);
}

// fetch qui injecte l'en-tête du profil actif (pour les routes scopées).
function profileFetch(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (activeProfileId) headers['X-Profile-Id'] = activeProfileId;
  return fetch(url, { ...opts, headers });
}

// --- Profils ---
export async function getProfiles() {
  const response = await fetch('/api/profiles');
  if (!response.ok) throw new Error('Impossible de charger les profils.');
  return (await response.json()).profiles;
}

export async function createProfile(name) {
  const response = await fetch('/api/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error('La création du profil a échoué.');
  return response.json(); // { id, name }
}

export async function renameProfile(id, name) {
  const response = await fetch(`/api/profiles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error('Le renommage du profil a échoué.');
}

// --- Catalogue (TMDB en direct, sans serveur) ---

// Fiche détaillée d'un film ou d'une série (infos + acteurs). Données TMDB.
export async function getDetails(mediaType, id) {
  return tmdb.getDetails(mediaType, id);
}

// Recherche par acteur : renvoie { person, results (filmographie) }.
export async function searchByActor(query) {
  return tmdb.searchByActor(query);
}

// Suggestions personnalisées (d'après le suivi du profil).
export async function getSuggestions() {
  const r = await profileFetch('/api/suggestions');
  if (!r.ok) throw new Error('Impossible de charger les suggestions.');
  return (await r.json()).results;
}

// Liste des genres : [{ name, movieId, tvId }].
export async function getGenres() {
  return tmdb.getGenres();
}

// Titres d'un genre (films et/ou séries selon les ids fournis).
export async function discoverGenre({ movieGenre, tvGenre, page = 1 }) {
  return tmdb.discoverByGenre({
    movieGenreId: movieGenre,
    tvGenreId: tvGenre,
    page,
  });
}

// Tendances de la semaine (films + séries) : proposées quand le champ est vide.
export async function getTrending() {
  return tmdb.getTrending();
}

export async function searchTitles(query) {
  return tmdb.searchMulti(query);
}

// Récupère la liste du suivi (pour marquer les résultats déjà ajoutés).
export async function getSuivi() {
  const response = await profileFetch('/api/suivi');
  if (!response.ok) throw new Error('Impossible de charger le suivi.');
  const data = await response.json();
  return data.items;
}

export async function addToSuivi(item) {
  const response = await profileFetch('/api/suivi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!response.ok) throw new Error("L'ajout au suivi a échoué.");
}

export async function removeFromSuivi(mediaType, id) {
  const response = await profileFetch(`/api/suivi/${mediaType}/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Le retrait du suivi a échoué.');
}

// Change le statut d'un titre : 'a_voir' | 'en_cours' | 'vu' | 'abandonne'.
export async function setStatus(mediaType, id, status) {
  const response = await profileFetch(`/api/suivi/${mediaType}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error('Le changement de statut a échoué.');
}

// --- Séries : saisons et épisodes ---

// Saisons : catalogue pur (aucun suivi) → TMDB en direct.
export async function getSeasons(seriesId) {
  return tmdb.getSeasons(seriesId);
}

export async function getSeasonEpisodes(seriesId, season) {
  const response = await profileFetch(`/api/tv/${seriesId}/season/${season}`);
  if (!response.ok) throw new Error('Impossible de charger les épisodes.');
  return (await response.json()).episodes;
}

// Progression d'une série : { total, watched, next }.
export async function getProgress(seriesId) {
  const response = await profileFetch(`/api/tv/${seriesId}/progress`);
  if (!response.ok) throw new Error('Impossible de charger la progression.');
  return response.json();
}

export async function markEpisode(seriesId, season, episode) {
  const response = await profileFetch(
    `/api/tv/${seriesId}/season/${season}/episode/${episode}`,
    { method: 'POST' }
  );
  if (!response.ok) throw new Error("Le marquage de l'épisode a échoué.");
}

export async function unmarkEpisode(seriesId, season, episode) {
  const response = await profileFetch(
    `/api/tv/${seriesId}/season/${season}/episode/${episode}`,
    { method: 'DELETE' }
  );
  if (!response.ok) throw new Error("Le retrait de l'épisode a échoué.");
}

export async function markWholeSeason(seriesId, season, episodeNumbers) {
  const response = await profileFetch(`/api/tv/${seriesId}/season/${season}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ episodes: episodeNumbers }),
  });
  if (!response.ok) throw new Error('Le marquage de la saison a échoué.');
}

export async function unmarkWholeSeason(seriesId, season) {
  const response = await profileFetch(`/api/tv/${seriesId}/season/${season}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Le retrait de la saison a échoué.');
}

// --- Listes personnalisées ---

export async function getListes() {
  const r = await profileFetch('/api/listes');
  if (!r.ok) throw new Error('Impossible de charger les listes.');
  return (await r.json()).listes;
}

export async function createListe(name) {
  const r = await profileFetch('/api/listes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error('La création de la liste a échoué.');
  return r.json(); // { id, name, count }
}

export async function deleteListe(id) {
  const r = await profileFetch(`/api/listes/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error('La suppression de la liste a échoué.');
}

export async function getListeItems(id) {
  const r = await profileFetch(`/api/listes/${id}/items`);
  if (!r.ok) throw new Error('Impossible de charger la liste.');
  return (await r.json()).items;
}

export async function addToListe(id, item) {
  const r = await profileFetch(`/api/listes/${id}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!r.ok) throw new Error("L'ajout à la liste a échoué.");
}

export async function removeFromListe(id, mediaType, tmdbId) {
  const r = await profileFetch(`/api/listes/${id}/items/${mediaType}/${tmdbId}`, {
    method: 'DELETE',
  });
  if (!r.ok) throw new Error('Le retrait de la liste a échoué.');
}

// Ids des listes contenant un titre (pour la fiche).
export async function getItemListes(mediaType, id) {
  const r = await profileFetch(`/api/listes/for/${mediaType}/${id}`);
  if (!r.ok) throw new Error('Impossible de charger les listes du titre.');
  return (await r.json()).listeIds;
}

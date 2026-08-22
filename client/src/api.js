// Seul point de contact entre l'UI et le reste de l'application.
//
// Passage en app autonome (PLAN_ANDROID, tranches 1 et 2) : ces fonctions ont
// changé d'intérieur, jamais de signature — aucun écran n'a été modifié.
//   - Catalogue  → `tmdb.js`  : TMDB en direct.
//   - Suivi/profils/listes/épisodes → `store.js` : base embarquée.
// Plus aucun serveur : il n'y a plus un seul appel réseau vers /api.
import * as tmdb from './tmdb.js';
import * as store from './store.js';
import * as lang from './lang.js';
import { markChanged } from './backup.js';

// Toute écriture passe par ici : la sauvegarde cloud doit savoir qu'il y a du
// nouveau à envoyer. Sans compte Google relié, `markChanged` ne fait rien —
// l'application sans sauvegarde cloud se comporte exactement comme avant.
async function ecriture(promesse) {
  const resultat = await promesse;
  markChanged();
  return resultat;
}

// --- Profil actif ---
// L'UI garde en mémoire (et dans localStorage) l'id du profil actif.
// C'est un UUID *portable* : il pourra suivre le profil ailleurs (sauvegarde,
// restauration sur un autre appareil — tranche 4).
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

// Les données de suivi appartiennent toujours à un profil : on refuse d'agir
// sans profil actif (l'UI n'appelle ces fonctions qu'une fois le profil choisi).
function requireProfile() {
  if (!activeProfileId) throw new Error('Aucun profil actif.');
  return activeProfileId;
}

// --- Profils ---

export async function getProfiles() {
  return store.listProfiles();
}

export async function createProfile(name) {
  return ecriture(store.createProfile(name));
}

export async function renameProfile(id, name) {
  return ecriture(store.renameProfile(id, name));
}

// --- Langue du catalogue ---
// La langue est injectée dans les appels TMDB depuis `tmdb.js`, en un seul
// point : rien ici ne la passe appel par appel.

export { getCatalogLanguage, hasCatalogLanguage, LANGUAGES, languageLabel } from './lang.js';

// Premier choix (écran de bienvenue). Les fiches déjà enregistrées sont
// simplement marquées si elles sont déjà dans cette langue ; sinon elles sont
// re-téléchargées comme lors d'un changement.
export async function chooseInitialLanguage(value, onProgress) {
  const had = lang.hasCatalogLanguage();
  lang.setCatalogLanguage(value);
  if (!had && value === 'fr') {
    // Les bases d'avant ce réglage sont en français : rien à re-télécharger.
    await store.stampLanguage('fr');
    return { total: 0, done: 0, failed: 0 };
  }
  return store.migrateCatalogLanguage(value, onProgress);
}

// Changement depuis les réglages : nouvelle langue puis re-téléchargement.
export async function changeCatalogLanguage(value, onProgress) {
  lang.setCatalogLanguage(value);
  return store.migrateCatalogLanguage(value, onProgress);
}

// Reprise d'une migration interrompue (coupure réseau) : combien de fiches
// restent à mettre à jour.
export async function countPendingLanguage(value = lang.getCatalogLanguage()) {
  return store.countPendingLanguage(value);
}

// --- Catalogue (TMDB en direct) ---

// Fiche détaillée d'un film ou d'une série (infos + acteurs). Données TMDB.
export async function getDetails(mediaType, id) {
  return tmdb.getDetails(mediaType, id);
}

// Recherche par acteur : renvoie { person, results (filmographie) }.
export async function searchByActor(query) {
  return tmdb.searchByActor(query);
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

// Saisons d'une série : catalogue pur (aucun suivi).
export async function getSeasons(seriesId) {
  return tmdb.getSeasons(seriesId);
}

// --- Suggestions (base locale + TMDB) ---

export async function getSuggestions() {
  return store.getSuggestions(requireProfile());
}

// --- Suivi ---

export async function getSuivi() {
  return store.listSuivi(requireProfile());
}

export async function addToSuivi(item) {
  return ecriture(store.addToSuivi(requireProfile(), item));
}

export async function removeFromSuivi(mediaType, id) {
  return ecriture(store.removeFromSuivi(requireProfile(), mediaType, id));
}

// Change le statut d'un titre : 'a_voir' | 'en_cours' | 'vu' | 'abandonne'.
export async function setStatus(mediaType, id, status) {
  return ecriture(store.setStatus(requireProfile(), mediaType, id, status));
}

// --- Séries : épisodes et progression ---

export async function getSeasonEpisodes(seriesId, season) {
  return store.getSeasonEpisodes(requireProfile(), seriesId, season);
}

// Progression d'une série : { total, watched, next }.
export async function getProgress(seriesId) {
  return store.getProgress(requireProfile(), seriesId);
}

export async function markEpisode(seriesId, season, episode) {
  return ecriture(store.markEpisode(requireProfile(), seriesId, season, episode));
}

export async function unmarkEpisode(seriesId, season, episode) {
  return ecriture(store.unmarkEpisode(requireProfile(), seriesId, season, episode));
}

export async function markWholeSeason(seriesId, season, episodeNumbers) {
  return ecriture(store.markWholeSeason(requireProfile(), seriesId, season, episodeNumbers));
}

export async function unmarkWholeSeason(seriesId, season) {
  return ecriture(store.unmarkWholeSeason(requireProfile(), seriesId, season));
}

// --- Listes personnalisées ---

export async function getListes() {
  return store.listListes(requireProfile());
}

export async function createListe(name) {
  return ecriture(store.createListe(requireProfile(), name));
}

export async function deleteListe(id) {
  return ecriture(store.deleteListe(requireProfile(), id));
}

export async function getListeItems(id) {
  return store.getListeItems(requireProfile(), id);
}

export async function addToListe(id, item) {
  return ecriture(store.addToListe(requireProfile(), id, item));
}

export async function removeFromListe(id, mediaType, tmdbId) {
  return ecriture(store.removeFromListe(requireProfile(), id, mediaType, tmdbId));
}

// Ids des listes contenant un titre (pour la fiche).
export async function getItemListes(mediaType, id) {
  return store.getItemListes(requireProfile(), mediaType, id);
}

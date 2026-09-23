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
import { markChanged, oublierProfil } from './backup.js';

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

export async function createProfile(name, avatar) {
  return ecriture(store.createProfile(name, avatar));
}

export async function renameProfile(id, name) {
  return ecriture(store.renameProfile(id, name));
}

export async function setProfileAvatar(id, avatar) {
  return ecriture(store.setProfileAvatar(id, avatar));
}

// Ce que la suppression emporterait : à montrer avant de demander confirmation.
export async function countProfileData(id) {
  return store.countProfileData(id);
}

// Supprime un profil et tout son contenu. Renvoie l'id du profil sur lequel se
// rabattre. Sa sauvegarde Drive est retirée à la sauvegarde suivante, et il
// n'est plus proposé à la restauration.
export async function deleteProfile(id) {
  const repli = await ecriture(store.deleteProfile(id));
  oublierProfil(id);
  return repli;
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

// Films d'une saga, dans l'ordre de sortie.
export async function getCollection(id) {
  return tmdb.getCollection(id);
}

// Recherche par acteur : renvoie { person, results (filmographie) }.
export async function searchByActor(query) {
  return tmdb.searchByActor(query);
}

// Filmographie d'un acteur à partir de son identifiant TMDB : { person, results }.
export async function getActorFilmography(id) {
  return tmdb.getActorFilmography(id);
}

// Titres dans le même esprit (recommandations TMDB), pour le bas de la fiche.
export async function getRecommendations(mediaType, id) {
  return tmdb.getRecommendations(mediaType, id);
}

// Liste des genres : [{ name, movieId, tvId }].
export async function getGenres() {
  return tmdb.getGenres();
}

// Titres d'un genre de la liste unique (`key`), côté films et/ou séries.
// Le genre est facultatif ; `filtres` = { periode, tri, plateformes } (voir filtres.js).
export async function discoverGenre({ genre, movie = true, tv = true, page = 1, filtres }) {
  return tmdb.discoverByGenre({ genre, movie, tv, page, filtres });
}

// Plateformes de streaming proposées dans les filtres d'« Explorer ».
export async function getPlateformes() {
  return tmdb.getPlateformes();
}

// Rubrique de l'accueil de la recherche : 'tendances', 'nouveautes' ou 'avenir'.
// { rubrique, mediaType, page }.
export async function getRubrique(options) {
  return tmdb.getRubrique(options);
}

export async function searchTitles(query) {
  return tmdb.searchMulti(query);
}

// Saisons d'une série : catalogue pur (aucun suivi).
export async function getSeasons(seriesId) {
  return tmdb.getSeasons(seriesId);
}

// Saisons enrichies de l'avancement du profil : [{ ..., aired, watched }].
export async function getSeasonsProgress(seriesId) {
  return store.getSeasonsProgress(requireProfile(), seriesId);
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

// Met les dates de sortie à jour : celles qui manquent (fiches d'avant que
// l'application ne les retienne) et celles qui viennent d'un autre pays que
// celui de la langue choisie. Renvoie le nombre de fiches complétées.
export async function mettreAJourDatesDeSortie() {
  return store.backfillReleaseDates();
}

// --- Statistiques ---

// Complète les durées manquantes (appels TMDB) : appelé par l'écran des
// statistiques, jamais au démarrage. `onProgress` reçoit { done, total }.
export async function completeRuntimes(onProgress) {
  return store.backfillRuntimes(onProgress);
}

export async function getStats() {
  return store.getStats(requireProfile());
}

// --- Note personnelle (avis écrit + étoiles) ---

export async function getNote(mediaType, id) {
  return store.getNote(requireProfile(), mediaType, id);
}

export async function setNote(mediaType, id, valeur) {
  return ecriture(store.setNote(requireProfile(), mediaType, id, valeur));
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

// Raccourcis : cocher une saison entière sans la déplier, ou toute la série.
// Ne cochent que les épisodes déjà diffusés.
export async function markSeasonWatched(seriesId, season) {
  return ecriture(store.markSeasonWatched(requireProfile(), seriesId, season));
}

export async function markSeriesWatched(seriesId) {
  return ecriture(store.markSeriesWatched(requireProfile(), seriesId));
}

export async function unmarkSeriesWatched(seriesId) {
  return ecriture(store.unmarkSeriesWatched(requireProfile(), seriesId));
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

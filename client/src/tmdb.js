// Couche catalogue — appelle TMDB directement depuis l'application.
//
// Déplacé depuis server/src/services/tmdb.js (tranche 1 du PLAN_ANDROID) : le
// serveur ne sert plus de relais. TMDB autorise l'appel direct
// (Access-Control-Allow-Origin: *), il n'y a donc rien entre l'app et TMDB.
//
// La clé est embarquée dans l'application (décision figée, PLAN_ANDROID) : elle
// n'ouvre que le catalogue public TMDB, aucune donnée personnelle ni budget.

import { getCatalogLanguage, TMDB_LANG } from './lang.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Appel générique à TMDB. La langue du catalogue est posée ici, et *seulement*
// ici : tous les appels de ce fichier passent par cette porte, donc changer la
// langue dans les réglages suffit à changer toutes les fiches, sans toucher un
// seul appel. `language` ne sert qu'à la migration, qui demande explicitement
// une langue donnée.
async function tmdbGet(path, params = {}, language) {
  const apiKey = import.meta.env.VITE_TMDB_API_KEY;
  if (!apiKey) {
    throw new Error('TMDB_API_KEY manquante. Renseignez-la dans client/.env');
  }
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set(
    'language',
    language || TMDB_LANG[getCatalogLanguage()] || TMDB_LANG.fr
  );
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erreur TMDB (${response.status})`);
  }
  return response.json();
}

// --- Mémoire de séance ---
//
// Une même page redemande sans cesse la structure d'une série et les épisodes
// d'une saison : la page « Ce soir » le fait pour chaque série en cours, la
// fiche à chaque case cochée. On garde donc la *promesse* de chaque appel le
// temps de la séance — garder la promesse (et pas seulement le résultat) évite
// aussi de lancer deux fois le même appel en parallèle. La clé porte la langue :
// changer de langue repart proprement sur des fiches traduites. Un appel raté
// n'est pas gardé, il sera retenté.
const cacheSeries = new Map();
const cacheEpisodes = new Map();

function memo(cache, key, charge) {
  if (!cache.has(key)) {
    cache.set(
      key,
      charge().catch((e) => {
        cache.delete(key);
        throw e;
      })
    );
  }
  return cache.get(key);
}

// Normalise une entrée de catalogue TMDB (film ou série) au format de l'UI.
// Les listes (recherche, tendances, genre, acteur, recommandations) partagent
// toutes cette forme : un seul endroit à corriger si TMDB change.
function toCardItem(item, mediaType) {
  const mt = mediaType || item.media_type;
  const isMovie = mt === 'movie';
  const date = isMovie ? item.release_date : item.first_air_date;
  return {
    id: item.id,
    mediaType: mt,
    type: isMovie ? 'film' : 'série',
    title: isMovie ? item.title : item.name,
    year: date ? date.slice(0, 4) : null,
    releaseDate: date || null,
    posterUrl: item.poster_path
      ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
      : null,
  };
}

const isFilmOrSerie = (item) =>
  item.media_type === 'movie' || item.media_type === 'tv';

// Trie par popularité décroissante et coupe à 50 (listes acteur / genre).
function topByPopularity(entries) {
  return entries
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 50)
    .map((e) => e.item);
}

// Recherche multi (films + séries), normalisée pour l'UI.
export async function searchMulti(query) {
  const data = await tmdbGet('/search/multi', { query, include_adult: 'false' });
  return (data.results || []).filter(isFilmOrSerie).map((item) => toCardItem(item));
}

// Tendances de la semaine (films + séries), pour l'écran de recherche à vide.
export async function getTrending() {
  const data = await tmdbGet('/trending/all/week');
  return (data.results || []).filter(isFilmOrSerie).map((item) => toCardItem(item));
}

// Recherche par acteur : on résout la personne la plus notable, puis on
// renvoie sa filmographie (films + séries), triée par popularité.
export async function searchByActor(query) {
  const data = await tmdbGet('/search/person', { query, include_adult: 'false' });
  const person = (data.results || [])[0];
  if (!person) return { person: null, results: [] };

  const credits = await tmdbGet(`/person/${person.id}/combined_credits`);
  const seen = new Set();
  const results = topByPopularity(
    (credits.cast || [])
      .filter(isFilmOrSerie)
      // On écarte les apparitions « dans son propre rôle » (talk-shows, etc.)
      // et les émissions Talk (10767) / News (10763) / Télé-réalité (10764).
      .filter((c) => !/^(self|himself|herself)\b/i.test(c.character || ''))
      .filter((c) => !(c.genre_ids || []).some((g) => [10767, 10763, 10764].includes(g)))
      .filter((c) => {
        const key = `${c.media_type}-${c.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((c) => ({ item: toCardItem(c), popularity: c.popularity || 0 }))
  );

  return {
    person: {
      name: person.name,
      photoUrl: person.profile_path
        ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
        : null,
    },
    results,
  };
}

// Liste des genres (films + séries fusionnés par nom). Un même nom peut avoir
// un id film et/ou un id série (ils diffèrent chez TMDB).
export async function getGenres() {
  const [mv, tv] = await Promise.all([
    tmdbGet('/genre/movie/list'),
    tmdbGet('/genre/tv/list'),
  ]);
  const map = new Map();
  for (const g of mv.genres || []) {
    map.set(g.name, { name: g.name, movieId: g.id, tvId: null });
  }
  for (const g of tv.genres || []) {
    const e = map.get(g.name) || { name: g.name, movieId: null, tvId: null };
    e.tvId = g.id;
    map.set(g.name, e);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

// Découverte par genre : films et/ou séries, triés par popularité. Paginé.
export async function discoverByGenre({ movieGenreId, tvGenreId, page = 1 }) {
  const calls = [];
  if (movieGenreId) {
    calls.push(
      tmdbGet('/discover/movie', {
        with_genres: movieGenreId,
        sort_by: 'popularity.desc',
        include_adult: 'false',
        page,
      }).then((d) => ['movie', d])
    );
  }
  if (tvGenreId) {
    calls.push(
      tmdbGet('/discover/tv', {
        with_genres: tvGenreId,
        sort_by: 'popularity.desc',
        page,
      }).then((d) => ['tv', d])
    );
  }
  const parts = await Promise.all(calls);
  const entries = [];
  for (const [mediaType, data] of parts) {
    for (const c of data.results || []) {
      entries.push({ item: toCardItem(c, mediaType), popularity: c.popularity || 0 });
    }
  }
  return topByPopularity(entries);
}

// Recommandations TMDB pour un titre (films OU séries selon le type source).
// Garde la popularité (`_pop`) : les suggestions s'en servent pour départager
// deux titres recommandés le même nombre de fois.
export async function getRecommendations(mediaType, id) {
  const data = await tmdbGet(`/${mediaType}/${id}/recommendations`);
  // /movie/... renvoie des films, /tv/... des séries : media_type peut manquer.
  return (data.results || []).map((c) => ({
    ...toCardItem(c, c.media_type || mediaType),
    _pop: c.popularity || 0,
  }));
}

// Structure d'une série : ses saisons, et le dernier épisode *réellement
// diffusé*. Les deux viennent du même appel TMDB — c'est pour ça qu'ils sont
// renvoyés ensemble plutôt que par deux fonctions.
//
// Cette distinction compte : le nombre d'épisodes annoncé par saison inclut
// les épisodes déjà programmés mais pas encore diffusés. Compter la
// progression dessus donnait « 6 vus sur 10 » à quelqu'un qui a tout vu de ce
// qui est sorti — et laissait la série dans « Reprendre » alors qu'il n'y
// avait rien à reprendre.
//
// On masque la saison 0 (« Épisodes spéciaux », fourre-tout non pertinent pour
// le suivi) et les saisons vides.
export async function getSeriesStructure(seriesId) {
  return memo(cacheSeries, `${getCatalogLanguage()}:${seriesId}`, () =>
    chargeStructure(seriesId)
  );
}

async function chargeStructure(seriesId) {
  const data = await tmdbGet(`/tv/${seriesId}`);
  const seasons = (data.seasons || [])
    .filter((s) => s.season_number >= 1 && s.episode_count > 0)
    .map((s) => ({
      seasonNumber: s.season_number,
      name: s.name,
      episodeCount: s.episode_count,
    }));

  // `null` = rien n'est encore sorti. Un dernier épisode diffusé rangé en
  // saison 0 (un spécial) ne dit rien de la progression : on l'ignore.
  const dernier = data.last_episode_to_air;
  const lastAired =
    dernier && dernier.season_number >= 1
      ? { season: dernier.season_number, episode: dernier.episode_number }
      : null;

  return { seasons, lastAired };
}

// Saisons seules : ce dont l'écran de la fiche a besoin pour lister.
export async function getSeasons(seriesId) {
  return (await getSeriesStructure(seriesId)).seasons;
}

// Fiche détaillée d'un film ou d'une série (infos + acteurs), normalisée pour l'UI.
export async function getDetails(mediaType, id) {
  const path = mediaType === 'movie' ? `/movie/${id}` : `/tv/${id}`;
  const data = await tmdbGet(path, {
    append_to_response: 'credits,videos,watch/providers',
    include_video_language: 'fr,en',
  });

  // Repli : TMDB renvoie un synopsis vide quand la fiche n'est pas traduite.
  // Plutôt qu'un blanc, on va chercher celui de l'autre langue.
  let overview = data.overview || '';
  if (!overview) {
    const fallback =
      getCatalogLanguage() === 'fr' ? TMDB_LANG.en : TMDB_LANG.fr;
    try {
      const alt = await tmdbGet(path, {}, fallback);
      overview = alt.overview || '';
    } catch {
      /* réseau indisponible : on laisse le synopsis vide */
    }
  }

  const isMovie = mediaType === 'movie';
  const date = isMovie ? data.release_date : data.first_air_date;
  const cast = (data.credits?.cast || []).slice(0, 8).map((c) => ({
    name: c.name,
    character: c.character || null,
    photoUrl: c.profile_path
      ? `https://image.tmdb.org/t/p/w185${c.profile_path}`
      : null,
  }));

  // Bande-annonce : on privilégie une VF, sinon VO, YouTube.
  const vids = data.videos?.results || [];
  const pick =
    vids.find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.iso_639_1 === 'fr') ||
    vids.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ||
    vids.find((v) => v.site === 'YouTube' && v.type === 'Teaser') ||
    null;
  const trailer = pick
    ? { name: pick.name, url: `https://www.youtube.com/watch?v=${pick.key}` }
    : null;

  // Disponibilité streaming en France (données JustWatch via TMDB).
  const fr = data['watch/providers']?.results?.FR;
  const mapProv = (arr) =>
    (arr || []).map((p) => ({
      name: p.provider_name,
      logoUrl: p.logo_path ? `https://image.tmdb.org/t/p/w45${p.logo_path}` : null,
    }));
  const providers = {
    link: fr?.link || null,
    flatrate: mapProv(fr?.flatrate),
    rent: mapProv(fr?.rent),
    buy: mapProv(fr?.buy),
  };

  return {
    title: isMovie ? data.title : data.name,
    year: date ? date.slice(0, 4) : null,
    releaseDate: date || null,
    genres: (data.genres || []).map((g) => g.name),
    overview,
    posterUrl: data.poster_path
      ? `https://image.tmdb.org/t/p/w342${data.poster_path}`
      : null,
    backdropUrl: data.backdrop_path
      ? `https://image.tmdb.org/t/p/w780${data.backdrop_path}`
      : null,
    cast,
    trailer,
    providers,
  };
}

// Durée d'un titre, en minutes :
//   - film  : sa durée ;
//   - série : la durée d'un épisode (c'est elle qu'on multipliera par le
//             nombre d'épisodes cochés).
// `null` quand TMDB ne la connaît pas — on préfère ne rien compter plutôt que
// d'inventer une moyenne.
export async function getRuntime(mediaType, id) {
  if (mediaType === 'movie') {
    const data = await tmdbGet(`/movie/${id}`);
    return data.runtime || null;
  }
  const data = await tmdbGet(`/tv/${id}`);
  const annonces = (data.episode_run_time || []).filter((n) => n > 0);
  if (annonces.length > 0) {
    return Math.round(annonces.reduce((a, b) => a + b, 0) / annonces.length);
  }

  // Beaucoup de séries récentes laissent ce champ vide. On regarde alors la
  // durée réelle des épisodes d'une saison, et on prend la **médiane** : les
  // finales et les pilotes sont souvent rallongés, et une moyenne les laisserait
  // tirer le chiffre vers le haut. (Constaté sur Severance : dernier épisode
  // 80 min, épisode courant ~50 — l'estimation partait 60 % trop haut.)
  const saison = (data.seasons || []).find(
    (x) => x.season_number >= 1 && x.episode_count > 0
  );
  if (saison) {
    try {
      const durees = (await getEpisodes(id, saison.season_number))
        .map((e) => e.runtime)
        .filter((n) => n > 0)
        .sort((a, b) => a - b);
      if (durees.length > 0) return durees[Math.floor(durees.length / 2)];
    } catch {
      /* saison indisponible : on retombe sur le repli ci-dessous */
    }
  }

  // Dernier repli : la durée du dernier épisode diffusé. Imparfaite, mais
  // toujours meilleure que rien.
  return data.last_episode_to_air?.runtime || null;
}

// --- Date de sortie d'un pays ---
//
// TMDB range plusieurs dates par pays, chacune avec son type. On retient la
// sortie en salle, et à défaut ce qui s'en rapproche le plus.
const TYPES_PAR_PREFERENCE = [
  3, // sortie en salle : la mieux remplie, et ce que « sorti » veut dire
  2, // sortie limitée
  4, // sortie numérique
  1, // avant-première
];

// La **plus ancienne** date du type retenu, jamais la plus récente : un pays
// peut lister des ressorties en salle. Matrix a trois séances de reprise en
// France en 2026 — prendre la dernière ferait passer un film de 1999 pour
// « pas encore sorti ».
export function dateDeSortieRegionale(releaseDates, region) {
  const pays = (releaseDates?.results || []).find((r) => r.iso_3166_1 === region);
  if (!pays) return null;
  for (const type of TYPES_PAR_PREFERENCE) {
    const dates = (pays.release_dates || [])
      .filter((d) => d.type === type && d.release_date)
      .map((d) => d.release_date.slice(0, 10))
      .sort();
    if (dates.length > 0) return dates[0];
  }
  return null;
}

// Champs de carte d'un titre (titre, année, date, affiche) dans une langue
// explicite, et — pour un film — avec la date de sortie du pays demandé.
//
// Les dates par pays arrivent **dans la même requête** que la fiche : passer à
// une date française ne coûte donc pas un appel de plus.
//
// Une série n'a pas de date par pays chez TMDB : elle garde sa date de première
// diffusion mondiale, quel que soit le réglage.
//
// L'**année** reste celle de la sortie d'origine, même quand la date française
// est plus tardive : Matrix est « 1999 » pour tout le monde, ce n'est pas au
// réglage de langue de le changer.
export async function getCardInfo(mediaType, id, language, region) {
  const params = mediaType === 'movie' ? { append_to_response: 'release_dates' } : {};
  const data = await tmdbGet(`/${mediaType}/${id}`, params, language);
  const carte = toCardItem(data, mediaType);

  if (mediaType === 'movie' && region) {
    const locale = dateDeSortieRegionale(data.release_dates, region);
    if (locale) carte.releaseDate = locale;
  }
  return carte;
}

// Épisodes d'une saison donnée.
export async function getEpisodes(seriesId, seasonNumber) {
  return memo(
    cacheEpisodes,
    `${getCatalogLanguage()}:${seriesId}:${seasonNumber}`,
    async () => {
      const data = await tmdbGet(`/tv/${seriesId}/season/${seasonNumber}`);
      return (data.episodes || []).map((e) => ({
        episodeNumber: e.episode_number,
        name: e.name,
        airDate: e.air_date || null,
        runtime: e.runtime || null, // sert à estimer la durée d'un épisode
      }));
    }
  );
}

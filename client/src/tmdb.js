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

// Saisons d'une série. On masque la saison 0 (« Épisodes spéciaux »,
// fourre-tout non pertinent pour le suivi) et les saisons vides.
export async function getSeasons(seriesId) {
  const data = await tmdbGet(`/tv/${seriesId}`);
  return (data.seasons || [])
    .filter((s) => s.season_number >= 1 && s.episode_count > 0)
    .map((s) => ({
      seasonNumber: s.season_number,
      name: s.name,
      episodeCount: s.episode_count,
    }));
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

// Champs de carte d'un titre (titre, année, date, affiche) dans une langue
// explicite. Sert uniquement à la migration de langue du catalogue.
export async function getCardInfo(mediaType, id, language) {
  const data = await tmdbGet(`/${mediaType}/${id}`, {}, language);
  return toCardItem(data, mediaType);
}

// Épisodes d'une saison donnée.
export async function getEpisodes(seriesId, seasonNumber) {
  const data = await tmdbGet(`/tv/${seriesId}/season/${seasonNumber}`);
  return (data.episodes || []).map((e) => ({
    episodeNumber: e.episode_number,
    name: e.name,
    airDate: e.air_date || null,
  }));
}

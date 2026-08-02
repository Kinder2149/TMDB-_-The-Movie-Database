const TMDB_BASE = 'https://api.themoviedb.org/3';

// Appel générique à TMDB en français. La clé reste dans cette couche.
async function tmdbGet(path, params = {}) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error('TMDB_API_KEY manquante. Renseignez-la dans server/.env');
  }
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('language', 'fr-FR');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erreur TMDB (${response.status})`);
  }
  return response.json();
}

// Recherche multi (films + séries), normalisée pour l'UI.
export async function searchMulti(query) {
  const data = await tmdbGet('/search/multi', { query, include_adult: 'false' });
  return (data.results || [])
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .map((item) => {
      const isMovie = item.media_type === 'movie';
      const date = isMovie ? item.release_date : item.first_air_date;
      return {
        id: item.id,
        mediaType: item.media_type,
        type: isMovie ? 'film' : 'série',
        title: isMovie ? item.title : item.name,
        year: date ? date.slice(0, 4) : null,
        posterUrl: item.poster_path
          ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
          : null,
      };
    });
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

// Épisodes d'une saison donnée.
export async function getEpisodes(seriesId, seasonNumber) {
  const data = await tmdbGet(`/tv/${seriesId}/season/${seasonNumber}`);
  return (data.episodes || []).map((e) => ({
    episodeNumber: e.episode_number,
    name: e.name,
    airDate: e.air_date || null,
  }));
}

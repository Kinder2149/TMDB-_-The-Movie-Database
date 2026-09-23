// Couche catalogue — appelle TMDB directement depuis l'application.
//
// Déplacé depuis server/src/services/tmdb.js (tranche 1 du PLAN_ANDROID) : le
// serveur ne sert plus de relais. TMDB autorise l'appel direct
// (Access-Control-Allow-Origin: *), il n'y a donc rien entre l'app et TMDB.
//
// La clé est embarquée dans l'application (décision figée, PLAN_ANDROID) : elle
// n'ouvre que le catalogue public TMDB, aucune donnée personnelle ni budget.

import { getCatalogLanguage, getCatalogRegion, TMDB_LANG } from './lang.js';
import { bornesDePeriode, dateRelative, VOTES_MIN } from './filtres.js';

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
    // Note et nombre de votes : pour trier « Mieux notés » sur une liste déjà
    // affichée (filtres.js). Ne sont pas enregistrés dans le suivi.
    note: typeof item.vote_average === 'number' ? item.vote_average : null,
    votes: item.vote_count ?? 0,
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

// Tendances du moment, pour l'écran de recherche à vide. `mediaType` : 'all',
// 'movie' ou 'tv' — filtrer « Films » demande les tendances films elles-mêmes,
// plutôt que de trier une liste mixte qui n'en garderait que la moitié.
// Paginé : TMDB rend 20 titres par page.
export async function getTrending({ mediaType = 'all', page = 1 } = {}) {
  const data = await tmdbGet(`/trending/${mediaType}/week`, { page });
  return (data.results || [])
    .map((item) => ({ ...item, media_type: item.media_type || mediaType }))
    .filter(isFilmOrSerie)
    .map((item) => toCardItem(item));
}

// Recherche par acteur : on résout la personne la plus notable, puis on
// renvoie sa filmographie (films + séries), triée par popularité.
export async function searchByActor(query) {
  const data = await tmdbGet('/search/person', { query, include_adult: 'false' });
  const person = (data.results || [])[0];
  if (!person) return { person: null, results: [] };
  return filmographie(person);
}

// Même filmographie, mais depuis l'identifiant de la personne : c'est ce que
// donne un clic sur un acteur de la fiche. Passer par son nom pourrait tomber
// sur un homonyme plus connu.
export async function getActorFilmography(id) {
  const person = await tmdbGet(`/person/${id}`);
  return filmographie(person);
}

async function filmographie(person) {
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

// --- Genres : une seule liste, valable pour les films comme pour les séries ---
//
// TMDB n'a pas les mêmes genres côté films et côté séries (« Action » et
// « Aventure » d'un côté, « Action & Adventure » de l'autre ; « Horreur »,
// « Romance », « Histoire » n'existent que pour les films). Plutôt que d'afficher
// les 27 et de griser ceux qui ne marchent pas, on propose une liste unique où
// chaque entrée sait quoi demander pour un film et pour une série. Plusieurs
// genres TMDB s'additionnent (« au choix parmi »). Pas de « Horreur », « Romance »
// ni « Musique » : TMDB ne les connaît pas pour les séries.
//
// « Histoire & Époques » n'est pas un genre TMDB côté séries : elle se reconstitue
// par mots-clés (antiquité, vikings, moyen âge, Renaissance, drame historique). Le mot-clé
// plus large « period drama » est écarté : il ramène Mad Men ou La Petite Maison dans la
// prairie devant les Vikings et Rome. Le
// genre « Histoire » des films de TMDB, lui, est surtout fait de biographies et de
// guerres du XXe siècle — ce n'est pas ce que cette entrée promet.
const MOTS_CLES_EPOQUES = [
  363879, // vikings
  355987, // middle ages
  41406, // middle ages (476-1453)
  161257, // medieval
  5049, // ancient rome
  162861, // ancient greece
  157894, // ancient egypt
  1405, // roman empire
  197963, // renaissance
  192772, // historical drama
];

export const GENRES = [
  { key: 'action', fr: 'Action & Aventure', en: 'Action & Adventure', movie: { genres: [28, 12] }, tv: { genres: [10759] } },
  { key: 'animation', fr: 'Animation', en: 'Animation', movie: { genres: [16] }, tv: { genres: [16] } },
  { key: 'comedie', fr: 'Comédie', en: 'Comedy', movie: { genres: [35] }, tv: { genres: [35] } },
  { key: 'crime', fr: 'Crime', en: 'Crime', movie: { genres: [80] }, tv: { genres: [80] } },
  { key: 'documentaire', fr: 'Documentaire', en: 'Documentary', movie: { genres: [99] }, tv: { genres: [99] } },
  { key: 'drame', fr: 'Drame', en: 'Drama', movie: { genres: [18] }, tv: { genres: [18] } },
  { key: 'famille', fr: 'Famille & Enfants', en: 'Family & Kids', movie: { genres: [10751] }, tv: { genres: [10751, 10762] } },
  { key: 'scifi', fr: 'Science-Fiction & Fantastique', en: 'Sci-Fi & Fantasy', movie: { genres: [878, 14] }, tv: { genres: [10765] } },
  { key: 'mystere', fr: 'Mystère & Thriller', en: 'Mystery & Thriller', movie: { genres: [9648, 53] }, tv: { genres: [9648] } },
  { key: 'guerre', fr: 'Guerre & Politique', en: 'War & Politics', movie: { genres: [10752] }, tv: { genres: [10768] } },
  { key: 'western', fr: 'Western', en: 'Western', movie: { genres: [37] }, tv: { genres: [37] } },
  {
    key: 'histoire',
    fr: 'Histoire & Époques',
    en: 'History & Period',
    movie: { keywords: MOTS_CLES_EPOQUES, votesMin: 20 },
    // Sans animation : le mot-clé « medieval » ramène aussi des animés fantastiques
    // (Re:ZERO, Frieren) qui n'ont rien d'historique.
    tv: { keywords: MOTS_CLES_EPOQUES, votesMin: 30, sansGenres: [16] },
  },
];

const ou = (ids) => ids.join('|');

// Liste affichée dans la barre de recherche, dans la langue du catalogue.
export async function getGenres() {
  const langue = getCatalogLanguage() === 'en' ? 'en' : 'fr';
  return GENRES.map((g) => ({ key: g.key, name: g[langue] }));
}

// Paramètres TMDB pour un genre de la liste, côté films ou côté séries.
export function parametresDeGenre(key, mediaType) {
  const genre = GENRES.find((g) => g.key === key);
  const regle = genre?.[mediaType];
  if (!regle) return null;
  const params = { sort_by: 'popularity.desc' };
  if (regle.genres) params.with_genres = ou(regle.genres);
  if (regle.keywords) params.with_keywords = ou(regle.keywords);
  if (regle.sansGenres) params.without_genres = ou(regle.sansGenres);
  if (regle.votesMin) params['vote_count.gte'] = regle.votesMin;
  return params;
}

// Ce que les filtres de « Explorer » demandent à TMDB, pour un film ou une série.
//  - Tri : popularité (défaut), date, ou note. « Plus récent » ne remonte que ce
//    qui est déjà sorti ; « Plus ancien » et « Mieux notés » exigent un minimum de
//    votes, sinon ils ne montrent que des titres inconnus.
//  - Période : bornes de date de sortie (première diffusion pour une série).
//  - Plateforme : titres disponibles chez elle (abonnement, location ou achat, selon
//    ce qu'elle propose) dans la région du catalogue ; plusieurs = « au choix ».
export function parametresDeFiltres(mediaType, filtres, aujourdhui = new Date()) {
  const champ = mediaType === 'movie' ? 'primary_release_date' : 'first_air_date';
  const { periode, tri = 'popularite', plateformes = [] } = filtres || {};
  const params = {};

  const SORT = {
    popularite: 'popularity.desc',
    recent: `${champ}.desc`,
    ancien: `${champ}.asc`,
    notes: 'vote_average.desc',
  };
  params.sort_by = SORT[tri] || SORT.popularite;
  if (VOTES_MIN[tri]) params['vote_count.gte'] = VOTES_MIN[tri];

  let { from, to } = bornesDePeriode(periode, aujourdhui);
  if (tri === 'recent') {
    const auj = dateRelative(0, aujourdhui);
    if (!to || to > auj) to = auj;
  }
  if (from) params[`${champ}.gte`] = from;
  if (to) params[`${champ}.lte`] = to;

  if (plateformes.length > 0) {
    params.with_watch_providers = ou(plateformes);
    params.watch_region = getCatalogRegion();
  }
  return params;
}

// Réunit films et séries dans l'ordre demandé (ce que TMDB ne fait pas entre
// deux appels séparés). Une date absente passe à la fin.
function fusionner(entries, tri = 'popularite', limite = 50) {
  const cle = {
    popularite: (e) => e.popularity,
    recent: (e) => e.item.releaseDate || '',
    ancien: (e) => e.item.releaseDate || '9999',
    notes: (e) => e.item.note ?? 0,
  }[tri] || ((e) => e.popularity);
  const sens = tri === 'ancien' ? 1 : -1;
  return entries
    .sort((a, b) => {
      const x = cle(a);
      const y = cle(b);
      return x < y ? -sens : x > y ? sens : 0;
    })
    .slice(0, limite)
    .map((e) => e.item);
}

// Découverte : films et/ou séries, avec un genre facultatif et des filtres
// (période, plateformes, tri). Paginé. Sans genre ni filtre : tout le catalogue
// par popularité.
export async function discoverByGenre({ genre, movie = true, tv = true, page = 1, filtres }) {
  const calls = [];
  for (const [mediaType, voulu] of [['movie', movie], ['tv', tv]]) {
    if (!voulu) continue;
    const base = genre ? parametresDeGenre(genre, mediaType) : {};
    if (!base) continue;
    const params = { ...base, ...parametresDeFiltres(mediaType, filtres) };
    // Sans genre, la découverte porte sur tout le catalogue : on écarte les
    // talk-shows, journaux et télé-réalité, comme pour les nouveautés.
    if (!genre && mediaType === 'tv') params.without_genres = '10767,10763,10764';
    // Le seuil de votes du genre et celui du tri : on garde le plus exigeant.
    const votes = Math.max(base['vote_count.gte'] || 0, params['vote_count.gte'] || 0);
    if (votes) params['vote_count.gte'] = votes;
    calls.push(
      tmdbGet(`/discover/${mediaType}`, {
        ...params,
        ...(mediaType === 'movie' ? { include_adult: 'false' } : {}),
        page,
      }).then((d) => [mediaType, d])
    );
  }
  const parts = await Promise.all(calls);
  const entries = [];
  for (const [mediaType, data] of parts) {
    for (const c of data.results || []) {
      entries.push({ item: toCardItem(c, mediaType), popularity: c.popularity || 0 });
    }
  }
  return fusionner(entries, filtres?.tri);
}

// Plateformes de streaming proposées dans les filtres : les plus courantes de la
// région du catalogue (Netflix, Prime Video, Disney+…), films et séries réunis.
const cachePlateformes = new Map();

export async function getPlateformes() {
  const region = getCatalogRegion();
  return memo(cachePlateformes, `${getCatalogLanguage()}:${region}`, async () => {
    const [films, series] = await Promise.all(
      ['movie', 'tv'].map((t) => tmdbGet(`/watch/providers/${t}`, { watch_region: region }))
    );
    const parId = new Map();
    for (const p of [...(films.results || []), ...(series.results || [])]) {
      if (!parId.has(p.provider_id)) parId.set(p.provider_id, p);
    }
    const priorite = (p) => p.display_priorities?.[region] ?? p.display_priority ?? 999;
    return [...parId.values()]
      .sort((a, b) => priorite(a) - priorite(b))
      .slice(0, 12)
      .map((p) => ({
        id: p.provider_id,
        name: p.provider_name,
        logoUrl: p.logo_path ? `https://image.tmdb.org/t/p/w45${p.logo_path}` : null,
      }));
  });
}

// Fenêtres de l'accueil : « Nouveautés » = sorties des 60 derniers jours,
// « À venir » = sorties des 90 jours qui viennent.
export function fenetreDeRubrique(rubrique, aujourdhui = new Date()) {
  if (rubrique === 'nouveautes') {
    return { from: dateRelative(-60, aujourdhui), to: dateRelative(0, aujourdhui) };
  }
  if (rubrique === 'avenir') {
    return { from: dateRelative(1, aujourdhui), to: dateRelative(90, aujourdhui) };
  }
  return null;
}

// Rubriques de l'accueil de la recherche : Tendances, Nouveautés, À venir.
// `mediaType` : 'all', 'movie' ou 'tv'. Paginé (20 titres par appel et par type).
export async function getRubrique({ rubrique = 'tendances', mediaType = 'all', page = 1 } = {}) {
  const fenetre = fenetreDeRubrique(rubrique);
  if (!fenetre) return getTrending({ mediaType, page });

  const types = mediaType === 'all' ? ['movie', 'tv'] : [mediaType];
  const parts = await Promise.all(
    types.map((t) => {
      const champ = t === 'movie' ? 'primary_release_date' : 'first_air_date';
      return tmdbGet(`/discover/${t}`, {
        sort_by: 'popularity.desc',
        [`${champ}.gte`]: fenetre.from,
        [`${champ}.lte`]: fenetre.to,
        // Talk-shows, journaux et télé-réalité inondent les nouveautés télé.
        ...(t === 'tv' ? { without_genres: '10767,10763,10764' } : { include_adult: 'false' }),
        page,
      }).then((d) => [t, d]);
    })
  );
  const entries = [];
  for (const [t, data] of parts) {
    for (const c of data.results || []) {
      entries.push({ item: toCardItem(c, t), popularity: c.popularity || 0 });
    }
  }
  return fusionner(entries, 'popularite', 40);
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
// Recherche YouTube « titre année bande-annonce », pour les fiches sans vidéo.
export function urlRechercheBandeAnnonce(titre, annee) {
  const q = [titre, annee, 'bande-annonce'].filter(Boolean).join(' ');
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

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
  const cast = (data.credits?.cast || []).slice(0, 12).map((c) => ({
    id: c.id,
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
  // Sans vidéo chez TMDB, on renvoie vers la recherche YouTube : le bouton est
  // toujours là, `recherche` dit juste qu'il ne mène pas à une vidéo précise.
  const titre = isMovie ? data.title : data.name;
  const trailer = pick
    ? { name: pick.name, url: `https://www.youtube.com/watch?v=${pick.key}`, recherche: false }
    : {
        name: titre,
        url: urlRechercheBandeAnnonce(titre, date ? date.slice(0, 4) : null),
        recherche: true,
      };

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
    // Saga à laquelle appartient un film (TMDB n'en connaît pas pour les séries).
    collection: data.belongs_to_collection
      ? { id: data.belongs_to_collection.id, name: data.belongs_to_collection.name }
      : null,
  };
}

// Films d'une saga, dans l'**ordre de sortie**. L'ordre chronologique de
// l'histoire n'existe pas chez TMDB : on ne le promet pas. Un film sans date
// (annoncé, pas encore daté) passe en fin de liste.
export async function getCollection(id) {
  const data = await tmdbGet(`/collection/${id}`);
  return (data.parts || [])
    .map((p) => toCardItem(p, 'movie'))
    .sort((a, b) => {
      if (!a.releaseDate) return 1;
      if (!b.releaseDate) return -1;
      return a.releaseDate < b.releaseDate ? -1 : 1;
    });
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

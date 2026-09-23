// M1 — fiche enrichie : acteurs cliquables, bande-annonce toujours présente.
// Le réseau est simulé : on vérifie ce que la fiche fait des réponses de TMDB.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDetails,
  getActorFilmography,
  urlRechercheBandeAnnonce,
} from '../src/tmdb.js';

const vues = [];

function fauxTmdb(routes) {
  vi.stubEnv('VITE_TMDB_API_KEY', 'cle-de-test');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const chemin = new URL(url).pathname.replace('/3', '');
      vues.push(chemin);
      const corps = routes[chemin];
      return { ok: corps !== undefined, status: corps ? 200 : 404, json: async () => corps };
    })
  );
}

beforeEach(() => {
  vues.length = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('bande-annonce', () => {
  it("sans vidéo TMDB, le bouton mène à la recherche YouTube « titre année bande-annonce »", async () => {
    fauxTmdb({
      '/movie/1': { title: 'Le Film', release_date: '2020-05-01', overview: 'x', videos: { results: [] } },
    });
    const { trailer } = await getDetails('movie', 1);
    expect(trailer.recherche).toBe(true);
    expect(trailer.url).toBe(urlRechercheBandeAnnonce('Le Film', '2020'));
    expect(trailer.url).toContain('youtube.com/results?search_query=');
    expect(decodeURIComponent(trailer.url)).toContain('Le Film 2020 bande-annonce');
  });

  it('avec une vidéo TMDB, le bouton mène à la vidéo elle-même', async () => {
    fauxTmdb({
      '/tv/2': {
        name: 'La Série',
        first_air_date: '2019-01-01',
        overview: 'x',
        videos: { results: [{ site: 'YouTube', type: 'Trailer', iso_639_1: 'fr', key: 'abc123', name: 'BA' }] },
      },
    });
    const { trailer } = await getDetails('tv', 2);
    expect(trailer.recherche).toBe(false);
    expect(trailer.url).toBe('https://www.youtube.com/watch?v=abc123');
  });

  it("le lien s'écrit sans année quand elle est inconnue", () => {
    expect(decodeURIComponent(urlRechercheBandeAnnonce('Titre', null))).toContain('Titre bande-annonce');
  });
});

describe('acteurs de la fiche', () => {
  it('la fiche garde 12 acteurs, chacun avec son identifiant TMDB', async () => {
    const cast = Array.from({ length: 20 }, (_, i) => ({ id: 100 + i, name: `Acteur ${i}` }));
    fauxTmdb({
      '/movie/3': { title: 'T', release_date: '2020-01-01', overview: 'x', credits: { cast } },
    });
    const { cast: garde } = await getDetails('movie', 3);
    expect(garde).toHaveLength(12);
    expect(garde[0].id).toBe(100);
  });

  it("toucher un acteur charge sa filmographie par son identifiant, sans passer par une recherche de nom", async () => {
    fauxTmdb({
      '/person/7': { id: 7, name: 'Jane Doe', profile_path: '/p.jpg' },
      '/person/7/combined_credits': {
        cast: [
          { id: 1, media_type: 'movie', title: 'Film A', release_date: '2001-01-01', popularity: 5, character: 'Anna' },
          { id: 2, media_type: 'tv', name: 'Série B', first_air_date: '2010-01-01', popularity: 9, character: 'Bea' },
          { id: 3, media_type: 'tv', name: 'Talk', first_air_date: '2011-01-01', popularity: 50, character: 'Herself' },
        ],
      },
    });
    const { person, results } = await getActorFilmography(7);
    expect(person.name).toBe('Jane Doe');
    expect(results.map((r) => r.title)).toEqual(['Série B', 'Film A']); // plus populaire d'abord, « Herself » écarté
    expect(vues.some((c) => c.includes('/search/person'))).toBe(false);
  });
});

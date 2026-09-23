// M5 — packs de mood : rayons éditorialisés (Super-héros, Braquage, Halloween,
// Romance). Le réseau est simulé : on vérifie ce que chaque mood demande à TMDB.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MOODS, getMoods, discoverByMood } from '../src/tmdb.js';
import { setCatalogLanguage } from '../src/lang.js';

const appels = [];

function fauxTmdb(reponse) {
  vi.stubEnv('VITE_TMDB_API_KEY', 'cle-de-test');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const u = new URL(url);
      appels.push({ chemin: u.pathname.replace('/3', ''), params: Object.fromEntries(u.searchParams) });
      return { ok: true, status: 200, json: async () => reponse(u.pathname.replace('/3', '')) };
    })
  );
}

beforeEach(() => {
  appels.length = 0;
  setCatalogLanguage('fr');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('liste des moods', () => {
  it('propose les 4 moods retenus, un nom dans la langue du catalogue', async () => {
    expect(MOODS.map((m) => m.key)).toEqual(['superheros', 'braquage', 'halloween', 'romance']);
    setCatalogLanguage('fr');
    expect((await getMoods()).find((m) => m.key === 'halloween').name).toBe('Halloween');
    setCatalogLanguage('en');
    expect((await getMoods()).find((m) => m.key === 'superheros').name).toBe('Superheroes');
    setCatalogLanguage('fr');
  });

  it("Romance n'a rien à proposer côté séries : TMDB n'a pas ce genre pour les séries", async () => {
    fauxTmdb(() => ({ results: [] }));
    await discoverByMood({ mood: 'romance', movie: true, tv: true });
    expect(appels).toHaveLength(1);
    expect(appels[0].chemin).toBe('/discover/movie');
  });

  it('Super-héros et Braquage marchent pour les films et les séries, avec un seuil de votes', async () => {
    fauxTmdb(() => ({ results: [] }));
    await discoverByMood({ mood: 'superheros', movie: true, tv: true });
    expect(appels.map((a) => a.chemin).sort()).toEqual(['/discover/movie', '/discover/tv']);
    for (const a of appels) {
      expect(a.params.with_keywords).toBeTruthy();
      expect(Number(a.params['vote_count.gte'])).toBeGreaterThan(0);
    }
  });

  it('Halloween : genre Horreur pour les films, mot-clé pour les séries (TMDB n’a pas ce genre côté séries)', async () => {
    fauxTmdb(() => ({ results: [] }));
    await discoverByMood({ mood: 'halloween', movie: true, tv: false });
    expect(appels[0].params.with_genres).toBe('27');
    expect(appels[0].params.with_keywords).toBeUndefined();
    appels.length = 0;
    await discoverByMood({ mood: 'halloween', movie: false, tv: true });
    expect(appels[0].params.with_genres).toBeUndefined();
    expect(appels[0].params.with_keywords).toBeTruthy();
  });

  it('un mood inconnu ne demande rien', async () => {
    fauxTmdb(() => ({ results: [] }));
    await discoverByMood({ mood: 'inexistant', movie: true, tv: true });
    expect(appels).toHaveLength(0);
  });

  it('les résultats sont triés par popularité, films et séries réunis', async () => {
    fauxTmdb((chemin) => ({
      results: chemin.endsWith('/movie')
        ? [{ id: 1, title: 'Film', popularity: 5, release_date: '2020-01-01' }]
        : [{ id: 2, name: 'Série', popularity: 20, first_air_date: '2020-01-01' }],
    }));
    const items = await discoverByMood({ mood: 'braquage', movie: true, tv: true });
    expect(items.map((i) => i.title)).toEqual(['Série', 'Film']);
  });
});

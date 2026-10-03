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
  it('propose les 4 thèmes puis les 4 sélections, un nom dans la langue du catalogue', async () => {
    expect(MOODS.map((m) => m.key)).toEqual([
      'superheros', 'braquage', 'halloween', 'romance',
      'pepites', 'courts', 'classiques', 'annee',
    ]);
    expect((await getMoods()).filter((m) => m.groupe === 'selection')).toHaveLength(4);
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

describe('sélections (note, durée, époque)', () => {
  it('Pépites cachées : bien noté, plafond de votes, triées par note', async () => {
    fauxTmdb(() => ({ results: [] }));
    await discoverByMood({ mood: 'pepites', movie: true, tv: false });
    expect(appels[0].params).toMatchObject({
      sort_by: 'vote_average.desc',
      'vote_average.gte': '7.6',
      'vote_count.lte': '5000',
    });
    // Rien de moins d'un an (notes de nouveautés gonflées par les fans).
    const limite = new Date(Date.now() - 360 * 864e5).toISOString().slice(0, 10);
    expect(appels[0].params['primary_release_date.lte'] <= limite).toBe(true);
  });

  it('Soirée courte : films de 60 à 90 minutes, séries de 30 minutes au plus', async () => {
    fauxTmdb(() => ({ results: [] }));
    await discoverByMood({ mood: 'courts' });
    const film = appels.find((a) => a.chemin === '/discover/movie').params;
    const serie = appels.find((a) => a.chemin === '/discover/tv').params;
    expect(film).toMatchObject({ 'with_runtime.gte': '60', 'with_runtime.lte': '90' });
    expect(serie['with_runtime.lte']).toBe('30');
  });

  it("Le meilleur de l'année : seulement l'année en cours, déjà sorti", async () => {
    fauxTmdb(() => ({ results: [] }));
    await discoverByMood({ mood: 'annee', movie: true, tv: false });
    const an = String(new Date().getUTCFullYear());
    const p = appels[0].params;
    expect(p['primary_release_date.gte']).toBe(`${an}-01-01`);
    expect(p['primary_release_date.lte'] <= new Date().toISOString().slice(0, 10)).toBe(true);
  });

  it('« Sur mes plateformes » ajoute les plateformes et la région à la demande', async () => {
    fauxTmdb(() => ({ results: [] }));
    await discoverByMood({ mood: 'halloween', movie: true, tv: false, plateformes: [8, 337] });
    expect(appels[0].params).toMatchObject({ with_watch_providers: '8|337', watch_region: 'FR' });
  });
});

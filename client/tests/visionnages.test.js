// M4 — journal de visionnages : une ligne par visionnage (pas un compteur),
// par épisode pour une série. Cocher un épisode ou marquer un film « vu »
// pose un premier visionnage automatiquement ; « J'ai revu » en ajoute un de
// plus, à volonté.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/tmdb.js', () => ({
  getSeriesStructure: vi.fn(),
  getEpisodes: vi.fn(),
  getRecommendations: vi.fn(),
  getCardInfo: vi.fn(),
  getRuntime: vi.fn(),
}));

const FILM = { id: 1, mediaType: 'movie', title: 'Un film', year: '2020' };
const SERIE = { id: 100, mediaType: 'tv', title: 'Une série', year: '2019' };
const SAISONS = [{ seasonNumber: 1, episodeCount: 2 }];
const DERNIER_DIFFUSE = { season: 1, episode: 2 };
const EPISODES = {
  1: [
    { episodeNumber: 1, name: 'S1E1', airDate: '2019-01-01' },
    { episodeNumber: 2, name: 'S1E2', airDate: '2019-01-08' },
  ],
};

let store, db, tmdb, profil;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  db = await import('../src/db.js');
  store = await import('../src/store.js');
  tmdb = await import('../src/tmdb.js');
  vi.clearAllMocks();
  tmdb.getSeriesStructure.mockResolvedValue({ seasons: SAISONS, lastAired: DERNIER_DIFFUSE });
  tmdb.getEpisodes.mockImplementation(async (_id, saison) => EPISODES[saison] || []);
  await db.initDb();
  [profil] = await store.listProfiles();
  await store.addToSuivi(profil.id, FILM);
  await store.addToSuivi(profil.id, SERIE);
});

describe('films', () => {
  it('passer à « Vu » pose un premier visionnage, à la date du jour', async () => {
    await store.setStatus(profil.id, 'movie', 1, 'vu');
    const v = await store.listVisionnages(profil.id, 'movie', 1);
    expect(v).toHaveLength(1);
    expect(v[0].date).toBe(new Date().toISOString().slice(0, 10));
    expect(v[0].season).toBeNull();
  });

  it('cliquer deux fois sur « Vu » ne repose pas de visionnage (pas un aller-retour)', async () => {
    await store.setStatus(profil.id, 'movie', 1, 'vu');
    await store.setStatus(profil.id, 'movie', 1, 'vu');
    expect(await store.listVisionnages(profil.id, 'movie', 1)).toHaveLength(1);
  });

  it('repasser par « Vu » après être passé par un autre statut pose un nouveau visionnage', async () => {
    // Un aller-retour par « En cours » est une vraie reprise : ça compte comme
    // un visionnage de plus, pas un doublon d'un même clic.
    await store.setStatus(profil.id, 'movie', 1, 'vu');
    await store.setStatus(profil.id, 'movie', 1, 'en_cours');
    await store.setStatus(profil.id, 'movie', 1, 'vu');
    expect(await store.listVisionnages(profil.id, 'movie', 1)).toHaveLength(2);
  });

  it('un titre jamais marqué « vu » n’a aucun visionnage', async () => {
    await store.setStatus(profil.id, 'movie', 1, 'en_cours');
    expect(await store.listVisionnages(profil.id, 'movie', 1)).toHaveLength(0);
  });

  it('« J’ai revu » ajoute un visionnage de plus, sans limite', async () => {
    await store.setStatus(profil.id, 'movie', 1, 'vu');
    await store.addVisionnage(profil.id, 'movie', 1, { date: '2026-01-01' });
    await store.addVisionnage(profil.id, 'movie', 1, { date: '2026-06-15' });
    const v = await store.listVisionnages(profil.id, 'movie', 1);
    expect(v).toHaveLength(3);
    expect(v.map((x) => x.date)).toEqual([
      new Date().toISOString().slice(0, 10),
      '2026-06-15',
      '2026-01-01',
    ]); // du plus récent au plus ancien
  });

  it('supprime une entrée du journal (correction d’une erreur)', async () => {
    await store.addVisionnage(profil.id, 'movie', 1, { date: '2026-01-01' });
    const [{ id }] = await store.listVisionnages(profil.id, 'movie', 1);
    await store.deleteVisionnage(profil.id, id);
    expect(await store.listVisionnages(profil.id, 'movie', 1)).toHaveLength(0);
  });
});

describe('séries, par épisode', () => {
  it('cocher un épisode pose un visionnage pour cet épisode précis', async () => {
    await store.markEpisode(profil.id, 100, 1, 1);
    const v = await store.listVisionnages(profil.id, 'tv', 100);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ season: 1, episode: 1 });
  });

  it('décocher puis recocher le même épisode repose un visionnage (deux au total)', async () => {
    await store.markEpisode(profil.id, 100, 1, 1);
    await store.unmarkEpisode(profil.id, 100, 1, 1);
    await store.markEpisode(profil.id, 100, 1, 1);
    expect(await store.listVisionnages(profil.id, 'tv', 100)).toHaveLength(2);
  });

  it('cocher un épisode déjà coché (double clic) ne repose rien', async () => {
    await store.markEpisode(profil.id, 100, 1, 1);
    await store.markEpisode(profil.id, 100, 1, 1);
    expect(await store.listVisionnages(profil.id, 'tv', 100)).toHaveLength(1);
  });

  it('« Toute la saison » ne pose un visionnage que pour les épisodes réellement nouveaux', async () => {
    await store.markEpisode(profil.id, 100, 1, 1); // déjà vu
    await store.markWholeSeason(profil.id, 100, 1, [1, 2]);
    const v = await store.listVisionnages(profil.id, 'tv', 100);
    expect(v).toHaveLength(2); // E1 (1er coup) + E2 — pas un 2e pour E1
    expect(v.filter((e) => e.episode === 1)).toHaveLength(1);
  });

  it('recocher une saison déjà entièrement vue ne pose aucun visionnage de plus', async () => {
    await store.markWholeSeason(profil.id, 100, 1, [1, 2]);
    await store.markWholeSeason(profil.id, 100, 1, [1, 2]);
    expect(await store.listVisionnages(profil.id, 'tv', 100)).toHaveLength(2);
  });

  it('« J’ai vu toute la série » pose un visionnage par épisode diffusé, une seule fois', async () => {
    await store.markSeriesWatched(profil.id, 100);
    const v = await store.listVisionnages(profil.id, 'tv', 100);
    expect(v).toHaveLength(2); // seuls S1E1 et S1E2 sont diffusés
  });

  it('« J’ai revu cet épisode » ajoute un visionnage sans toucher à la case cochée', async () => {
    await store.markEpisode(profil.id, 100, 1, 1);
    await store.addVisionnage(profil.id, 'tv', 100, { season: 1, episode: 1, date: '2026-02-02' });
    expect(await store.listVisionnages(profil.id, 'tv', 100)).toHaveLength(2);
    const episodes = await store.getSeasonEpisodes(profil.id, 100, 1);
    expect(episodes.find((e) => e.episodeNumber === 1).watched).toBe(true);
  });
});

describe('sauvegarde', () => {
  it('exporte le journal et le restaure à l’identique sur un autre profil', async () => {
    await store.setStatus(profil.id, 'movie', 1, 'vu');
    await store.markEpisode(profil.id, 100, 1, 1);
    const backup = await import('../src/backup.js');
    const fichier = await backup.exportProfile(profil.id);
    expect(fichier.visionnages).toHaveLength(2);
    expect(fichier.version).toBe(3);

    const autreId = crypto.randomUUID();
    await backup.importProfile({ ...fichier, profile: { ...fichier.profile, id: autreId } });
    expect(await store.listVisionnages(autreId, 'tv', 100)).toHaveLength(1);
  });

  it('une sauvegarde d’avant M4 (sans champ visionnages) se restaure sans erreur', async () => {
    const backup = await import('../src/backup.js');
    const fichier = await backup.exportProfile(profil.id);
    delete fichier.visionnages;
    const autreId = crypto.randomUUID();
    await expect(
      backup.importProfile({ ...fichier, profile: { ...fichier.profile, id: autreId } })
    ).resolves.toBe(autreId);
    expect(await store.listVisionnages(autreId, 'movie', 1)).toHaveLength(0);
  });

  it('l’export CSV utilise le dernier visionnage, pas la date d’ajout', async () => {
    // Statut « vu » posé sans passer par setStatus (qui aurait ajouté un
    // visionnage à aujourd'hui) : ce test veut comparer deux dates passées.
    await store.setStatus(profil.id, 'movie', 1, 'en_cours');
    await store.addVisionnage(profil.id, 'movie', 1, { date: '2020-05-01' });
    await store.addVisionnage(profil.id, 'movie', 1, { date: '2024-12-25' }); // le plus récent
    const backup = await import('../src/backup.js');
    const fichier = await backup.exportProfile(profil.id);
    const { csv } = backup.toLetterboxdCsv(fichier.suivi, fichier.visionnages);
    expect(csv.split('\n')[1]).toContain(',2024-12-25,');
  });

  it('sans journal, l’export CSV retombe sur la date d’ajout (comportement d’avant M4)', async () => {
    await store.setStatus(profil.id, 'movie', 1, 'vu');
    const backup = await import('../src/backup.js');
    const fichier = await backup.exportProfile(profil.id);
    const { csv } = backup.toLetterboxdCsv(fichier.suivi); // sans 2e argument
    expect(csv.split('\n')[1]).toContain((fichier.suivi[0].addedAt || '').slice(0, 10));
  });
});

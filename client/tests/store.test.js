// Les règles métier : suivi, épisodes, listes, langue du catalogue,
// suggestions. Le catalogue TMDB est remplacé par un catalogue de test —
// on vérifie les règles de l'application, pas le contenu de TMDB.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/tmdb.js', () => ({
  getSeriesStructure: vi.fn(),
  getEpisodes: vi.fn(),
  getRecommendations: vi.fn(),
  getCardInfo: vi.fn(),
  getRuntime: vi.fn(),
  getNotifInfo: vi.fn(),
}));

const FILM = { id: 1, mediaType: 'movie', title: 'Un film', year: '2020' };
const SERIE = { id: 100, mediaType: 'tv', title: 'Une série', year: '2019' };

// Série de test : 2 saisons de 2 épisodes. Le tout dernier n'est pas encore
// diffusé — c'est le cas qui distingue « à jour » de « il reste à voir ».
const SAISONS = [
  { seasonNumber: 1, episodeCount: 2 },
  { seasonNumber: 2, episodeCount: 2 },
];
// Dernier épisode réellement sorti : S2E1. Le S2E2 est annoncé pour 2999.
const DERNIER_DIFFUSE = { season: 2, episode: 1 };
const EPISODES = {
  1: [
    { episodeNumber: 1, name: 'S1E1', airDate: '2019-01-01' },
    { episodeNumber: 2, name: 'S1E2', airDate: '2019-01-08' },
  ],
  2: [
    { episodeNumber: 1, name: 'S2E1', airDate: '2020-01-01' },
    { episodeNumber: 2, name: 'S2E2', airDate: '2999-01-01' },
  ],
};

let store, db, tmdb, profil;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  db = await import('../src/db.js');
  store = await import('../src/store.js');
  tmdb = await import('../src/tmdb.js');
  // `vi.resetModules()` rend les modules, pas les fausses fonctions : sans ce
  // nettoyage, les appels comptés dans un test s'ajoutaient au suivant.
  vi.clearAllMocks();
  tmdb.getSeriesStructure.mockResolvedValue({ seasons: SAISONS, lastAired: DERNIER_DIFFUSE });
  tmdb.getEpisodes.mockImplementation(async (_id, saison) => EPISODES[saison] || []);
  await db.initDb();
  [profil] = await store.listProfiles();
});

describe('profils', () => {
  it('crée un profil avec un identifiant portable et le renomme', async () => {
    const nouveau = await store.createProfile('Marie');
    expect(nouveau.id).toMatch(/^[0-9a-f-]{36}$/);
    await store.renameProfile(nouveau.id, 'Marie L.');
    const profils = await store.listProfiles();
    expect(profils.find((p) => p.id === nouveau.id).name).toBe('Marie L.');
  });

  it('refuse de renommer un profil inexistant', async () => {
    await expect(store.renameProfile('inconnu', 'X')).rejects.toThrow('introuvable');
  });
});

describe('gestion des profils', () => {
  it('habille un profil et garde son avatar', async () => {
    const p = await store.createProfile('Marie', 'bleu:film');
    expect((await store.listProfiles()).find((x) => x.id === p.id).avatar).toBe('bleu:film');
    await store.setProfileAvatar(p.id, 'vert:star');
    expect((await store.listProfiles()).find((x) => x.id === p.id).avatar).toBe('vert:star');
  });

  it('annonce ce que la suppression emporterait', async () => {
    await store.addToSuivi(profil.id, FILM);
    await store.addToSuivi(profil.id, SERIE);
    await store.markWholeSeason(profil.id, 100, 1, [1, 2]);
    await store.createListe(profil.id, 'Soirée');
    expect(await store.countProfileData(profil.id)).toEqual({
      titres: 2,
      episodes: 2,
      listes: 1,
    });
  });

  it('supprime un profil avec tout son contenu, sans toucher aux autres', async () => {
    const marie = await store.createProfile('Marie');
    await store.addToSuivi(marie.id, FILM);
    await store.addToSuivi(marie.id, SERIE);
    await store.markWholeSeason(marie.id, 100, 1, [1, 2]);
    await store.createListe(marie.id, 'Soirée');
    await store.addToSuivi(profil.id, FILM); // l'autre profil, à préserver

    const repli = await store.deleteProfile(marie.id);
    expect(repli).toBe(profil.id);
    expect((await store.listProfiles()).map((p) => p.id)).toEqual([profil.id]);
    expect(await store.countProfileData(marie.id)).toEqual({
      titres: 0,
      episodes: 0,
      listes: 0,
    });
    // Le suivi de l'autre profil est intact.
    expect(await store.listSuivi(profil.id)).toHaveLength(1);
  });

  it('refuse de supprimer le dernier profil', async () => {
    await expect(store.deleteProfile(profil.id)).rejects.toThrow(/seul profil/i);
  });

  it('refuse de supprimer un profil inexistant', async () => {
    await store.createProfile('Marie');
    await expect(store.deleteProfile('inconnu')).rejects.toThrow(/introuvable/i);
  });
});

describe('suivi', () => {
  it('ajoute un titre, sans jamais créer de doublon', async () => {
    await store.addToSuivi(profil.id, FILM);
    await store.addToSuivi(profil.id, { ...FILM, title: 'Autre titre' });
    const suivi = await store.listSuivi(profil.id);
    expect(suivi).toHaveLength(1);
    // Ré-ajouter ne réécrit pas la fiche : le statut déjà posé est préservé.
    expect(suivi[0].title).toBe('Un film');
    expect(suivi[0].status).toBe('a_voir');
  });

  it('refuse un titre incomplet', async () => {
    await expect(store.addToSuivi(profil.id, { id: 5 })).rejects.toThrow('requis');
  });

  it('sépare le suivi de deux profils', async () => {
    const autre = await store.createProfile('Marie');
    await store.addToSuivi(profil.id, FILM);
    expect(await store.listSuivi(autre.id)).toHaveLength(0);
  });

  it('change le statut, et refuse un statut inventé', async () => {
    await store.addToSuivi(profil.id, FILM);
    await store.setStatus(profil.id, 'movie', 1, 'vu');
    expect((await store.listSuivi(profil.id))[0].status).toBe('vu');
    await expect(store.setStatus(profil.id, 'movie', 1, 'peut_etre')).rejects.toThrow(
      'invalide'
    );
  });

  it("refuse de changer le statut d'un titre non suivi", async () => {
    await expect(store.setStatus(profil.id, 'movie', 42, 'vu')).rejects.toThrow('absent');
  });

  it('retire un titre du suivi', async () => {
    await store.addToSuivi(profil.id, FILM);
    await store.removeFromSuivi(profil.id, 'movie', 1);
    expect(await store.listSuivi(profil.id)).toHaveLength(0);
  });
});

describe('épisodes et progression', () => {
  beforeEach(async () => {
    await store.addToSuivi(profil.id, SERIE);
  });

  it('coche et décoche un épisode', async () => {
    await store.markEpisode(profil.id, 100, 1, 1);
    await store.markEpisode(profil.id, 100, 1, 1); // deux fois : sans effet
    expect((await store.getProgress(profil.id, 100)).watched).toBe(1);
    await store.unmarkEpisode(profil.id, 100, 1, 1);
    expect((await store.getProgress(profil.id, 100)).watched).toBe(0);
  });

  it('coche et décoche une saison entière', async () => {
    await store.markWholeSeason(profil.id, 100, 1, [1, 2]);
    expect((await store.getProgress(profil.id, 100)).watched).toBe(2);
    await store.unmarkWholeSeason(profil.id, 100, 1);
    expect((await store.getProgress(profil.id, 100)).watched).toBe(0);
  });

  it("marque les épisodes vus dans la liste d'une saison", async () => {
    await store.markEpisode(profil.id, 100, 1, 2);
    const eps = await store.getSeasonEpisodes(profil.id, 100, 1);
    expect(eps.map((e) => e.watched)).toEqual([false, true]);
  });

  it('annonce le prochain épisode à voir', async () => {
    const debut = await store.getProgress(profil.id, 100);
    expect(debut.total).toBe(4);
    expect(debut.next).toMatchObject({ season: 1, episode: 1 });

    await store.markWholeSeason(profil.id, 100, 1, [1, 2]);
    expect((await store.getProgress(profil.id, 100)).next).toMatchObject({
      season: 2,
      episode: 1,
    });
  });

  it('next porte la date de diffusion', async () => {
    const debut = await store.getProgress(profil.id, 100);
    expect(debut.next.airDate).toBe('2019-01-01');
    await store.markWholeSeason(profil.id, 100, 1, [1, 2]);
    expect((await store.getProgress(profil.id, 100)).next.airDate).toBe('2020-01-01');
  });

  it("ne propose pas un épisode qui n'est pas encore diffusé", async () => {
    await store.markWholeSeason(profil.id, 100, 1, [1, 2]);
    await store.markEpisode(profil.id, 100, 2, 1);
    const progression = await store.getProgress(profil.id, 100);
    expect(progression.watched).toBe(3);
    expect(progression.next).toBeNull(); // à jour : le dernier sort en 2999
  });

  it('compte à part les épisodes annoncés et ceux réellement diffusés', async () => {
    const progression = await store.getProgress(profil.id, 100);
    expect(progression.total).toBe(4); // annoncés
    expect(progression.aired).toBe(3); // sortis (le S2E2 est pour 2999)
  });

  it("dit qu'on est à jour dès que tout ce qui est sorti est vu", async () => {
    await store.markWholeSeason(profil.id, 100, 1, [1, 2]);
    await store.markEpisode(profil.id, 100, 2, 1);
    const p = await store.getProgress(profil.id, 100);
    // C'est ce test qui protège « Reprendre » : tout vu de ce qui est sorti,
    // donc pas de prochain épisode — la série n'a plus rien à reprendre,
    // même si elle n'est pas terminée (watched < total).
    expect(p.watched).toBe(p.aired);
    expect(p.watched).toBeLessThan(p.total);
    expect(p.next).toBeNull();
  });

  it("coche une saison entière sans avoir à la déplier", async () => {
    const coches = await store.markSeasonWatched(profil.id, 100, 1);
    expect(coches).toBe(2);
    expect((await store.getProgress(profil.id, 100)).watched).toBe(2);
  });

  it("« j'ai vu toute la série » ne coche que ce qui est sorti", async () => {
    const coches = await store.markSeriesWatched(profil.id, 100);
    expect(coches).toBe(3); // le S2E2 est annoncé pour 2999 : pas coché
    const p = await store.getProgress(profil.id, 100);
    expect(p.watched).toBe(3);
    expect(p.next).toBeNull(); // à jour, donc plus rien à reprendre
    // Elle n'est pas déclarée terminée pour autant : il reste un épisode à venir.
    expect(p.watched).toBeLessThan(p.total);
  });

  it("décoche toute la série d'un coup", async () => {
    await store.markSeriesWatched(profil.id, 100);
    await store.unmarkSeriesWatched(profil.id, 100);
    expect((await store.getProgress(profil.id, 100)).watched).toBe(0);
  });

  it("donne l'avancement saison par saison, sur les épisodes sortis", async () => {
    await store.markEpisode(profil.id, 100, 1, 1);
    const saisons = await store.getSeasonsProgress(profil.id, 100);
    expect(saisons).toMatchObject([
      { seasonNumber: 1, episodeCount: 2, aired: 2, watched: 1 },
      { seasonNumber: 2, episodeCount: 2, aired: 1, watched: 0 },
    ]);
  });

  it('ne compte aucun épisode diffusé sur une série pas encore sortie', async () => {
    tmdb.getSeriesStructure.mockResolvedValue({ seasons: SAISONS, lastAired: null });
    const p = await store.getProgress(profil.id, 100);
    expect(p.aired).toBe(0);
    expect(p.total).toBe(4);
  });
});

describe('dates de sortie', () => {
  // Deux histoires en une : « Avatar 4 », enregistré avant que l'application ne
  // retienne la date de sortie (sans date, il passait pour un film sorti), et
  // la date du pays de la langue choisie.
  beforeEach(async () => {
    await store.addToSuivi(profil.id, { id: 216527, mediaType: 'movie', title: 'Avatar 4' });
  });

  it('complète la date auprès du catalogue et laisse le reste tranquille', async () => {
    tmdb.getCardInfo.mockResolvedValue({
      title: 'Avatar 4',
      year: '2029',
      releaseDate: '2029-12-19',
    });
    expect(await store.backfillReleaseDates()).toBe(1);
    const [ligne] = await store.listSuivi(profil.id);
    expect(ligne).toMatchObject({ releaseDate: '2029-12-19', year: '2029' });
  });

  it('demande la date du pays qui va avec la langue', async () => {
    tmdb.getCardInfo.mockResolvedValue({ releaseDate: '2029-12-19' });
    await store.backfillReleaseDates();
    // Français → France. Le pays n'est pas un réglage de plus : il découle de
    // la langue du catalogue.
    expect(tmdb.getCardInfo).toHaveBeenCalledWith('movie', 216527, 'fr-FR', 'FR');
  });

  it('remplace la date quand elle vient d’un autre pays', async () => {
    // Le film a été ajouté avec la date mondiale, avant tout réglage de pays.
    await store.addToSuivi(profil.id, {
      id: 1,
      mediaType: 'movie',
      title: 'Un film',
      releaseDate: '2020-03-01',
    });
    tmdb.getCardInfo.mockResolvedValue({ releaseDate: '2020-06-23' });

    await store.backfillReleaseDates('FR');
    const film = (await store.listSuivi(profil.id)).find((t) => t.id === 1);
    expect(film.releaseDate).toBe('2020-06-23'); // date française
  });

  it('refait les dates quand on change de pays, une seule fois', async () => {
    tmdb.getCardInfo.mockResolvedValue({ releaseDate: '2029-12-19' });
    await store.backfillReleaseDates('FR');

    // Même pays : plus rien à demander.
    tmdb.getCardInfo.mockClear();
    expect(await store.backfillReleaseDates('FR')).toBe(0);
    expect(tmdb.getCardInfo).not.toHaveBeenCalled();

    // Pays différent : on redemande, et une seule fois.
    tmdb.getCardInfo.mockResolvedValue({ releaseDate: '2029-12-18' });
    expect(await store.backfillReleaseDates('US')).toBe(1);
    tmdb.getCardInfo.mockClear();
    expect(await store.backfillReleaseDates('US')).toBe(0);
    expect(tmdb.getCardInfo).not.toHaveBeenCalled();
  });

  it('ne redemande jamais une série quand le pays change', async () => {
    await store.addToSuivi(profil.id, SERIE);
    tmdb.getCardInfo.mockResolvedValue({ releaseDate: '2019-01-01' });
    await store.backfillReleaseDates('FR');

    // TMDB ne connaît qu'une date de première diffusion pour une série : elle
    // est rangée sous « monde » et sort définitivement du jeu.
    tmdb.getCardInfo.mockClear();
    await store.backfillReleaseDates('US');
    const demandes = tmdb.getCardInfo.mock.calls.map((c) => c[0]);
    expect(demandes).not.toContain('tv');
  });

  it("laisse la date vide quand le catalogue n'en a pas, sans y revenir sans fin", async () => {
    tmdb.getCardInfo.mockResolvedValue({ title: 'Avatar 4', releaseDate: null });
    expect(await store.backfillReleaseDates()).toBe(0);

    // La fiche a bien été obtenue, elle n'a simplement pas de date : inutile de
    // la redemander à chaque lancement.
    tmdb.getCardInfo.mockClear();
    await store.backfillReleaseDates();
    expect(tmdb.getCardInfo).not.toHaveBeenCalled();
  });

  it('retente au lancement suivant quand le réseau a coupé', async () => {
    tmdb.getCardInfo.mockRejectedValue(new Error('réseau'));
    expect(await store.backfillReleaseDates()).toBe(0);

    tmdb.getCardInfo.mockResolvedValue({ releaseDate: '2029-12-19' });
    expect(await store.backfillReleaseDates()).toBe(1);
  });
});

describe('notifications de sortie', () => {
  // `notif_en_attente` vaut 1 par défaut (colonne ajoutée avec DEFAULT 1) :
  // tout titre suivi entre dans le cycle tant qu'il n'a pas été classé une
  // première fois.
  beforeEach(async () => {
    await store.addToSuivi(profil.id, { id: 1, mediaType: 'movie', title: 'Un film' });
    await store.addToSuivi(profil.id, SERIE);
  });

  async function notifDeSuivi(mediaType, id) {
    const rows = await db.query(
      'SELECT notif_date AS notifDate, notif_en_attente AS notifEnAttente FROM suivi WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?',
      [profil.id, id, mediaType]
    );
    return rows[0];
  }

  it('garde en attente un film pas encore sorti, avec sa date', async () => {
    tmdb.getNotifInfo.mockResolvedValue({
      releaseDate: '2029-12-19',
      status: 'Post Production',
      nextEpisodeDate: null,
      seriesEnded: null,
    });
    expect(await store.checkNotifications(profil.id)).toBe(2);
    const film = await notifDeSuivi('movie', 1);
    expect(film).toMatchObject({ notifDate: '2029-12-19', notifEnAttente: 1 });
  });

  it('fait sortir du cycle un film déjà sorti', async () => {
    tmdb.getNotifInfo.mockResolvedValue({
      releaseDate: '2020-01-01',
      status: 'Released',
      nextEpisodeDate: null,
      seriesEnded: null,
    });
    await store.checkNotifications(profil.id);
    const film = await notifDeSuivi('movie', 1);
    expect(film).toMatchObject({ notifDate: null, notifEnAttente: 0 });
  });

  it('garde en attente une série en cours, avec la date du prochain épisode', async () => {
    tmdb.getNotifInfo.mockResolvedValue({
      releaseDate: '2019-01-01',
      status: null,
      nextEpisodeDate: '2026-10-05',
      seriesEnded: false,
    });
    await store.checkNotifications(profil.id);
    const serie = await notifDeSuivi('tv', SERIE.id);
    expect(serie).toMatchObject({ notifDate: '2026-10-05', notifEnAttente: 1 });
  });

  it('fait sortir du cycle une série terminée', async () => {
    tmdb.getNotifInfo.mockResolvedValue({
      releaseDate: '2019-01-01',
      status: null,
      nextEpisodeDate: null,
      seriesEnded: true,
    });
    await store.checkNotifications(profil.id);
    const serie = await notifDeSuivi('tv', SERIE.id);
    expect(serie).toMatchObject({ notifDate: null, notifEnAttente: 0 });
  });

  it("ne revérifie plus ce qui est déjà sorti du cycle", async () => {
    tmdb.getNotifInfo.mockResolvedValue({
      releaseDate: '2020-01-01',
      status: 'Released',
      nextEpisodeDate: null,
      seriesEnded: true,
    });
    await store.checkNotifications(profil.id);
    tmdb.getNotifInfo.mockClear();
    expect(await store.checkNotifications(profil.id)).toBe(0);
    expect(tmdb.getNotifInfo).not.toHaveBeenCalled();
  });

  it('sort du cycle un titre marqué « Vu » ou « Abandonné »', async () => {
    await store.setStatus(profil.id, 'movie', 1, 'vu');
    await store.setStatus(profil.id, 'tv', SERIE.id, 'abandonne');
    const film = await notifDeSuivi('movie', 1);
    const serie = await notifDeSuivi('tv', SERIE.id);
    expect(film.notifEnAttente).toBe(0);
    expect(serie.notifEnAttente).toBe(0);
  });

  it('retente au prochain cycle quand le réseau a coupé', async () => {
    tmdb.getNotifInfo.mockRejectedValue(new Error('réseau'));
    expect(await store.checkNotifications(profil.id)).toBe(0);

    tmdb.getNotifInfo.mockResolvedValue({
      releaseDate: '2029-12-19',
      status: 'Post Production',
      nextEpisodeDate: null,
      seriesEnded: null,
    });
    expect(await store.checkNotifications(profil.id)).toBe(2);
  });
});

describe('notifications de sortie : titres dus', () => {
  beforeEach(async () => {
    await store.addToSuivi(profil.id, { id: 1, mediaType: 'movie', title: 'Un film' });
    await store.addToSuivi(profil.id, SERIE);
    await poserDate(profil.id, 'movie', 1, '2026-09-27'); // aujourd'hui : dû
    await poserDate(profil.id, 'tv', SERIE.id, '2029-01-01'); // dans le futur : pas dû
  });

  // Pose directement `notif_date` (sans passer par `checkNotifications`, déjà
  // testé plus haut) : ce qui est testé ici, c'est la sélection des titres
  // dus, pas leur classification.
  async function poserDate(profileId, mediaType, id, date) {
    await db.run(
      'UPDATE suivi SET notif_date = ? WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?',
      [date, profileId, id, mediaType]
    );
  }

  it('prend un titre dont la date est aujourd’hui, laisse le reste tranquille', async () => {
    const dus = await store.takeDueNotifications(profil.id, '2026-09-27');
    expect(dus).toEqual([{ id: 1, mediaType: 'movie', title: 'Un film' }]);
  });

  it('prend aussi un titre dont la date est déjà passée', async () => {
    await poserDate(profil.id, 'tv', SERIE.id, '2026-09-01'); // déjà passée
    const dus = await store.takeDueNotifications(profil.id, '2026-09-27');
    expect(dus.map((t) => t.id).sort()).toEqual([1, SERIE.id].sort());
  });

  it('fait sortir du cycle ce qui vient d’être pris, une seule fois', async () => {
    expect(await store.takeDueNotifications(profil.id, '2026-09-27')).toHaveLength(1);
    expect(await store.takeDueNotifications(profil.id, '2026-09-27')).toEqual([]);
  });

  it('ne prend rien tant qu’aucune date n’est dépassée', async () => {
    expect(await store.takeDueNotifications(profil.id, '2020-01-01')).toEqual([]);
  });
});

describe('statistiques', () => {
  beforeEach(async () => {
    await store.addToSuivi(profil.id, FILM); // 1h30
    await store.addToSuivi(profil.id, SERIE); // 45 min l'épisode
    tmdb.getRuntime.mockImplementation(async (mediaType) =>
      mediaType === 'movie' ? 90 : 45
    );
  });

  it('mesure les durées une fois, puis ne redemande plus rien', async () => {
    expect(await store.backfillRuntimes()).toEqual({ total: 2, done: 2 });
    tmdb.getRuntime.mockClear();
    expect(await store.backfillRuntimes()).toEqual({ total: 0, done: 0 });
    expect(tmdb.getRuntime).not.toHaveBeenCalled();
  });

  it('ne compte que ce qui a été réellement regardé', async () => {
    await store.backfillRuntimes();

    // Rien de vu : aucun temps, même si les titres sont suivis.
    let stats = await store.getStats(profil.id);
    expect(stats.titres).toBe(2);
    expect(stats.minutesTotal).toBe(0);

    // Un film vu (90) + 3 épisodes cochés (3 × 45 = 135).
    await store.setStatus(profil.id, 'movie', 1, 'vu');
    await store.markWholeSeason(profil.id, 100, 1, [1, 2]);
    await store.markEpisode(profil.id, 100, 2, 1);

    stats = await store.getStats(profil.id);
    expect(stats.minutesFilms).toBe(90);
    expect(stats.minutesSeries).toBe(135);
    expect(stats.minutesTotal).toBe(225);
    expect(stats.episodesVus).toBe(3);
    expect(stats.filmsVus).toBe(1);
    expect(stats.parStatut).toMatchObject({ vu: 1 });
  });

  it('signale les titres dont la durée est inconnue au lieu de les estimer', async () => {
    tmdb.getRuntime.mockResolvedValue(null); // TMDB ne sait pas
    await store.backfillRuntimes();
    await store.setStatus(profil.id, 'movie', 1, 'vu');

    const stats = await store.getStats(profil.id);
    expect(stats.minutesTotal).toBe(0);
    expect(stats.sansDuree).toBe(1);
    // Durée inconnue enregistrée quand même : plus rien à redemander.
    expect(stats.enAttenteDeMesure).toBe(0);
  });

  it('donne la moyenne des notes, en ignorant les titres non notés', async () => {
    await store.setNote(profil.id, 'movie', 1, { note: '', rating: 5 });
    await store.setNote(profil.id, 'tv', 100, { note: '', rating: 4 });
    const stats = await store.getStats(profil.id);
    expect(stats.notes).toBe(2);
    expect(stats.noteMoyenne).toBe(4.5);
  });
});

describe('note personnelle', () => {
  beforeEach(async () => {
    await store.addToSuivi(profil.id, FILM);
  });

  it('enregistre une note en étoiles et un avis, et les relit', async () => {
    await store.setNote(profil.id, 'movie', 1, { note: '  Une claque.  ', rating: 5 });
    expect(await store.getNote(profil.id, 'movie', 1)).toEqual({
      note: 'Une claque.', // les espaces autour sont retirés
      rating: 5,
    });
  });

  it('accepte une note sans avis, et un avis sans note', async () => {
    await store.setNote(profil.id, 'movie', 1, { note: '', rating: 3 });
    expect(await store.getNote(profil.id, 'movie', 1)).toEqual({ note: '', rating: 3 });

    await store.setNote(profil.id, 'movie', 1, { note: 'Bien vu.', rating: null });
    expect(await store.getNote(profil.id, 'movie', 1)).toEqual({
      note: 'Bien vu.',
      rating: null,
    });
  });

  it('refuse une note hors de 1 à 5', async () => {
    await expect(
      store.setNote(profil.id, 'movie', 1, { note: '', rating: 6 })
    ).rejects.toThrow(/invalide/i);
    await expect(
      store.setNote(profil.id, 'movie', 1, { note: '', rating: 0 })
    ).rejects.toThrow(/invalide/i);
  });

  it("refuse de noter un titre qui n'est pas suivi", async () => {
    await expect(
      store.setNote(profil.id, 'movie', 999, { note: 'x', rating: 4 })
    ).rejects.toThrow(/absent/i);
  });

  it('la note voyage avec le suivi', async () => {
    await store.setNote(profil.id, 'movie', 1, { note: 'Mon avis', rating: 4 });
    const [ligne] = await store.listSuivi(profil.id);
    expect(ligne).toMatchObject({ id: 1, note: 'Mon avis', rating: 4 });
  });

  it('retirer un titre du suivi emporte sa note', async () => {
    await store.setNote(profil.id, 'movie', 1, { note: 'Mon avis', rating: 4 });
    await store.removeFromSuivi(profil.id, 'movie', 1);
    await store.addToSuivi(profil.id, FILM);
    expect(await store.getNote(profil.id, 'movie', 1)).toEqual({ note: '', rating: null });
  });
});

describe('listes personnalisées', () => {
  it('ajouter à une liste met aussi le titre dans le suivi', async () => {
    const liste = await store.createListe(profil.id, 'Soirée');
    await store.addToListe(profil.id, liste.id, FILM);
    expect(await store.listSuivi(profil.id)).toHaveLength(1);
    expect(await store.getListeItems(profil.id, liste.id)).toHaveLength(1);
    expect(await store.getItemListes(profil.id, 'movie', 1)).toEqual([liste.id]);
  });

  it('compte les éléments de chaque liste', async () => {
    const liste = await store.createListe(profil.id, 'Soirée');
    await store.addToListe(profil.id, liste.id, FILM);
    await store.addToListe(profil.id, liste.id, SERIE);
    expect((await store.listListes(profil.id))[0].count).toBe(2);
  });

  it("retirer d'une liste ne retire pas du suivi", async () => {
    const liste = await store.createListe(profil.id, 'Soirée');
    await store.addToListe(profil.id, liste.id, FILM);
    await store.removeFromListe(profil.id, liste.id, 'movie', 1);
    expect(await store.getListeItems(profil.id, liste.id)).toHaveLength(0);
    expect(await store.listSuivi(profil.id)).toHaveLength(1);
  });

  it('retirer du suivi vide le titre de toutes les listes', async () => {
    const liste = await store.createListe(profil.id, 'Soirée');
    await store.addToListe(profil.id, liste.id, FILM);
    await store.removeFromSuivi(profil.id, 'movie', 1);
    expect(await store.getListeItems(profil.id, liste.id)).toHaveLength(0);
  });

  it('supprimer une liste ne touche pas le suivi', async () => {
    const liste = await store.createListe(profil.id, 'Soirée');
    await store.addToListe(profil.id, liste.id, FILM);
    await store.deleteListe(profil.id, liste.id);
    expect(await store.listListes(profil.id)).toHaveLength(0);
    expect(await store.listSuivi(profil.id)).toHaveLength(1);
  });
});

describe('langue du catalogue', () => {
  it('marque les fiches existantes sans rien re-télécharger', async () => {
    await store.addToSuivi(profil.id, FILM);
    await db.run('UPDATE suivi SET lang = NULL');
    expect(await store.countPendingLanguage('fr')).toBe(1);
    await store.stampLanguage('fr');
    expect(await store.countPendingLanguage('fr')).toBe(0);
    expect(tmdb.getCardInfo).not.toHaveBeenCalled();
  });

  it('re-télécharge les fiches et laisse les données personnelles intactes', async () => {
    await store.addToSuivi(profil.id, FILM);
    await store.setStatus(profil.id, 'movie', 1, 'vu');
    tmdb.getCardInfo.mockResolvedValue({
      title: 'A movie',
      year: '2020',
      releaseDate: '2020-03-01',
      posterUrl: 'https://image/en.jpg',
    });

    const resultat = await store.migrateCatalogLanguage('en');
    expect(resultat).toEqual({ total: 1, done: 1, failed: 0 });

    const [fiche] = await store.listSuivi(profil.id);
    expect(fiche.title).toBe('A movie');
    expect(fiche.status).toBe('vu'); // donnée personnelle : jamais touchée
    expect(await store.countPendingLanguage('en')).toBe(0);
  });

  it("garde la valeur d'origine quand la fiche traduite est vide", async () => {
    await store.addToSuivi(profil.id, FILM);
    tmdb.getCardInfo.mockResolvedValue({ title: '', year: null, posterUrl: null });
    await store.migrateCatalogLanguage('en');
    expect((await store.listSuivi(profil.id))[0].title).toBe('Un film');
  });

  it("reprend là où elle s'est arrêtée après une coupure réseau", async () => {
    await store.addToSuivi(profil.id, FILM);
    await store.addToSuivi(profil.id, SERIE);
    tmdb.getCardInfo.mockImplementation(async (mediaType) => {
      if (mediaType === 'tv') throw new Error('réseau coupé');
      return { title: 'A movie' };
    });

    const premier = await store.migrateCatalogLanguage('en');
    expect(premier).toEqual({ total: 2, done: 1, failed: 1 });
    // La fiche échouée reste à faire : rien n'est perdu.
    expect(await store.countPendingLanguage('en')).toBe(1);

    tmdb.getCardInfo.mockResolvedValue({ title: 'A series' });
    const second = await store.migrateCatalogLanguage('en');
    expect(second).toEqual({ total: 1, done: 1, failed: 0 });
    expect(await store.countPendingLanguage('en')).toBe(0);
  });

  it('rend compte de son avancement au fur et à mesure', async () => {
    await store.addToSuivi(profil.id, FILM);
    tmdb.getCardInfo.mockResolvedValue({ title: 'A movie' });
    const etapes = [];
    await store.migrateCatalogLanguage('en', (p) => etapes.push({ ...p }));
    expect(etapes[0]).toEqual({ done: 0, total: 1 });
    expect(etapes.at(-1)).toEqual({ done: 1, total: 1 });
  });
});

describe('suggestions', () => {
  it('écarte ce qui est déjà suivi et classe par nombre de recommandations', async () => {
    await store.addToSuivi(profil.id, FILM);
    await store.addToSuivi(profil.id, SERIE);
    await store.setStatus(profil.id, 'movie', 1, 'vu');
    await store.setStatus(profil.id, 'tv', 100, 'vu');

    const deuxFois = { id: 7, mediaType: 'movie', title: 'Recommandé deux fois', _pop: 1 };
    const uneFois = { id: 8, mediaType: 'movie', title: 'Recommandé une fois', _pop: 9 };
    const dejaSuivi = { id: 1, mediaType: 'movie', title: 'Un film', _pop: 99 };
    // Les deux graines recommandent le premier ; seule l'une recommande le
    // second. Le film déjà suivi revient : il doit disparaître des propositions.
    tmdb.getRecommendations.mockResolvedValue([deuxFois, dejaSuivi]);
    tmdb.getRecommendations.mockResolvedValueOnce([deuxFois, uneFois, dejaSuivi]);

    const suggestions = await store.getSuggestions(profil.id);
    expect(suggestions.map((s) => s.id)).toEqual([7, 8]);
    // La raison affichée vient d'un titre du suivi.
    expect(['Un film', 'Une série']).toContain(suggestions[0].reason);
    // Ni score ni popularité ne sortent vers l'écran.
    expect(suggestions[0]).not.toHaveProperty('score');
    expect(suggestions[0]).not.toHaveProperty('_pop');
  });

  it('ne propose rien quand le suivi est vide', async () => {
    expect(await store.getSuggestions(profil.id)).toEqual([]);
  });

  it('résiste à une recommandation qui échoue', async () => {
    await store.addToSuivi(profil.id, FILM);
    tmdb.getRecommendations.mockRejectedValue(new Error('réseau'));
    await expect(store.getSuggestions(profil.id)).resolves.toEqual([]);
  });
});

// Suggestions : autant de films que de séries, l'un comblant l'autre s'il manque.
describe('moitieMoitie', () => {
  const liste = (films, series) => [
    ...Array.from({ length: films }, (_, i) => ({ id: i, mediaType: 'movie' })),
    ...Array.from({ length: series }, (_, i) => ({ id: 1000 + i, mediaType: 'tv' })),
  ];
  const compte = (l) => [
    l.filter((i) => i.mediaType === 'movie').length,
    l.filter((i) => i.mediaType === 'tv').length,
  ];

  it('partage à égalité quand les deux types suffisent', () => {
    expect(compte(store.moitieMoitie(liste(40, 40), 30))).toEqual([15, 15]);
  });

  it("comble avec l'autre type quand l'un manque", () => {
    expect(compte(store.moitieMoitie(liste(20, 2), 12))).toEqual([10, 2]);
    expect(compte(store.moitieMoitie(liste(1, 20), 12))).toEqual([1, 11]);
  });

  it('garde tout quand il y a moins que demandé', () => {
    expect(compte(store.moitieMoitie(liste(3, 4), 30))).toEqual([3, 4]);
  });
});

describe('genres des titres suivis', () => {
  it('retient les genres à l’ajout, et le rattrapage remplit ceux qui manquent', async () => {
    await store.addToSuivi(profil.id, { id: 1, mediaType: 'movie', title: 'A', genreKeys: ['action', 'drame'] });
    await store.addToSuivi(profil.id, { id: 2, mediaType: 'movie', title: 'B' }); // d'avant : genre inconnu
    let lignes = await store.listSuivi(profil.id);
    expect(lignes.find((l) => l.id === 1).genres).toBe('action,drame');
    expect(lignes.find((l) => l.id === 2).genres).toBeNull();

    tmdb.getCardInfo.mockResolvedValue({ releaseDate: '2020-01-01', genreKeys: ['comedie'] });
    await store.backfillReleaseDates();
    lignes = await store.listSuivi(profil.id);
    expect(lignes.find((l) => l.id === 2).genres).toBe('comedie');

    // Un catalogue qui ne donne plus aucun genre n'efface pas ce qu'on savait.
    await store.addToSuivi(profil.id, { id: 3, mediaType: 'movie', title: 'C', genreKeys: ['western'] });
    tmdb.getCardInfo.mockResolvedValue({ releaseDate: '2020-01-01', genreKeys: [] });
    await store.backfillReleaseDates();
    lignes = await store.listSuivi(profil.id);
    expect(lignes.find((l) => l.id === 3).genres).toBe('western');
  });

  it('le filtre par genre ne garde que les titres du genre', async () => {
    const { appliquerFiltresBiblio, FILTRES_BIBLIO_VIDES } = await import('../src/filtres.js');
    const items = [
      { title: 'A', genres: 'action,drame' },
      { title: 'B', genres: 'comedie' },
      { title: 'C', genres: null },
    ];
    const r = appliquerFiltresBiblio(items, { ...FILTRES_BIBLIO_VIDES, genre: 'drame' });
    expect(r.map((i) => i.title)).toEqual(['A']);
  });
});


describe('mosaïque des listes (covers)', () => {
  const film = (id) => ({ id, mediaType: 'movie', title: `F${id}`, posterUrl: `https://img/${id}.jpg` });

  it('rend 0, 2 puis 4 affiches au plus, les plus récemment ajoutées d’abord', async () => {
    const liste = await store.createListe(profil.id, 'Soirée');
    expect((await store.listListes(profil.id))[0].covers).toEqual([]);

    await store.addToListe(profil.id, liste.id, film(1));
    await store.addToListe(profil.id, liste.id, film(2));
    expect((await store.listListes(profil.id))[0].covers).toHaveLength(2);

    for (const id of [3, 4, 5]) await store.addToListe(profil.id, liste.id, film(id));
    const [l] = await store.listListes(profil.id);
    expect(l.count).toBe(5);
    expect(l.covers).toHaveLength(4);
    expect(l.covers[0]).toBe('https://img/5.jpg');
    expect(l.covers).not.toContain('https://img/1.jpg');
  });

  it('ignore les titres sans affiche et ne mélange pas les listes', async () => {
    const a = await store.createListe(profil.id, 'A');
    const b = await store.createListe(profil.id, 'B');
    await store.addToListe(profil.id, a.id, { id: 1, mediaType: 'movie', title: 'Sans' });
    await store.addToListe(profil.id, a.id, film(2));
    await store.addToListe(profil.id, b.id, film(3));
    const listes = await store.listListes(profil.id);
    expect(listes.find((l) => l.id === a.id).covers).toEqual(['https://img/2.jpg']);
    expect(listes.find((l) => l.id === b.id).covers).toEqual(['https://img/3.jpg']);
  });
});

describe('genres les plus regardés (parGenre)', () => {
  const t = (id, genres, status) => ({ id, genreKeys: genres, mediaType: 'movie', title: `T${id}`, status });

  it('compte les genres des titres vus ou en cours, plafonné à 5', async () => {
    const lignes = [
      t(1, ['action', 'drame'], 'vu'),
      t(2, ['action'], 'vu'),
      t(3, ['drame', 'comedie'], 'vu'),
      t(4, ['horreur'], 'vu'),
      t(5, ['western'], 'vu'),
      t(6, ['animation'], 'vu'),
      t(7, ['scifi'], 'vu'),
      t(8, ['action'], 'a_voir'),
    ];
    for (const l of lignes) {
      await store.addToSuivi(profil.id, l);
      await store.setStatus(profil.id, 'movie', l.id, l.status);
    }
    const { parGenre } = await store.getStats(profil.id);
    expect(parGenre).toHaveLength(5);
    expect(parGenre[0]).toEqual({ key: 'action', n: 2 });
    expect(parGenre[1]).toEqual({ key: 'drame', n: 2 });
    expect(parGenre.find((g) => g.key === 'action').n).toBe(2);
  });

  it('ignore les genres vides ou inconnus', async () => {
    await store.addToSuivi(profil.id, { id: 1, mediaType: 'movie', title: 'A' });
    await store.setStatus(profil.id, 'movie', 1, 'vu');
    expect((await store.getStats(profil.id)).parGenre).toEqual([]);
    expect(store.compterGenres([{ genres: '' }, { genres: null }, { genres: 'a,,a' }])).toEqual([
      { key: 'a', n: 1 },
    ]);
  });
});

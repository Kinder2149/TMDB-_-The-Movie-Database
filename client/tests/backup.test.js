// Sauvegarde et restauration : ce qui protège les données de l'utilisateur.
//
// L'exigence tenue ici est celle du cadrage : exporter, réinstaller,
// restaurer doit rendre **exactement** l'état d'origine — c'est la raison
// d'être de l'UUID portable du profil.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/tmdb.js', () => ({
  getSeasons: vi.fn().mockResolvedValue([]),
  getSeriesStructure: vi.fn().mockResolvedValue({ seasons: [], lastAired: null }),
  getEpisodes: vi.fn().mockResolvedValue([]),
  getRecommendations: vi.fn().mockResolvedValue([]),
  getCardInfo: vi.fn(),
}));

let db, store, backup, profil;

// Un profil représentatif : deux titres, des épisodes cochés, une liste.
async function remplirProfil(profileId) {
  await store.addToSuivi(profileId, {
    id: 1,
    mediaType: 'movie',
    title: 'Un film',
    year: '2020',
    releaseDate: '2020-03-01',
    posterUrl: 'https://image/1.jpg',
  });
  await store.setStatus(profileId, 'movie', 1, 'vu');
  await store.setNote(profileId, 'movie', 1, { note: 'Une claque.', rating: 5 });
  await store.addToSuivi(profileId, {
    id: 100,
    mediaType: 'tv',
    title: 'Une série',
    year: '2019',
  });
  await store.setStatus(profileId, 'tv', 100, 'en_cours');
  await store.markWholeSeason(profileId, 100, 1, [1, 2, 3]);
  const liste = await store.createListe(profileId, 'Soirée');
  await store.addToListe(profileId, liste.id, { id: 1, mediaType: 'movie', title: 'Un film' });
}

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  db = await import('../src/db.js');
  store = await import('../src/store.js');
  backup = await import('../src/backup.js');
  await db.initDb();
  [profil] = await store.listProfiles();
});

describe('export', () => {
  it('emporte le profil, le suivi, les épisodes et les listes', async () => {
    await remplirProfil(profil.id);
    const fichier = await backup.exportProfile(profil.id);

    expect(fichier.format).toBe('suivi-films-series');
    expect(fichier.version).toBe(2);
    expect(fichier.profile).toEqual({
      id: profil.id,
      name: 'Mon profil',
      avatar: null,
    });
    expect(fichier.suivi).toHaveLength(2);
    expect(fichier.episodesVus).toHaveLength(3);
    expect(fichier.listes).toHaveLength(1);
    // Une liste s'exporte par son nom : deux appareils ne numérotent pas pareil.
    expect(fichier.listes[0]).toMatchObject({ name: 'Soirée' });
    expect(fichier.listes[0].items).toHaveLength(1);
    expect(fichier.listes[0]).not.toHaveProperty('id');
    // La note personnelle part avec la sauvegarde : sans ca, changer
    // d'appareil ferait perdre tous les avis.
    expect(fichier.suivi.find((t) => t.tmdbId === 1)).toMatchObject({
      note: 'Une claque.',
      rating: 5,
    });
  });

  it("n'emporte pas les données d'un autre profil", async () => {
    const autre = await store.createProfile('Marie');
    await remplirProfil(autre.id);
    const fichier = await backup.exportProfile(profil.id);
    expect(fichier.suivi).toHaveLength(0);
    expect(fichier.listes).toHaveLength(0);
  });

  it('refuse un profil inexistant', async () => {
    await expect(backup.exportProfile('inconnu')).rejects.toThrow('introuvable');
  });
});

describe('restauration', () => {
  it('rend exactement l’état d’origine après une réinstallation', async () => {
    await remplirProfil(profil.id);
    const fichier = await backup.exportProfile(profil.id);

    // Réinstallation : appareil neuf, base vide.
    await db.run('DELETE FROM profiles');
    expect(await store.listProfiles()).toHaveLength(0);

    const restaure = await backup.importProfile(fichier);
    expect(restaure).toBe(profil.id); // même identifiant portable

    const apres = await backup.exportProfile(profil.id);
    expect({ ...apres, exportedAt: null }).toEqual({ ...fichier, exportedAt: null });
  });

  it('remplace le profil existant au lieu de fusionner avec lui', async () => {
    await remplirProfil(profil.id);
    const fichier = await backup.exportProfile(profil.id);

    // L'utilisateur a continué à utiliser l'application depuis la sauvegarde.
    await store.addToSuivi(profil.id, { id: 999, mediaType: 'movie', title: 'Ajouté après' });
    await store.createListe(profil.id, 'Liste ajoutée après');
    await store.markEpisode(profil.id, 100, 9, 9);

    await backup.importProfile(fichier);

    const suivi = await store.listSuivi(profil.id);
    expect(suivi.map((s) => s.id).sort()).toEqual([1, 100]); // 999 a disparu
    expect(await store.listListes(profil.id)).toHaveLength(1);
    const episodes = await db.query('SELECT * FROM episodes_vus WHERE profile_id = ?', [
      profil.id,
    ]);
    expect(episodes).toHaveLength(3);
  });

  it('ne touche pas aux autres profils de l’appareil', async () => {
    await remplirProfil(profil.id);
    const fichier = await backup.exportProfile(profil.id);
    const autre = await store.createProfile('Marie');
    await store.addToSuivi(autre.id, { id: 55, mediaType: 'movie', title: 'À Marie' });

    await backup.importProfile(fichier);
    expect(await store.listSuivi(autre.id)).toHaveLength(1);
  });

  it('restaure aussi un profil qui n’existe pas encore sur l’appareil', async () => {
    const fichier = {
      format: 'suivi-films-series',
      version: 1,
      profile: { id: 'aaaa-bbbb', name: 'Marie' },
      suivi: [{ tmdbId: 1, mediaType: 'movie', title: 'Un film', status: 'vu' }],
      episodesVus: [],
      listes: [],
    };
    await backup.importProfile(fichier);
    const profils = await store.listProfiles();
    expect(profils.map((p) => p.name)).toContain('Marie');
    expect(await store.listSuivi('aaaa-bbbb')).toHaveLength(1);
  });

  it('écarte un élément de liste absent du suivi plutôt que d’échouer', async () => {
    const fichier = {
      format: 'suivi-films-series',
      version: 1,
      profile: { id: 'aaaa-bbbb', name: 'Marie' },
      suivi: [{ tmdbId: 1, mediaType: 'movie', title: 'Un film' }],
      episodesVus: [],
      listes: [
        {
          name: 'Soirée',
          items: [
            { tmdbId: 1, mediaType: 'movie' },
            { tmdbId: 404, mediaType: 'movie' }, // orphelin
          ],
        },
      ],
    };
    await backup.importProfile(fichier);
    const [liste] = await store.listListes('aaaa-bbbb');
    expect(liste.count).toBe(1);
  });
});

describe('vérification du fichier ouvert', () => {
  const valide = {
    format: 'suivi-films-series',
    version: 1,
    profile: { id: 'x', name: 'Marie' },
    suivi: [],
  };

  it('accepte une sauvegarde de l’application', () => {
    expect(() => backup.validateBackup(valide)).not.toThrow();
  });

  it.each([
    [null, 'illisible'],
    ['du texte', 'illisible'],
    [{ ...valide, format: 'autre-appli' }, "n'est pas une sauvegarde"],
    [{ ...valide, version: 99 }, 'plus récente'],
    [{ ...valide, profile: { id: 'x' } }, 'Profil absent'],
    [{ ...valide, suivi: undefined }, 'Suivi absent'],
  ])('refuse un fichier inexploitable (%#)', (fichier, message) => {
    expect(() => backup.validateBackup(fichier)).toThrow(message);
  });

  it('annonce ce que contient le fichier avant de l’écrire', async () => {
    await remplirProfil(profil.id);
    const fichier = await backup.exportProfile(profil.id);
    expect(backup.describeBackup(fichier)).toEqual({
      profil: 'Mon profil',
      titres: 2,
      episodes: 3,
      listes: 1,
      date: fichier.exportedAt.slice(0, 10),
    });
  });
});

describe('export vers Letterboxd', () => {
  it('n’exporte que les films, et le dit', () => {
    const { csv, films, series } = backup.toLetterboxdCsv([
      { tmdbId: 1, mediaType: 'movie', title: 'Un film', year: '2020', status: 'vu', addedAt: '2026-01-02 10:00:00', rating: 4, note: 'Tres bon.' },
      { tmdbId: 2, mediaType: 'movie', title: 'À voir', year: '2021', status: 'a_voir', addedAt: '2026-01-03 10:00:00' },
      { tmdbId: 100, mediaType: 'tv', title: 'Une série', year: '2019', status: 'vu' },
    ]);
    expect({ films, series }).toEqual({ films: 2, series: 1 });

    const lignes = csv.split('\n');
    expect(lignes[0]).toBe('Title,Year,tmdbID,WatchedDate,Rating,Review');
    // Date de visionnage seulement pour ce qui est marqué « vu ».
    expect(lignes[1]).toBe('Un film,2020,1,2026-01-02,4,Tres bon.');
    expect(lignes[2]).toBe('À voir,2021,2,,,');
  });

  it('protège les titres contenant une virgule ou un guillemet', () => {
    const { csv } = backup.toLetterboxdCsv([
      { tmdbId: 1, mediaType: 'movie', title: 'Moi, moche et "méchant"', year: '2010', status: 'a_voir' },
    ]);
    expect(csv.split('\n')[1]).toBe('"Moi, moche et ""méchant""",2010,1,,,');
  });
});

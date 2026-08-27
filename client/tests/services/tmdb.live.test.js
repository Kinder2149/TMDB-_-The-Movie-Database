// Vérification « en vrai » : la clé TMDB embarquée ouvre bien le catalogue.
//
// Ce test appelle le véritable service TMDB. Il n'est donc pas dans la suite
// courante (elle doit tourner hors ligne, sans dépendre d'un serveur distant) :
// il se lance à part, avec `npm run test:services`, quand on veut confirmer
// que le paramétrage est bon — après un changement de clé, par exemple.
import { describe, it, expect } from 'vitest';
import {
  searchMulti,
  getSeasons,
  getSeriesStructure,
  getEpisodes,
  getDetails,
  getCardInfo,
} from '../../src/tmdb.js';

describe('TMDB — service réel', () => {
  it('la clé ouvre la recherche et rend des fiches exploitables', async () => {
    const resultats = await searchMulti('Matrix');
    expect(resultats.length).toBeGreaterThan(0);

    const matrix = resultats.find((r) => r.id === 603); // The Matrix (1999)
    expect(matrix).toMatchObject({ mediaType: 'movie', year: '1999' });
    expect(matrix.posterUrl).toMatch(/^https:\/\/image\.tmdb\.org/);
  }, 20000);

  it('rend les fiches en français', async () => {
    const details = await getDetails('movie', 603);
    expect(details.title).toBeTruthy();
    // Le synopsis français existe pour un film de cette notoriété : c'est ce
    // qui prouve que le paramètre de langue est bien transmis.
    expect(details.overview?.length ?? 0).toBeGreaterThan(50);
  }, 20000);

  it('rend les saisons et les épisodes d’une série', async () => {
    const saisons = await getSeasons(1399); // Game of Thrones
    expect(saisons.length).toBeGreaterThan(0);
    expect(saisons[0]).toHaveProperty('episodeCount');

    const episodes = await getEpisodes(1399, 1);
    expect(episodes.length).toBeGreaterThan(0);
    expect(episodes[0]).toMatchObject({ episodeNumber: 1 });
    expect(episodes[0].airDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }, 20000);

  it('rend la date de sortie du pays, et pas celle d’une ressortie', async () => {
    // Matrix : sorti aux États-Unis le 31/03/1999, en France le 23/06/1999.
    // TMDB liste aussi trois ressorties en salle en France en 2026 — c'est le
    // piège : prendre la date la plus récente ferait passer un film de 1999
    // pour « pas encore sorti ». On retient la plus ancienne.
    const fr = await getCardInfo('movie', 603, 'fr-FR', 'FR');
    expect(fr.releaseDate).toBe('1999-06-23');

    const us = await getCardInfo('movie', 603, 'en-US', 'US');
    expect(us.releaseDate).toBe('1999-03-31');

    // L'année reste celle de la sortie d'origine, quel que soit le pays :
    // Matrix est « 1999 » pour tout le monde.
    expect(fr.year).toBe('1999');
  }, 20000);

  it('laisse une série sur sa date mondiale, faute de mieux', async () => {
    // TMDB ne connaît qu'une seule date de première diffusion pour une série :
    // le pays demandé ne change rien, et c'est une limite assumée.
    const fr = await getCardInfo('tv', 1399, 'fr-FR', 'FR');
    const us = await getCardInfo('tv', 1399, 'en-US', 'US');
    expect(fr.releaseDate).toBe(us.releaseDate);
  }, 20000);

  it('sait quel est le dernier épisode réellement diffusé', async () => {
    // Toute la distinction « à jour » / « il reste à voir » repose sur ce
    // champ de TMDB : ce test confirme qu'il est bien là, en vrai.
    const { seasons, lastAired } = await getSeriesStructure(1399); // GoT, terminée
    expect(lastAired).toMatchObject({ season: 8, episode: 6 });
    // Série terminée : tout ce qui est annoncé est sorti.
    const annonces = seasons.reduce((n, s) => n + s.episodeCount, 0);
    expect(annonces).toBe(73);
  }, 20000);
});

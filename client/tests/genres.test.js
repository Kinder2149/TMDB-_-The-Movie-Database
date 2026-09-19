// La liste unique des genres : chaque entrée doit marcher pour les films ET pour
// les séries, sinon on retrouve les boutons grisés et les listes vides.
import { describe, it, expect } from 'vitest';
import { GENRES, getGenres, parametresDeGenre } from '../src/tmdb.js';
import { setCatalogLanguage } from '../src/lang.js';

describe('liste unique des genres', () => {
  it('chaque genre sait quoi demander pour un film et pour une série', () => {
    for (const g of GENRES) {
      expect(parametresDeGenre(g.key, 'movie'), `${g.key} / films`).not.toBeNull();
      expect(parametresDeGenre(g.key, 'tv'), `${g.key} / séries`).not.toBeNull();
    }
  });

  it('les clés sont uniques et chaque genre a un nom français et anglais', () => {
    expect(new Set(GENRES.map((g) => g.key)).size).toBe(GENRES.length);
    for (const g of GENRES) {
      expect(g.fr).toBeTruthy();
      expect(g.en).toBeTruthy();
    }
  });

  it('ne propose ni Horreur, ni Romance, ni Musique, ni émission télé', () => {
    const noms = GENRES.map((g) => g.fr).join(' | ');
    for (const absent of ['Horreur', 'Romance', 'Musique', 'Téléfilm', 'Talk', 'News', 'Reality', 'Soap']) {
      expect(noms).not.toContain(absent);
    }
  });

  it('additionne les genres TMDB voisins avec « au choix parmi »', () => {
    expect(parametresDeGenre('action', 'movie').with_genres).toBe('28|12'); // Action + Aventure
    expect(parametresDeGenre('action', 'tv').with_genres).toBe('10759'); // Action & Adventure
    expect(parametresDeGenre('scifi', 'movie').with_genres).toBe('878|14'); // SF + Fantastique
    expect(parametresDeGenre('famille', 'tv').with_genres).toBe('10751|10762'); // Familial + Kids
  });

  it('« Histoire & Époques » passe par des mots-clés, pas par un genre TMDB', () => {
    for (const type of ['movie', 'tv']) {
      const p = parametresDeGenre('histoire', type);
      expect(p.with_keywords.split('|').length).toBeGreaterThan(5);
      expect(p.with_genres).toBeUndefined();
    }
  });

  it('exclut l’animation des séries d’époque (animés fantastiques), pas des films', () => {
    expect(parametresDeGenre('histoire', 'tv').without_genres).toBe('16');
    expect(parametresDeGenre('histoire', 'movie').without_genres).toBeUndefined();
  });

  it('un genre inconnu ne demande rien', () => {
    expect(parametresDeGenre('horreur', 'movie')).toBeNull();
  });

  it('affiche les noms dans la langue du catalogue', async () => {
    setCatalogLanguage('fr');
    expect((await getGenres()).find((g) => g.key === 'scifi').name).toBe('Science-Fiction & Fantastique');
    setCatalogLanguage('en');
    expect((await getGenres()).find((g) => g.key === 'scifi').name).toBe('Sci-Fi & Fantasy');
    setCatalogLanguage('fr');
  });
});

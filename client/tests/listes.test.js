// M3 — « Mes listes » : tri et filtres sur ce qu'on a en base.
import { describe, it, expect } from 'vitest';
import {
  appliquerFiltresBiblio,
  filtresBiblioActifs,
  FILTRES_BIBLIO_VIDES,
  TRIS_BIBLIO,
} from '../src/filtres.js';

const AUJ = new Date('2026-09-21T12:00:00Z');

// Dans l'ordre reçu de la base : le plus récemment ajouté d'abord.
const bibliotheque = [
  { id: 1, title: 'Zodiac', releaseDate: '2007-03-01', rating: 4 },
  { id: 2, title: 'Alien', releaseDate: '1979-05-25', rating: 5 },
  { id: 3, title: 'Mommy', releaseDate: '2014-09-19', rating: null },
  { id: 4, title: 'Dune', releaseDate: '2021-10-22', rating: 3 },
  { id: 5, title: 'Sans date', releaseDate: null, rating: 4 },
  { id: 6, title: 'Her', releaseDate: '2013-12-18', rating: 4 },
];
const titres = (l) => l.map((x) => x.title);
const avec = (patch) => appliquerFiltresBiblio(bibliotheque, { ...FILTRES_BIBLIO_VIDES, ...patch }, AUJ);

describe('tri de la bibliothèque', () => {
  it("par défaut, l'ordre reçu de la base est gardé (ajouté récemment)", () => {
    expect(titres(avec({}))).toEqual(titres(bibliotheque));
  });

  it('Titre A → Z', () => {
    expect(titres(avec({ tri: 'titre' }))).toEqual(['Alien', 'Dune', 'Her', 'Mommy', 'Sans date', 'Zodiac']);
  });

  it('Sortie récente / ancienne, les titres sans date à la fin', () => {
    expect(titres(avec({ tri: 'sortie_recente' }))).toEqual(['Dune', 'Mommy', 'Her', 'Zodiac', 'Alien', 'Sans date']);
    expect(titres(avec({ tri: 'sortie_ancienne' }))).toEqual(['Alien', 'Zodiac', 'Her', 'Mommy', 'Dune', 'Sans date']);
  });

  it('Ma note : la meilleure d’abord, les non-notés à la fin, égalités dans l’ordre reçu', () => {
    expect(titres(avec({ tri: 'note' }))).toEqual(['Alien', 'Zodiac', 'Sans date', 'Her', 'Dune', 'Mommy']);
  });

  it('trier ne modifie pas la liste reçue', () => {
    const avant = titres(bibliotheque);
    avec({ tri: 'titre' });
    expect(titres(bibliotheque)).toEqual(avant);
  });

  it('propose les cinq tris décidés, « Ajouté récemment » en premier', () => {
    expect(TRIS_BIBLIO.map((t) => t.key)).toEqual(['ajout', 'titre', 'sortie_recente', 'sortie_ancienne', 'note']);
  });
});

describe('filtres de la bibliothèque', () => {
  it('Année 2010s : ne reste que cette période, sans les titres sans date', () => {
    expect(titres(avec({ periode: '2010s' }))).toEqual(['Mommy', 'Her']);
  });

  it('Année : Avant 1990 et Cette année', () => {
    expect(titres(avec({ periode: 'avant1990' }))).toEqual(['Alien']);
    expect(titres(avec({ periode: 'annee' }))).toEqual([]);
  });

  it('Ma note « 4 étoiles et plus » : que les titres bien notés', () => {
    expect(titres(avec({ note: 'bien' }))).toEqual(['Zodiac', 'Alien', 'Sans date', 'Her']);
  });

  it('Ma note « Pas encore noté » : que les non-notés', () => {
    expect(titres(avec({ note: 'non' }))).toEqual(['Mommy']);
  });

  it('les filtres et le tri se combinent', () => {
    expect(titres(avec({ periode: '2010s', note: 'bien', tri: 'titre' }))).toEqual(['Her']);
    expect(titres(avec({ note: 'bien', tri: 'sortie_recente' }))).toEqual(['Her', 'Zodiac', 'Alien', 'Sans date']);
  });

  it('un filtre qui écarte tout rend une liste vide', () => {
    expect(avec({ periode: '2020s', note: 'non' })).toEqual([]);
  });
});

describe('état des filtres', () => {
  it('le point « Filtres » suit l’état, Réinitialiser revient au départ', () => {
    expect(filtresBiblioActifs(FILTRES_BIBLIO_VIDES)).toBe(false);
    expect(filtresBiblioActifs({ ...FILTRES_BIBLIO_VIDES, tri: 'titre' })).toBe(true);
    expect(filtresBiblioActifs({ ...FILTRES_BIBLIO_VIDES, periode: '2010s' })).toBe(true);
    expect(filtresBiblioActifs({ ...FILTRES_BIBLIO_VIDES, note: 'bien' })).toBe(true);
    expect(titres(appliquerFiltresBiblio(bibliotheque, FILTRES_BIBLIO_VIDES, AUJ))).toEqual(titres(bibliotheque));
  });
});

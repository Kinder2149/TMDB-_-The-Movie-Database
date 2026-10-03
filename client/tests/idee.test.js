import { describe, it, expect } from 'vitest';
import { ideeDuSoir, depuisLibelle, aujourdhui, candidatsIdee } from '../src/idee.js';

const film = (id, extra = {}) => ({
  id,
  mediaType: 'movie',
  title: `Film ${id}`,
  status: 'a_voir',
  releaseDate: '2020-01-01',
  ...extra,
});
const base = Array.from({ length: 6 }, (_, i) => film(i + 1));
const P = { profileId: 'p1', date: '2026-10-03' };

describe('ideeDuSoir', () => {
  it('donne la même idée le même jour, quel que soit l\'ordre des titres', () => {
    const a = ideeDuSoir(base, P);
    const b = ideeDuSoir([...base].reverse(), P);
    expect(a.id).toBe(b.id);
    expect(ideeDuSoir(base, P).id).toBe(a.id);
  });

  it('change d\'idée d\'un jour à l\'autre (sur plusieurs jours)', () => {
    const ids = new Set(
      ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'].map(
        (date) => ideeDuSoir(base, { ...P, date }).id
      )
    );
    expect(ids.size).toBeGreaterThan(1);
  });

  it('« Autre idée » parcourt tous les candidats sans répétition, puis boucle', () => {
    const vus = Array.from({ length: 6 }, (_, rang) => ideeDuSoir(base, { ...P, rang }).id);
    expect(new Set(vus).size).toBe(6);
    expect(ideeDuSoir(base, { ...P, rang: 6 }).id).toBe(vus[0]);
  });

  it('exclut à venir, en cours, vu et abandonné', () => {
    const items = [
      film(1, { status: 'en_cours' }),
      film(2, { status: 'vu' }),
      film(3, { status: 'abandonne' }),
      film(4, { releaseDate: '2999-01-01' }),
      film(5),
    ];
    expect(candidatsIdee(items).map((i) => i.id)).toEqual([5]);
    expect(ideeDuSoir(items, P).id).toBe(5);
  });

  it('garde un titre sans date de sortie connue', () => {
    expect(ideeDuSoir([film(1, { releaseDate: null })], P).id).toBe(1);
  });

  it('rend null s\'il n\'y a rien à proposer', () => {
    expect(ideeDuSoir([], P)).toBeNull();
    expect(ideeDuSoir([film(1, { status: 'vu' })], P)).toBeNull();
  });

  it('distingue un film et une série de même numéro', () => {
    const items = [film(1), { ...film(1), mediaType: 'tv' }];
    const vus = [0, 1].map((rang) => ideeDuSoir(items, { ...P, rang }).mediaType);
    expect(new Set(vus).size).toBe(2);
  });
});

describe('depuisLibelle', () => {
  const ICI = new Date('2026-10-03T12:00:00Z');
  it('dit hier, des jours, des semaines, des mois', () => {
    expect(depuisLibelle('2026-10-02 09:00:00', ICI)).toBe('depuis hier');
    expect(depuisLibelle('2026-09-28 09:00:00', ICI)).toBe('depuis 5 jours');
    expect(depuisLibelle('2026-09-12 09:00:00', ICI)).toBe('depuis 3 semaines');
    expect(depuisLibelle('2026-07-20 09:00:00', ICI)).toBe('depuis 2 mois');
    expect(depuisLibelle('2024-01-01 09:00:00', ICI)).toBe("depuis plus d'un an");
  });
  it('dit « ajouté aujourd\'hui » et reste muet sans date', () => {
    expect(depuisLibelle('2026-10-03 08:00:00', ICI)).toBe("ajouté aujourd'hui");
    expect(depuisLibelle(null, ICI)).toBeNull();
    expect(depuisLibelle('n\'importe quoi', ICI)).toBeNull();
  });
});

describe('aujourdhui', () => {
  it('rend la date locale AAAA-MM-JJ', () => {
    expect(aujourdhui(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

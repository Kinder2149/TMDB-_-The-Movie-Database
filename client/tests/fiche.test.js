// Textes de la fiche d'une série : carte « Prochain épisode ».
import { describe, it, expect } from 'vitest';
import { libelleProchain, dateEnToutesLettres, formatDuree } from '../src/status.js';

describe('formatDuree', () => {
  it('écrit les heures et les minutes', () => {
    expect(formatDuree(155)).toBe('2 h 35');
    expect(formatDuree(125)).toBe('2 h 05');
    expect(formatDuree(120)).toBe('2 h');
    expect(formatDuree(45)).toBe('45 min');
  });
  it('rend null quand la durée est inconnue', () => {
    expect(formatDuree(null)).toBeNull();
    expect(formatDuree(0)).toBeNull();
  });
});

const ICI = new Date('2026-10-03T12:00:00');

describe('dateEnToutesLettres', () => {
  it("écrit la date sans l'année quand c'est l'année en cours", () => {
    expect(dateEnToutesLettres('2026-09-12', ICI)).toBe('12 septembre');
  });
  it("ajoute l'année pour une autre année, et dit 1er", () => {
    expect(dateEnToutesLettres('2024-02-01', ICI)).toBe('1er février 2024');
  });
  it('rend null sans date ou avec une date illisible', () => {
    expect(dateEnToutesLettres(null, ICI)).toBeNull();
    expect(dateEnToutesLettres('n/a', ICI)).toBeNull();
  });
});

describe('libelleProchain', () => {
  it('compose le numéro, le titre, la date et le bouton', () => {
    const l = libelleProchain(
      { season: 2, episode: 10, name: 'Cold Harbor', airDate: '2026-09-12' },
      ICI
    );
    expect(l.titre).toBe('S2E10 · Cold Harbor');
    expect(l.diffuse).toBe('Diffusé le 12 septembre');
    expect(l.bouton).toBe('Marquer S2E10 comme vu');
  });
  it('met un zéro devant un épisode à un chiffre', () => {
    expect(libelleProchain({ season: 1, episode: 4, name: 'X', airDate: null }, ICI).numero).toBe(
      'S1E04'
    );
  });
  it('sans titre ni date, reste lisible', () => {
    const l = libelleProchain({ season: 1, episode: 1, name: '', airDate: null }, ICI);
    expect(l.titre).toBe('S1E01');
    expect(l.diffuse).toBeNull();
  });
  it('rend null quand la série est à jour', () => {
    expect(libelleProchain(null, ICI)).toBeNull();
  });
});

describe('resumeBiblio', () => {
  it('compte titres, vus et note moyenne', async () => {
    const { resumeBiblio } = await import('../src/status.js');
    expect(resumeBiblio([])).toEqual({ titres: 0, vus: 0, noteMoyenne: null });
    expect(
      resumeBiblio([
        { status: 'vu', rating: 5 },
        { status: 'vu', rating: 4 },
        { status: 'a_voir', rating: null },
        { status: 'en_cours' },
      ])
    ).toEqual({ titres: 4, vus: 2, noteMoyenne: 4.5 });
  });
});

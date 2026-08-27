// Les petites règles visibles à l'écran : statuts, dates, langue du catalogue,
// nom du fichier de sauvegarde. Peu de code, mais chacune se voit tout de suite
// si elle se trompe.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  STATUSES,
  STATUS_LABEL,
  deriveSeriesStatus,
  isUpcoming,
  formatReleaseDate,
} from '../src/status.js';
import {
  LANGUAGES,
  TMDB_LANG,
  hasCatalogLanguage,
  getCatalogLanguage,
  setCatalogLanguage,
  languageLabel,
} from '../src/lang.js';
import { backupFileName } from '../src/files.js';

beforeEach(() => localStorage.clear());

describe('statuts', () => {
  it('propose les 4 statuts, dans l’ordre d’affichage', () => {
    expect(STATUSES.map((s) => s.value)).toEqual(['a_voir', 'en_cours', 'vu', 'abandonne']);
    expect(STATUS_LABEL.abandonne).toBe('Abandonné');
  });

  it('déduit le statut d’une série de sa progression', () => {
    expect(deriveSeriesStatus(null)).toBe('a_voir');
    expect(deriveSeriesStatus({ watched: 0, total: 10 })).toBe('a_voir');
    expect(deriveSeriesStatus({ watched: 3, total: 10 })).toBe('en_cours');
    expect(deriveSeriesStatus({ watched: 10, total: 10 })).toBe('vu');
    // Une série sans nombre d'épisodes connu reste « en cours ».
    expect(deriveSeriesStatus({ watched: 3, total: 0 })).toBe('en_cours');
  });
});

describe('titres pas encore sortis', () => {
  afterEach(() => vi.useRealTimers());

  it('bascule tout seul le jour de la sortie', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));

    expect(isUpcoming({ releaseDate: '2026-06-16' })).toBe(true);
    expect(isUpcoming({ releaseDate: '2026-06-15' })).toBe(false); // le jour même
    expect(isUpcoming({ releaseDate: '2026-06-14' })).toBe(false);
    expect(isUpcoming({})).toBe(false); // date inconnue
  });

  it('affiche la date à la française', () => {
    expect(formatReleaseDate('2026-06-15')).toBe('15/06/2026');
    expect(formatReleaseDate(null)).toBeNull();
  });
});

describe('langue du catalogue', () => {
  it('démarre sans choix, et retient celui de l’utilisateur', () => {
    expect(hasCatalogLanguage()).toBe(false);
    expect(getCatalogLanguage()).toBe('fr'); // repli tant que rien n'est choisi
    setCatalogLanguage('en');
    expect(hasCatalogLanguage()).toBe(true);
    expect(getCatalogLanguage()).toBe('en');
  });

  it('traduit chaque langue en code attendu par TMDB', () => {
    expect(LANGUAGES.map((l) => l.value)).toEqual(['fr', 'en']);
    expect(TMDB_LANG).toEqual({ fr: 'fr-FR', en: 'en-US' });
    expect(languageLabel('en')).toBe('English');
    expect(languageLabel('xx')).toBe('xx'); // langue inconnue : on n'invente rien
  });
});

describe('nom du fichier de sauvegarde', () => {
  afterEach(() => vi.useRealTimers());

  it('est daté, sans accent ni espace', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T12:00:00Z'));
    expect(backupFileName('Été chez Marie')).toBe('suivi-ete-chez-marie-2026-08-23.json');
    expect(backupFileName('Mon profil', 'csv')).toBe('suivi-mon-profil-2026-08-23.csv');
    expect(backupFileName('')).toBe('suivi-profil-2026-08-23.json');
  });
});

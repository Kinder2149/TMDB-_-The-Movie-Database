import { describe, it, expect } from 'vitest';
import { estErreurReseau } from '../src/reseau.js';

describe('estErreurReseau', () => {
  it('reconnaît un fetch qui échoue', () => {
    expect(estErreurReseau(new TypeError('Failed to fetch'), true)).toBe(true);
    expect(estErreurReseau(new Error('Load failed'), true)).toBe(true);
    expect(estErreurReseau(new Error('NetworkError when attempting to fetch'), true)).toBe(true);
  });
  it('ne prend pas une réponse d’erreur de TMDB pour un réseau absent', () => {
    expect(estErreurReseau(new Error('Erreur TMDB (500)'), true)).toBe(false);
    expect(estErreurReseau(null, true)).toBe(false);
  });
  it('tout échec compte quand le téléphone se dit hors connexion', () => {
    expect(estErreurReseau(new Error('Erreur TMDB (500)'), false)).toBe(true);
    expect(estErreurReseau(null, false)).toBe(true);
  });
});

describe('vibre', () => {
  it('fait vibrer 10 ms quand le téléphone sait le faire, et ne casse rien sinon', async () => {
    const { vibre } = await import('../src/tactile.js');
    const avant = globalThis.navigator;
    let appels = [];
    Object.defineProperty(globalThis, 'navigator', { value: { vibrate: (ms) => appels.push(ms) }, configurable: true });
    vibre();
    expect(appels).toEqual([10]);
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
    expect(() => vibre()).not.toThrow();
    Object.defineProperty(globalThis, 'navigator', { value: avant, configurable: true });
  });
});

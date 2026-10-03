import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resoudre, lireChoix, appliquer } from '../src/theme.js';

describe('resoudre', () => {
  it('Automatique suit le système, Clair et Sombre l’ignorent', () => {
    expect(resoudre('auto', true)).toBe('dark');
    expect(resoudre('auto', false)).toBe('light');
    expect(resoudre('light', true)).toBe('light');
    expect(resoudre('dark', false)).toBe('dark');
  });
});

describe('lireChoix et appliquer', () => {
  beforeEach(() => {
    localStorage.clear();
    // Les tests tournent sous Node : un faux document suffit à lire ce que le thème pose.
    globalThis.document = { documentElement: { dataset: {} } };
    globalThis.window = globalThis;
  });

  it('Automatique par défaut, et un ancien choix mémorisé est conservé', () => {
    expect(lireChoix()).toBe('auto');
    localStorage.setItem('theme', 'dark');
    expect(lireChoix()).toBe('dark');
    localStorage.setItem('theme', 'n’importe quoi');
    expect(lireChoix()).toBe('auto');
  });

  it('mémorise Clair, efface la clé en Automatique et suit le système en direct', () => {
    let sombre = false;
    let notifier = null;
    globalThis.matchMedia = vi.fn(() => ({
      get matches() {
        return sombre;
      },
      addEventListener: (_, f) => {
        notifier = f;
      },
      removeEventListener: () => {
        notifier = null;
      },
    }));

    appliquer('light');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');

    appliquer('auto');
    expect(localStorage.getItem('theme')).toBeNull();
    expect(document.documentElement.dataset.theme).toBe('light');

    sombre = true;
    notifier();
    expect(document.documentElement.dataset.theme).toBe('dark');

    appliquer('dark');
    expect(notifier).toBeNull();
    sombre = false;
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

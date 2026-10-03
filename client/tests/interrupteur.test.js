// Le partage (amis par code) est éteint par défaut dans une version publiable : tant que
// VITE_PARTAGE n'est pas à 1, l'application se comporte exactement comme avant — aucun
// écran de partage, aucun appel à Firebase. Voir src/firebase.js.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

const cles = () => {
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'cle');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'projet');
  vi.stubEnv('VITE_FIREBASE_APP_ID', 'app');
};

describe('interrupteur du partage', () => {
  it('éteint sans VITE_PARTAGE, même avec les clés Firebase', async () => {
    cles();
    vi.stubEnv('VITE_PARTAGE', '');
    const service = await import('../src/firebase.js');
    expect(service.isConfigured()).toBe(false);
    await expect(service.publier('K7F2M9QX3DTB', 'cle', {})).rejects.toThrow('pas configuré');
  });
  it('allumé avec VITE_PARTAGE=1 et les clés', async () => {
    cles();
    vi.stubEnv('VITE_PARTAGE', '1');
    expect((await import('../src/firebase.js')).isConfigured()).toBe(true);
  });
  it('éteint sans clés, même avec VITE_PARTAGE=1', async () => {
    vi.stubEnv('VITE_PARTAGE', '1');
    vi.stubEnv('VITE_FIREBASE_API_KEY', '');
    expect((await import('../src/firebase.js')).isConfigured()).toBe(false);
  });
});

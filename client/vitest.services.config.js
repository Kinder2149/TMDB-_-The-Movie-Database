// Tests « services » : ceux qui appellent les vrais services extérieurs.
//
// Séparés de la suite courante, qui doit tourner hors ligne et sans dépendre
// de la disponibilité d'un service distant. Lancés par `npm run test:services`
// pour confirmer que le paramétrage réel fonctionne.
import { defineConfig } from 'vitest/config';
import base from './vitest.config.js';

export default defineConfig({
  resolve: base.resolve, // mêmes remplacements que la suite courante
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/services/**/*.test.js'],
  },
});

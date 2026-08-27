// Configuration des tests automatisés.
//
// Les tests exercent le *vrai* code de l'application (même SQL, mêmes règles) :
// seules les trois portes vers l'extérieur sont remplacées, parce qu'elles
// n'existent pas dans Node — le socle Capacitor, le SQLite du navigateur et le
// stockage local. Tout le reste est le code livré.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const ici = (chemin) => fileURLToPath(new URL(chemin, import.meta.url));

export default defineConfig({
  resolve: {
    // Correspondance exacte : le stub sql.js doit pouvoir charger le vrai
    // 'sql.js/dist/sql-wasm.js' sans être redirigé vers lui-même.
    alias: [
      { find: /^@capacitor\/core$/, replacement: ici('./tests/stubs/capacitor.js') },
      { find: /^idb-keyval$/, replacement: ici('./tests/stubs/idb-keyval.js') },
      { find: /^sql\.js$/, replacement: ici('./tests/stubs/sqljs.js') },
    ],
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    // Les tests « services » appellent le vrai TMDB : réseau requis,
    // donc lancés à part (npm run test:services).
    exclude: ['tests/services/**'],
  },
});

// Tests des règles de sécurité Firestore (amis par code). Séparés de la suite courante :
// ils ont besoin de l'émulateur Firestore (Java), lancé par `npm run test:regles`.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['firebase/tests/**/*.test.js'],
    testTimeout: 20000,
  },
});

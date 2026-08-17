import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le catalogue (recherche, tendances, genres, fiches, saisons) part désormais
// directement vers TMDB depuis l'app — plus aucun serveur (tranche 1, PLAN_ANDROID).
// Le proxy /api ne sert plus qu'au suivi/profils/listes, qui passeront sur la
// base embarquée en tranche 2. Il disparaîtra à ce moment-là.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.ts.net'],
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// L'application est autonome (tranches 1 et 2, PLAN_ANDROID) : le catalogue part
// directement vers TMDB, le suivi vit dans la base embarquée. Il n'y a plus de
// serveur, donc plus de proxy /api.
//
// Le moteur SQLite du navigateur (sql.js) charge son .wasm depuis
// public/assets/sql-wasm.wasm — voir client/src/db.js.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.ts.net'],
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le proxy renvoie les appels /api vers le back Express.
// L'UI n'appelle donc jamais TMDB directement : la clé reste côté back.
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

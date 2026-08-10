const CACHE = 'suivi-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Passthrough réseau : sert uniquement à satisfaire les critères d'installation PWA,
// pas de cache offline (l'app dépend de l'API TMDB/back en temps réel).
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

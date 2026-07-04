// Service Worker minimal pour compatibilité PWA (Progressive Web App)
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // Mode pass-through (laisse le navigateur faire les requêtes réseau normalement)
});

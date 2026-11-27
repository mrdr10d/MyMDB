// Minimal service worker. It exists so browsers treat the app as installable; it intentionally
// caches nothing (ratings/availability are live data and API responses must never be stored here).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})

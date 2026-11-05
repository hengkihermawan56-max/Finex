const CACHE = 'hengki-solana-shell-v1.1.0';
const FILES = ['./','./index.html','./app.js','./engine.js','./market.js','./styles.css','./tokens.css','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('hengki-solana-shell-') && k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  // Never cache or synthesize third-party market prices.
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});

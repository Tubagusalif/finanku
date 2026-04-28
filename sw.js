// FINANKU Service Worker v1.2
const CACHE_NAME = 'finanku-v1.2';
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './icon.svg',
];
const CDN_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
];

// Install: cache semua assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache static assets (pasti ada)
      cache.addAll(STATIC_ASSETS).catch(() => {});
      // Cache CDN assets (best effort, gagal OK)
      CDN_ASSETS.forEach(url => {
        cache.add(url).catch(() => {});
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: hapus cache lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first untuk assets, network-first untuk HTML
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Abaikan non-GET dan chrome-extension
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Strategy: Cache-first untuk CDN (fonts, JS libraries)
  if (CDN_ASSETS.some(a => request.url.startsWith(a.split('?')[0])) ||
      url.hostname === 'fonts.gstatic.com' ||
      url.hostname === 'fonts.googleapis.com') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
          }
          return response;
        }).catch(() => cached || new Response('Offline', { status: 503 }));
      })
    );
    return;
  }

  // Strategy: Network-first untuk index.html (supaya update langsung terasa)
  if (url.pathname.endsWith('index.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(request).then(response => {
        caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        return response;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Default: Cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        }
        return response;
      }).catch(() => new Response('Offline', { status: 503 }));
    })
  );
});

// Background sync placeholder (untuk future update)
self.addEventListener('sync', event => {
  if (event.tag === 'finanku-sync') {
    // Data disimpan di localStorage, jadi tidak perlu sync ke server
    console.log('[SW] Sync event — FINANKU data is local-first');
  }
});

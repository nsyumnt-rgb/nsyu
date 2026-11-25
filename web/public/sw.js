// NSYU PWA Service Worker
const CACHE_NAME = 'nsyu-pwa-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.png',
  './icon-192.png',
  './icon-512.png',
  './logo.png',
  './nsyu_logo.png',
  './offline.html'
];

// Install: Cache critical static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up older caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for API requests, Stale-while-revalidate for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Never cache non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // 2. Never cache dynamic private API requests
  if (url.pathname.includes('/api/') || url.hostname.includes('render.com') || url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ success: false, message: 'You are currently offline. Please check connection.' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
        });
      })
    );
    return;
  }

  // 3. For HTML navigations, try network, fallback to cache, then offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('./index.html').then((matched) => {
            return matched || caches.match('./offline.html');
          });
        })
    );
    return;
  }

  // 4. Stale-while-revalidate for static assets (images, css, js, fonts)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

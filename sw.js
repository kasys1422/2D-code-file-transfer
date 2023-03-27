const CACHE_NAME = '2d-code-file-transfer-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/main.css',
  '/main.js',
  '/lib/qrcode-generator/qrcode.js',
  '/lib/jsQR/jsQR.js',
  '/lib/pako/dist/pako.min.js',
  '/lib/bootstrap/dist/css/bootstrap.min.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

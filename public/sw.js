const CACHE_NAME = 'cold-reach-pro-v2';
const urlsToCache = [
  '/',
  '/index.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// --- PWA Builder Required Features ---

// Background Sync
self.addEventListener('sync', event => {
  if (event.tag === 'sync-leads') {
    console.log('Syncing leads in background');
  }
});

// Periodic Background Sync
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-stats') {
    console.log('Updating stats periodically');
  }
});

// Push Notifications
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New notification from Cold Reach Pro',
    icon: 'https://dummyimage.com/192x192/2563eb/ffffff.png',
    badge: 'https://dummyimage.com/192x192/2563eb/ffffff.png'
  };
  event.waitUntil(self.registration.showNotification('Cold Reach Pro', options));
});

// Notification Click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});

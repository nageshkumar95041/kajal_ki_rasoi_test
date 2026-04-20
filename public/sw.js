/**
 * Kajal Ki Rasoi — Service Worker
 * Handles: background push notifications + PWA offline caching
 */

const CACHE_NAME = 'kkr-v1';
const OFFLINE_URLS = ['/', '/menu', '/offline.html'];

// ── Install: cache key pages ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache on offline ───────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          return response;
        }
        return caches.match(event.request).then((cached) => cached || response);
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return new Response('Offline - page not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' }),
          });
        });
      })
  );
});

// ── Push: show notification on locked screen ─────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: '🍱 Kajal Ki Rasoi', body: 'You have a new update!', url: '/', tag: 'kkr-push' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    '/icons/icon-192.png',
      badge:   '/icons/badge-72.png',
      tag:     data.tag || 'kkr-push',
      renotify: true,
      data:    { url: data.url || '/' },
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: '👀 View' },
        { action: 'close', title: '✖ Dismiss' },
      ],
    })
  );
});

// ── Notification click: open the app ─────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If app is already open, focus it
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

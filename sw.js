const CACHE_NAME = 'olo-shell-v3';
const SHELL = ['./', './index.html', './push.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Cache only the app shell. Authenticated API responses and chat contents never enter Cache Storage.
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || '' }; }
  const title = payload.title || 'Olo';
  const options = {
    body: payload.body || 'У вас новое сообщение',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: payload.chatId ? `olo-chat-${payload.chatId}` : 'olo-message',
    renotify: true,
    data: { chatId: payload.chatId || null }
  };
  // iOS requires visible notifications for every received push event.
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  const target = new URL('./', self.registration.scope);
  if (chatId) target.searchParams.set('chat', chatId);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    for (const client of clients) {
      if (client.url.startsWith(self.registration.scope)) {
        client.postMessage({ type: 'OLO_OPEN_CHAT', chatId });
        return client.focus();
      }
    }
    return self.clients.openWindow(target.href);
  }));
});

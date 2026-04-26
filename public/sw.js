// Service Worker for Web Push Notifications

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: '新着レス', body: event.data.text(), url: '/' };
  }

  const options = {
    body: payload.body || '新しいレスがつきました',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'new-post',
    renotify: true,
    data: { url: payload.url || '/' },
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || '新着レス', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// The service worker of the dashboard's notifications (notify.mjs, /notifications): shows each push as the device's
// settings made it, and opens its page when it is touched (an open tab of the dashboard if there is one).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Tableau de bord', body: event.data ? event.data.text() : '' };
  }
  const options = {
    body: data.body || '',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag && data.renotify),
    silent: Boolean(data.silent),
    vibrate: data.vibrate || [],
    requireInteraction: Boolean(data.requireInteraction),
    data: { url: data.url || '/' },
    lang: 'fr',
  };
  event.waitUntil(self.registration.showNotification(data.title || 'Tableau de bord', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const same = tabs.find((tab) => tab.url === url) ?? tabs.find((tab) => new URL(tab.url).origin === self.location.origin);
    if (same) {
      await same.focus();
      if (same.url !== url && 'navigate' in same) await same.navigate(url).catch(() => {});
      return;
    }
    await self.clients.openWindow(url);
  })());
});

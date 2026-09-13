/* Kurukoo Firebase Messaging service worker. */
const FIREBASE_VERSION = '12.17.0';
const CONFIG_URL = '/api/fcm/config';
const ICON_URL = '/assets/brand/favicon.svg';

importScripts(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-compat.js`);
importScripts(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-messaging-compat.js`);

let messagingReady = false;

async function initialiseMessaging() {
  if (messagingReady) return true;
  try {
    const response = await fetch(CONFIG_URL, { cache: 'no-store', credentials: 'omit' });
    const payload = await response.json();
    if (!payload?.configured || !payload?.config) return false;
    firebase.initializeApp(payload.config);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((message) => {
      const notification = message?.notification || {};
      const data = message?.data || {};
      const title = String(notification.title || data.title || 'Kurukoo');
      const body = String(notification.body || data.body || 'You have a new Kurukoo update.');
      const link = String(data.link || '');
      const target = link || '/notifications';
      self.registration.showNotification(title, {
        body,
        icon: ICON_URL,
        badge: ICON_URL,
        data: { link: target, ...data },
      });
    });
    messagingReady = true;
    return true;
  } catch {
    return false;
  }
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = String(event.notification?.data?.link || '/notifications');
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(link);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(link);
  })());
});

void initialiseMessaging();

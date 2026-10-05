/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// skipWaiting + clientsClaim: sem o skipWaiting o service worker novo instalava e
// ficava parado em "waiting" até TODAS as janelas do app fecharem — e como o Hub
// abre em modo app e fica aberto, na prática a versão nova nunca entrava e o
// usuário via código antigo mesmo depois do deploy (só Ctrl+Shift+R resolvia).
self.skipWaiting();
clientsClaim();

// Precache todos os assets (manifest injetado pelo vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// API calls: sempre direto à rede
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly(),
);

// Navegação SPA: serve /index.html a partir do precache
const handler = createHandlerBoundToURL('/index.html');
registerRoute(
  new NavigationRoute(handler, { denylist: [/^\/api\//] }),
);

// ─── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event: PushEvent) => {
  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { title: 'Hub Pessoal', body: event.data?.text() ?? '' };
  }

  const options: NotificationOptions = {
    body: payload.body ?? '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: payload.url ?? '/' },

  };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Hub Pessoal', options),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl: string = (event.notification.data as { url?: string })?.url ?? '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return (client as WindowClient).focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});

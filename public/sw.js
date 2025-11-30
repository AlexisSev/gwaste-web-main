// Service Worker for Push Notifications
// This handles background push notifications using Web Push API
/* eslint-disable no-restricted-globals, no-undef */

self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  console.log('[Service Worker] Push had this data: ', event.data);

  let notificationData = {
    title: 'G-Waste Collection',
    body: 'New waste collection completed',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: 'collection-notification',
    data: {
      url: '/',
      type: 'collection'
    },
    requireInteraction: true,
    silent: false,
  };

  if (event.data) {
    try {
      const data = event.data.json();
      console.log('[Service Worker] Parsed push data:', data);

      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || notificationData.tag,
        data: data.data || notificationData.data,
        requireInteraction: data.requireInteraction !== undefined ? data.requireInteraction : notificationData.requireInteraction,
        silent: data.silent !== undefined ? data.silent : notificationData.silent,
      };

      console.log('[Service Worker] Using notification data:', notificationData);
    } catch (e) {
      console.error('[Service Worker] Failed to parse push data as JSON:', e);
      console.log('[Service Worker] Raw data:', event.data.text());
      notificationData.body = event.data.text() || notificationData.body;
    }
  } else {
    console.log('[Service Worker] No push data received, using defaults');
  }

  // Ensure icon exists before showing notification
  const checkIcon = async (iconUrl) => {
    try {
      const response = await fetch(iconUrl, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  };

  const promiseChain = checkIcon(notificationData.icon).then(iconExists => {
    if (!iconExists) {
      console.warn('[Service Worker] Icon not found, using default');
      notificationData.icon = '/favicon.ico';
      notificationData.badge = '/favicon.ico';
    }

    console.log('[Service Worker] Showing notification:', notificationData.title);

    return self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      requireInteraction: notificationData.requireInteraction,
      silent: notificationData.silent,
    });
  }).catch(error => {
    console.error('[Service Worker] Error showing notification:', error);
    // Fallback notification without icon
    return self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      tag: notificationData.tag,
      data: notificationData.data,
      requireInteraction: notificationData.requireInteraction,
      silent: notificationData.silent,
    });
  });

  event.waitUntil(promiseChain);
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click received.');

  event.notification.close();

  const data = event.notification.data || {};
  const urlToOpen = data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', function(event) {
  console.log('[Service Worker] Notification closed.');
});


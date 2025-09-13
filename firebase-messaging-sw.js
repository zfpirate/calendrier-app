// ===================== firebase-messaging-sw.js =====================
// Service Worker dédié à Firebase Cloud Messaging (FCM)
// Doit être placé dans le même dossier que index.html (ex: /calendrier-app/firebase-messaging-sw.js)

importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js');

// --- Config Firebase ---
firebase.initializeApp({
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
});

const messaging = firebase.messaging();

// ===================== Réception en arrière-plan =====================
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Message reçu en arrière-plan:', payload);

  const notificationTitle = payload.notification?.title || 'Rappel de devoir';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: './images/icone-notif.jpg',
    badge: './images/icone-notif.jpg',
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ===================== Clic sur la notification =====================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/calendrier-app/index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/calendrier-app/index.html');
      }
    })
  );
});

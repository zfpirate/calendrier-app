// ===================== firebase-messaging-sw.js =====================
// Service Worker dédié à Firebase Cloud Messaging (FCM)
// Doit être placé à la racine du site (ex: /firebase-messaging-sw.js)

// Import Firebase compat (nécessaire pour FCM en SW)
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js');

// --- Config Firebase (identique à client.js) ---
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
    icon: 'images/icone-notif.jpg', // ton icône de notif
    badge: 'images/icone-notif.jpg', // petite icône sur Android
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ===================== Clic sur la notification =====================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si une fenêtre est déjà ouverte, on la focus
      for (const client of clientList) {
        if (client.url.includes('/index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon on ouvre une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow('/index.html');
      }
    })
  );
});

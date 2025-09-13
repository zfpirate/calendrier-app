// ===================== firebase-messaging-sw.js =====================

// Import des scripts Firebase (compat pour SW)
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js');

// Config Firebase (identique à firebase-config.js)
firebase.initializeApp({
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
});

// Init Messaging
const messaging = firebase.messaging();

// Notifications en arrière-plan
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Notification background', payload);

  const notificationTitle = payload.notification?.title || 'Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/images/icone-notif.jpg' // ✅ chemin absolu vers ton icône
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ===================== Cache de la PWA =====================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('calendrier-cache-v1').then((cache) => {
      return cache.addAll([
        '/', // index.html
        '/style.css',
        '/main.js',
        '/client.js',
        '/images/icone-app.jpg',
        '/images/icone-notif.jpg'
      ]).catch(err => console.warn('⚠️ Fichier non trouvé, ignoré pour cache:', err));
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

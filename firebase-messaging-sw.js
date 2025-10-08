// firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js');

// Initialise Firebase dans le service worker
firebase.initializeApp({
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
});

// Récupère l’instance Messaging
const messaging = firebase.messaging();

// Notification reçue en background
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM] Notification background reçue:', payload);
  const notificationTitle = payload.notification?.title || 'Rappel devoir';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: './images/icone-notif.jpg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Pour gérer le clic sur la notification
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  // Ouvre ton site ou une page spécifique
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});

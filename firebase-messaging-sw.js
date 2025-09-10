// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js');

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

// Gestion des notifications push quand l'app est en background
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Message reçu en arrière-plan', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png' // si tu as un icône
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

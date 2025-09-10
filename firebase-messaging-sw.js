// firebase-messaging-sw.js

// Importer les scripts Firebase v11 (compat) depuis le CDN
importScripts('https://www.gstatic.com/firebasejs/11.31.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.31.0/firebase-messaging-compat.js');

// Initialisation de Firebase dans le Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
});

// Récupérer une instance de Messaging
const messaging = firebase.messaging();

// Optionnel : gérer les notifications en background
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification?.title || 'Devoir';
  const notificationOptions = {
    body: payload.notification?.body || 'Tu as un nouveau rappel !',
    icon: '/favicon.ico' // mettre ton icône si tu veux
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

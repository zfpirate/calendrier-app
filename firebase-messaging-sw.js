// ------------------------------
// firebase-messaging-sw.js - Service Worker FCM
// ------------------------------

// ⚠️ On utilise Firebase v9-compat pour le service worker
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// 1️⃣ Config Firebase (même que client.js)
firebase.initializeApp({
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
});

// 2️⃣ Initialisation messaging
const messaging = firebase.messaging();

// 3️⃣ Notifications en background
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Notification reçue en background:', payload);

  const notificationTitle = payload.notification?.title || "Nouveau devoir";
  const notificationOptions = {
    body: payload.notification?.body || "Tu as un nouveau rappel.",
    icon: '/icon.png' // remplace par ton icône si tu veux
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});


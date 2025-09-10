// firebase-messaging-sw.js (à la racine)
importScripts('https://www.gstatic.com/firebasejs/11.31.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.31.0/firebase-messaging-compat.js');

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

// Optionnel : gérer les notifications en background
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Message reçu en arrière-plan ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});


// firebase-messaging-sw.js

// Assure-toi que le SW est à la racine : /firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/11.31.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.31.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Quand une notification arrive en arrière-plan
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192.png' // optionnel, mets ton icône ici
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

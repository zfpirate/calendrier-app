// Import Firebase (⚠️ version stable dispo sur gstatic = 10.12.5)
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js");

// Config Firebase (même que client.js)
firebase.initializeApp({
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
});

// Init messaging
const messaging = firebase.messaging();

// 📩 Gestion des notifications en background
messaging.onBackgroundMessage((payload) => {
  console.log("📩 Message reçu en background:", payload);

  const notificationTitle = payload.notification?.title || "Nouvelle notif";
  const notificationOptions = {
    body: payload.notification?.body || "Tu as reçu une notification",
    icon: payload.notification?.icon || "/icon.png"
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

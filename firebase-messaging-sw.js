// firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js");

// Même config que ton client.js
const firebaseConfig = {
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
};

// Init Firebase
firebase.initializeApp(firebaseConfig);

// Récupère FCM
const messaging = firebase.messaging();

// Gestion des notifs en arrière-plan
messaging.onBackgroundMessage((payload) => {
  console.log("📩 Message reçu en background:", payload);

  const notificationTitle = payload.notification?.title || "Nouvelle notification";
  const notificationOptions = {
    body: payload.notification?.body || "Tu as un nouveau message.",
    icon: "/calendrier-app/icon.png" // Mets une icône de ton app si tu veux
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

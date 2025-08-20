// firebase-messaging-sw.js

// Import Firebase scripts pour le SW
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

// Config Firebase (pareil que ton firebase.js)
const firebaseConfig = {
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
};

// Init Firebase dans le SW
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Réception des notifications en arrière-plan
messaging.onBackgroundMessage((payload) => {
  console.log("📩 Notification reçue en arrière-plan :", payload);

  const title = payload.notification?.title || "Nouveau devoir";
  const options = {
    body: payload.notification?.body || "Tu as un devoir à faire !",
    icon: "/icon.png", // mets ton icône ici
  };

  self.registration.showNotification(title, options);
});


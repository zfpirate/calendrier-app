// ------------------------------
// client.js - Notifications FCM (version finale)
// ------------------------------

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-messaging.js";

// 1️⃣ Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
};

// 2️⃣ Initialisation Firebase (évite duplicate-app)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// 3️⃣ Messaging
const messaging = getMessaging(app);

// 4️⃣ Fonction pour init FCM
async function initFCM() {
  try {
    if (!('serviceWorker' in navigator)) {
      console.error("Service Worker non supporté !");
      return;
    }

    // Permission notifications
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return console.log("Permission not granted");

    // Enregistre le service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('Service Worker enregistré ✅', registration);

    // ⚡️ Attendre que le SW soit actif
    await navigator.serviceWorker.ready;

    // Récupère le token FCM
    const token = await getToken(messaging, {
      vapidKey: "BEk1IzaUQOXzKFu7RIkILgmWic1IgWfMdAECHofkTC5D5kmUY6tC0lWVIUtqCyHdrD96aiccAYW5A00PTQHYBZM",
      serviceWorkerRegistration: registration
    });
    console.log("Token FCM:", token);

    // Abonne le token au topic 'allUsers' via Cloud Function
    await fetch("https://us-central1-app-calendrier-d1a1d.cloudfunctions.net/subscribeToTopic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    console.log("Utilisateur abonné au topic allUsers ✅");

  } catch (err) {
    console.error("Erreur FCM:", err);
  }
}

// 5️⃣ Lancer init
initFCM();

// 6️⃣ Écouter notifications foreground
onMessage(messaging, (payload) => {
  console.log("Notification reçue :", payload);
  // Ici tu peux afficher un toast ou notification custom dans la page
});

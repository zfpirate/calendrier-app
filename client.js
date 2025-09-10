// client.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.31.0/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.31.0/firebase-messaging.js";

// ----- CONFIG FIREBASE -----
const firebaseConfig = {
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
};

// ----- INITIALISATION -----
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// ----- SERVICE WORKER -----
async function registerServiceWorker() {
  try {
    console.log("🔄 Enregistrement du service worker...");
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    console.log("✅ Service Worker FCM enregistré:", registration);
    return registration;
  } catch (err) {
    console.error("❌ Erreur SW:", err);
  }
}

// ----- DEMANDER PERMISSION ET GET TOKEN -----
async function initFCM() {
  try {
    const registration = await registerServiceWorker();
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      console.warn("⚠️ Permission notifications refusée");
      return;
    }

    const token = await getToken(messaging, { vapidKey: "BEk1IzaUQOXzKFu7RIkILgmWic1IgWfMdAECHofkTC5D5kmUY6tC0lWVIUtqCyHdrD96aiccAYW5A00PTQHYBZM", serviceWorkerRegistration: registration });
    console.log("🔑 FCM token:", token);
    // Ici tu peux l'envoyer dans Firestore pour ton utilisateur
  } catch (err) {
    console.error("Erreur FCM:", err);
  }
}

// ----- MESSAGE EN BACKGROUND / FRONT -----
onMessage(messaging, (payload) => {
  console.log("📩 Message reçu au premier plan:", payload);
  if (Notification.permission === "granted") {
    new Notification(payload.notification.title, {
      body: payload.notification.body,
      icon: "/favicon.ico"
    });
  }
});

// ----- INIT -----
initFCM();

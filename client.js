// client.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
};

// Initialisation Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const messaging = getMessaging(app);

// Service Worker
async function registerSW() {
  try {
    console.log("🔄 Enregistrement du service worker...");
    const registration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
    console.log("✅ Service Worker FCM enregistré:", registration);
    return registration;
  } catch (err) {
    console.error("Erreur SW:", err);
  }
}

// Récupération token FCM
async function initFCM() {
  try {
    const registration = await registerSW();
    const token = await getToken(messaging, {
      vapidKey: 'BEk1IzaUQOXzKFu7RIkILgmWic1IgWfMdAECHofkTC5D5kmUY6tC0lWVIUtqCyHdrD96aiccAYW5A00PTQHYBZM',
      serviceWorkerRegistration: registration
    });
    console.log("🔑 FCM token:", token);
  } catch (err) {
    console.error("Erreur FCM:", err);
  }
}

// Écouter les messages entrants (foreground)
onMessage(messaging, (payload) => {
  console.log("📩 Message reçu:", payload);
  alert(`Notification: ${payload.notification.title}`);
});

// Lancement
initFCM();

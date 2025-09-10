// client.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-messaging.js";

// ⚡ Ton config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
};


// ✅ Empêche d’initialiser deux fois
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const messaging = getMessaging(app);

// --- Enregistrement du Service Worker ---
async function registerServiceWorker() {
  try {
    // ⚠️ Ici on fixe bien le chemin
    const registration = await navigator.serviceWorker.register("/calendrier-app/firebase-messaging-sw.js");
    console.log("✅ Service Worker FCM enregistré:", registration);
    return registration;
  } catch (error) {
    console.error("❌ Erreur lors de l'enregistrement du SW:", error);
  }
}

// --- Initialisation de FCM ---
async function initFCM() {
  try {
    const registration = await registerServiceWorker();

    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }

    if (Notification.permission === "granted") {
      const currentToken = await getToken(messaging, {
        vapidKey: "TA_CLE_VAPID", // Mets ta clé publique VAPID Firebase
        serviceWorkerRegistration: registration
      });

      if (currentToken) {
        console.log("🔑 FCM token:", currentToken);
      } else {
        console.log("⚠️ Aucun token récupéré, permission refusée ?");
      }
    } else {
      console.log("❌ Permission notifications refusée");
    }

    // Réception de messages quand la page est ouverte
    onMessage(messaging, (payload) => {
      console.log("📩 Message reçu en foreground:", payload);
      alert(`Notification: ${payload.notification.title}\n${payload.notification.body}`);
    });

  } catch (err) {
    console.error("Erreur FCM:", err);
  }
}

// 🚀 Lancer l'init
initFCM();

// client.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";

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
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Fonction d'init FCM
export async function initFCM() {
  try {
    // Enregistre le service worker (⚠️ chemin relatif à ton repo GitHub Pages)
    const registration = await navigator.serviceWorker.register(
      "/calendrier-app/firebase-messaging-sw.js"
    );
    console.log("✅ Service Worker FCM enregistré:", registration);

    // Demande permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Notifications non autorisées");
    }

    // Récupère le token
    const currentToken = await getToken(messaging, {
      vapidKey: "BEk1IzaUQOXzKFu7RIkILgmWic1IgWfMdAECHofkTC5D5kmUY6tC0lWVIUtqCyHdrD96aiccAYW5A00PTQHYBZM", // Mets ta VAPID key Web Push
      serviceWorkerRegistration: registration,
    });

    if (currentToken) {
      console.log("🔑 FCM token:", currentToken);
    } else {
      console.warn("⚠️ Pas de token reçu.");
    }

    // Réception des messages
    onMessage(messaging, (payload) => {
      console.log("📩 Message reçu en foreground:", payload);
      alert(`Notif: ${payload.notification.title}`);
    });

  } catch (err) {
    console.error("❌ Erreur FCM:", err);
  }
}

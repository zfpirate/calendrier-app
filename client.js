import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js";

// 🔥 Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
};

// Initialise Firebase si pas déjà fait
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const messaging = getMessaging(app);

// ⚡ Enregistrement du service worker
async function initFCM() {
  console.log("🔄 Enregistrement du service worker...");
  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    console.log("✅ Service Worker FCM enregistré:", registration);

    // Récupération du token FCM
    const currentToken = await getToken(messaging, {
      vapidKey: "BEk1IzaUQOXzKFu7RIkILgmWic1IgWfMdAECHofkTC5D5kmUY6tC0lWVIUtqCyHdrD96aiccAYW5A00PTQHYBZM",
      serviceWorkerRegistration: registration
    });

    if (currentToken) {
      console.log("🔑 FCM token:", currentToken);
      // Ici tu peux envoyer le token à ton serveur / Firestore
    } else {
      console.warn("⚠️ Permission non accordée ou token introuvable");
    }

    // Gestion des messages en premier plan
    onMessage(messaging, (payload) => {
      console.log("📩 Message reçu en premier plan:", payload);
    });

  } catch (err) {
    console.error("❌ Erreur FCM:", err);
  }
}

// Démarre FCM
initFCM();

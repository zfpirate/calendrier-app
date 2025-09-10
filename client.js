import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js";

// 🔑 Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
};

// 🔑 Ta clé VAPID (depuis Firebase Console > Cloud Messaging > Certificat Web Push)
const vapidKey = "BEk1IzaUQOXzKFu7RIkILgmWic1IgWfMdAECHofkTC5D5kmUY6tC0lWVIUtqCyHdrD96aiccAYW5A00PTQHYBZM";

// ✅ Init Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const messaging = getMessaging(app);

async function initFCM() {
  try {
    console.log("🔄 Enregistrement du service worker...");
    const registration = await navigator.serviceWorker.register("/calendrier-app/firebase-messaging-sw.js");
    console.log("✅ Service Worker FCM enregistré:", registration);

    // Demande la permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("❌ Permission notifications refusée");
      return;
    }

    // Récupère le token
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (token) {
      console.log("🔑 FCM token:", token);
    } else {
      console.warn("⚠️ Aucun token reçu");
    }

    // Écoute les messages en premier plan
    onMessage(messaging, (payload) => {
      console.log("📩 Message reçu en foreground:", payload);
      new Notification(payload.notification.title, {
        body: payload.notification.body,
        icon: payload.notification.icon
      });
    });

  } catch (err) {
    console.error("Erreur FCM:", err);
  }
}

// Lance FCM si dispo
if ("serviceWorker" in navigator && "Notification" in window) {
  initFCM();
} else {
  console.warn("⚠️ Notifications ou Service Workers non supportés dans ce navigateur.");
}


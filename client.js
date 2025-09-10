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

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Demande la permission et récupère le token
async function initFCM() {
  try {
    console.log("🔄 Enregistrement du service worker...");
    const registration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
    console.log("✅ Service Worker FCM enregistré:", registration);

    // Demande permission notifications
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn("⚠️ Permission notifications refusée");
      return;
    }

    const fcmToken = await getToken(messaging, { vapidKey: "BElk1IzaUQOXzKFu7RIkILgmWic1IgWfMdAECHofkTC5D5kmUY6tC0lWVIUtqCyHdrD96aiccAYW5A00PTQHYBZM", serviceWorkerRegistration: registration });
    console.log("🔑 FCM token:", fcmToken);

    // Ecoute les messages en foreground
    onMessage(messaging, (payload) => {
      console.log("[client.js] Message reçu au foreground:", payload);
      alert(`Notification: ${payload.notification.title} - ${payload.notification.body}`);
    });

  } catch (error) {
    console.error("Erreur FCM:", error);
  }
}

initFCM();

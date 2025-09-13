// ===================== client.js =====================

// --- Firebase imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// --- Config Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
};

// --- Init Firebase ---
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const messaging = getMessaging(app);

// ===================== Init FCM =====================
async function initFCM() {
  try {
    if (!("serviceWorker" in navigator)) {
      console.warn("Service workers non supportés par ce navigateur.");
      return;
    }
    if (!("Notification" in window)) {
      console.warn("Notifications non supportées par ce navigateur.");
      return;
    }

    console.log("🔄 Enregistrement du service worker FCM...");
    // IMPORTANT: le fichier doit être à la racine du site
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    console.log("✅ Service Worker FCM enregistré:", registration);

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("⚠️ Permission notifications refusée");
      return;
    }

    const token = await getToken(messaging, {
      vapidKey: "BEk1IzaUQOXzKFu7RIkILgmWic1IgWfMdAECHofkTC5D5kmUY6tC0lWVIUtqCyHdrD96aiccAYW5A00PTQHYBZM",
      serviceWorkerRegistration: registration
    });

    if (!token) {
      console.warn("⚠️ Aucun token FCM obtenu.");
      return;
    }

    console.log("🔑 FCM token:", token);

    // Sauvegarder le token dans Firestore lié à l'utilisateur connecté
    if (auth.currentUser) {
      await setDoc(doc(db, "fcmTokens", auth.currentUser.uid), {
        token,
        updatedAt: new Date()
      });
      console.log("💾 Token FCM enregistré en base.");
    }

    // Abonner au topic allUsers via ta Cloud Function
    await fetch("https://us-central1-app-calendrier-d1a1d.cloudfunctions.net/subscribeToTopic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });

    console.log("📡 Abonné au topic allUsers");

    // Notifications en premier plan
    onMessage(messaging, (payload) => {
      console.log("[client.js] Notification foreground:", payload);
      if (Notification.permission === "granted") {
        new Notification(payload.notification?.title || "Notification", {
          body: payload.notification?.body || "",
          icon: "images/icone-notif.jpg"
        });
      } else {
        alert(`${payload.notification?.title}\n${payload.notification?.body}`);
      }
    });

  } catch (err) {
    console.error("❌ Erreur FCM:", err);
  }
}

// Lancer FCM après connexion utilisateur
onAuthStateChanged(auth, (user) => {
  if (user) {
    initFCM();
  }
});

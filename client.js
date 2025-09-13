// ===================== client.js =====================

// --- Imports Firebase ---
import { app, auth, db } from "./firebase-config.js"; // réutilise l'app initialisée
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// --- Init Messaging ---
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
    // IMPORTANT : chemin relatif pour GitHub Pages
    const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
    console.log("✅ Service Worker FCM enregistré:", registration);

    // Demander la permission après un clic utilisateur
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

// ===================== Lancement après connexion =====================
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Ici, on pourrait déclencher initFCM() après un clic bouton "Activer notifications"
    initFCM();
  }
});

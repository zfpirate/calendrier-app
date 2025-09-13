// ===================== client.js =====================

// Imports depuis firebase-config.js
import { app, auth, db, messaging } from "./firebase-config.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// ===================== Initialisation FCM =====================
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
    const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
    console.log("✅ Service Worker FCM enregistré:", registration);

    // Demande de permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("⚠️ Permission notifications refusée");
      return;
    }

    // Récupération du token FCM
    const token = await getToken(messaging, {
      vapidKey: "BEk1IzaUQOXzKFu7RIkILgmWic1IgWfMdAECHofkTC5D5kmUY6tC0lWVIUtqCyHdrD96aiccAYW5A00PTQHYBZM",
      serviceWorkerRegistration: registration
    });

    if (!token) {
      console.warn("⚠️ Aucun token FCM obtenu.");
      return;
    }

    console.log("🔑 FCM token:", token);

    // Sauvegarde du token dans Firestore si utilisateur connecté
    if (auth.currentUser) {
      await setDoc(doc(db, "fcmTokens", auth.currentUser.uid), {
        token,
        updatedAt: new Date()
      });
      console.log("💾 Token FCM enregistré en base.");
    }

    // Notifications en premier plan
    onMessage(messaging, (payload) => {
      console.log("[client.js] Notification foreground:", payload);
      if (Notification.permission === "granted") {
        new Notification(payload.notification?.title || "Notification", {
          body: payload.notification?.body || "",
          icon: "./image/icone-notif.jpg"
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

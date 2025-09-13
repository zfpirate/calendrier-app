import { app, auth, db } from "./firebase-config.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const messaging = getMessaging(app);

async function initFCM() {
  try {
    if (!("serviceWorker" in navigator)) return console.warn("Service worker non supporté");
    if (!("Notification" in window)) return console.warn("Notifications non supportées");

    console.log("🔄 Enregistrement du service worker FCM...");
    const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
    console.log("✅ Service Worker FCM enregistré:", registration);

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return console.warn("⚠️ Permission notifications refusée");

    const token = await getToken(messaging, {
      vapidKey: "BEk1IzaUQOXzKFu7RIkILgmWic1IgWfMdAECHofkTC5D5kmUY6tC0lWVIUtqCyHdrD96aiccAYW5A00PTQHYBZM",
      serviceWorkerRegistration: registration
    });

    if (!token) return console.warn("⚠️ Aucun token FCM obtenu.");
    console.log("🔑 FCM token:", token);

    if (auth.currentUser) {
      await setDoc(doc(db, "fcmTokens", auth.currentUser.uid), { token, updatedAt: new Date() });
      console.log("💾 Token FCM enregistré en base.");
    }

    onMessage(messaging, (payload) => {
      console.log("[client.js] Notification foreground:", payload);
      if (Notification.permission === "granted") {
        new Notification(payload.notification?.title || "Notification", {
          body: payload.notification?.body || "",
          icon: "./images/icone-notif.jpg"
        });
      } else {
        alert(`${payload.notification?.title}\n${payload.notification?.body}`);
      }
    });

  } catch (err) {
    console.error("❌ Erreur FCM:", err);
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) initFCM();
});


import { app, auth, db } from "./firebase-config.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

async function initFCM() {
  try {
    if (!("serviceWorker" in navigator)) return console.warn("Service worker non supporté");
    if (!("Notification" in window)) return console.warn("Notifications non supportées");

    const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
    console.log("✅ Service Worker FCM enregistré:", registration);

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return console.warn("⚠️ Permission notifications refusée");

    const messaging = getMessaging(app);

    const token = await getToken(messaging, {
      vapidKey: "BEk1IzaUQOXzKFu7RIkILgmWic1IgWfMdAECHofkTC5D5kmUY6tC0lWVIUtqCyHdrD96aiccAYW5A00PTQHYBZM",
      serviceWorkerRegistration: registration
    });
    if (!token) return console.warn("⚠️ Aucun token FCM obtenu.");

    console.log("🔑 FCM token:", token);

    if (auth.currentUser) {
      await setDoc(doc(db, "fcmTokens", auth.currentUser.uid), { token, updatedAt: new Date() });
      console.log("💾 Token FCM enregistré en base.");
      // subscription topic
      fetch("https://us-central1-TON-PROJECT.cloudfunctions.net/subscribeToTopic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      })
      .then(() => console.log("✅ Token abonné au topic"))
      .catch(err => console.error("❌ Erreur subscription topic:", err));
    }

    // Foreground notifications
    onMessage(messaging, (payload) => {
      console.log("[FCM] Notification foreground:", payload);
      if (Notification.permission === "granted") {
        new Notification(payload.notification?.title || "Rappel devoir", {
          body: payload.notification?.body || "",
          icon: "./images/icone-notif.jpg"
        });
      }
    });

  } catch (err) {
    console.error("❌ Erreur FCM:", err);
  }
}

// init FCM après login
onAuthStateChanged(auth, (user) => {
  if (user) initFCM();
});


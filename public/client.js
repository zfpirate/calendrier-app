// =================== IMPORTS ===================
// Firebase v10 ES Modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore, doc, setDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";

// =================== CONFIG ===================
const firebaseConfig = {
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
};

const DEVICE_ID_STORAGE_KEY = "fcmDeviceId_v1";

function generateDeviceId() {
  const fallback = () => `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  try {
    const cryptoRef = (typeof self !== "undefined" && self.crypto) || (typeof window !== "undefined" && window.crypto);
    if (cryptoRef?.randomUUID) {
      return cryptoRef.randomUUID();
    }
  } catch (_) {}
  return fallback();
}

function getOrCreateDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;
    const fresh = generateDeviceId();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, fresh);
    return fresh;
  } catch (err) {
    console.warn("Impossible de gérer l'identifiant appareil FCM:", err);
    return generateDeviceId();
  }
}

// =================== INIT ===================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// =================== FCM ===================
const FCM_SW_PATH = "/firebase-messaging-sw.js";
const FCM_VAPID_KEY = "BEk1IzaUQOXzKFu7RIkILgmWic1IgWfMdAECHofkTC5D5kmUY6tC0lWVIUtqCyHdrD96aiccAYW5A00PTQHYBZM";

let fcmInitPromise = null;

async function persistFcmToken(token) {
  if (!token) return;

  window.__LAST_FCM_TOKEN = token;
  const user = auth.currentUser;
  if (!user) {
    return;
  }

  const userRef = doc(db, "users", user.uid);
  const deviceId = getOrCreateDeviceId();
  const deviceField = `fcmDevices.${deviceId}`;
  const now = new Date();
  const metadata = {
    token,
    updatedAt: now,
    userAgent: navigator.userAgent || "",
    platform: navigator.platform || ""
  };

  await setDoc(
    userRef,
    {
      fcmToken: token,
      fcmTokenUpdatedAt: now,
      preferredFcmToken: token,
      preferredFcmDeviceId: deviceId,
      [deviceField]: metadata
    },
    { merge: true }
  );

  try {
    await updateDoc(userRef, { fcmTokens: arrayUnion(token) });
  } catch (e) {
    try {
      await setDoc(userRef, { fcmTokens: [token] }, { merge: true });
    } catch (_) {}
  }

  if (window.__LAST_SUBSCRIBED_FCM_TOKEN !== token) {
    window.__LAST_SUBSCRIBED_FCM_TOKEN = token;
    fetch("https://europe-west1-app-calendrier-d1a1d.cloudfunctions.net/subscribeToTopic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, topic: "global" })
    })
      .then(() => console.log("Token abonné au topic global"))
      .catch(err => console.error("Erreur subscription topic:", err));
  }

  console.log("Token FCM enregistré (single + array) dans users/{uid}.");
}

async function initFCM(force = false) {
  if (fcmInitPromise && !force) {
    return fcmInitPromise;
  }
  if (window.__FCM_INITIALIZED && !force) {
    if (auth.currentUser && window.__LAST_FCM_TOKEN) {
      persistFcmToken(window.__LAST_FCM_TOKEN).catch((err) =>
        console.warn("Impossible de resauvegarder le token FCM:", err)
      );
    }
    return;
  }

  if (!("serviceWorker" in navigator)) {
    console.warn("Service worker non supporté, impossible d'activer les notifications.");
    return;
  }

  if (typeof Notification === "undefined") {
    console.warn("Notifications non supportées sur ce navigateur/appareil.");
    try {
      window.dispatchEvent(new CustomEvent("fcm-unsupported", { detail: { reason: "notifications-api" } }));
    } catch (_) {}
    return;
  }

  if (!window.__FCM_SW_PROMISE) {
    window.__FCM_SW_PROMISE = navigator.serviceWorker
      .register(FCM_SW_PATH)
      .catch(async (err) => {
        console.error("Enregistrement Service Worker FCM échoué:", err);
        throw err;
      })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        console.log("Service Worker FCM prêt:", reg);
        return reg;
      });
  }

  const initFlow = (async () => {
    const swReg = await window.__FCM_SW_PROMISE;

    if (Notification.permission === "denied") {
      console.warn("Permission notifications déjà refusée.");
      return null;
    }

    let permission = Notification.permission;
    if (permission !== "granted") {
      try {
        permission = await Notification.requestPermission();
      } catch (err) {
        console.warn("Impossible de demander la permission notifications:", err);
        return null;
      }
    }

    if (permission !== "granted") {
      console.warn("Permission notifications refusée");
      return null;
    }

    const messaging = getMessaging(app);
    let token;
    try {
      token = await getToken(messaging, {
        vapidKey: FCM_VAPID_KEY,
        serviceWorkerRegistration: swReg
      });
    } catch (e) {
      console.warn("getToken initial failed:", e?.name || e, e);
      if (e?.name === "AbortError" || String(e).includes("AbortError")) {
        try {
          const sub = await swReg.pushManager.getSubscription();
          if (sub) await sub.unsubscribe();
          token = await getToken(messaging, {
            vapidKey: FCM_VAPID_KEY,
            serviceWorkerRegistration: swReg
          });
        } catch (e2) {
          console.error("getToken retry failed:", e2);
          throw e2;
        }
      } else {
        throw e;
      }
    }

    if (!token) {
      console.warn("Aucun token FCM obtenu.");
      return null;
    }

    console.log("FCM token:", token);

    try {
      window.__LAST_FCM_TOKEN = token;
      window.dispatchEvent(new CustomEvent("fcm-token-ready", { detail: token }));
    } catch (err) {
      console.warn("Impossible d'exposer le token FCM globalement:", err);
    }

    const messagingInstance = messaging;
    onMessage(messagingInstance, (payload) => {
      console.log("[FCM] Notification foreground:", payload);
      if (Notification.permission !== "granted") return;
      const data = payload.data || {};
      const title = data.title || payload.notification?.title || "Rappel devoir";
      const body = data.body || payload.notification?.body || "";
      const icon = data.icon || "/icone-notif-192.jpg";
      const notification = new Notification(title, {
        body,
        icon,
        data: {
          url: data.click_action || "/",
          ...data
        }
      });
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        if (notification.data?.url) {
          window.location.href = notification.data.url;
        }
      };
    });

    return token;
  })();

  fcmInitPromise = initFlow;

  try {
    const token = await initFlow;
    if (token) {
      await persistFcmToken(token);
      window.__FCM_INITIALIZED = true;
    }
    return token;
  } catch (err) {
    window.__FCM_INITIALIZED = false;
    console.error("Erreur FCM:", err);
    throw err;
  } finally {
    fcmInitPromise = null;
  }
}

// =================== AUTH STATE ===================
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Utilisateur connecté, initialisation FCM...");
    if (window.__LAST_FCM_TOKEN) {
      persistFcmToken(window.__LAST_FCM_TOKEN).catch((err) =>
        console.warn("Impossible d'associer le token FCM à l'utilisateur:", err)
      );
    }
    initFCM().catch((err) => console.warn("initFCM a échoué", err));
  } else {
  }
});

// =================== Token Refresh ===================
async function refreshTokenIfNeeded() {
  if (!auth.currentUser) return;
  
  try {
    const newToken = await initFCM(true); // force = true
    if (newToken && newToken !== window.__LAST_FCM_TOKEN) {
      console.log("[FCM] Nouveau token détecté, mise à jour...");
      await persistFcmToken(newToken);
    }
  } catch (e) {
    console.warn("[FCM] Échec rafraîchissement token:", e);
  }
}

// Refresh token sur événements (sans timer)
window.addEventListener('load', () => {
  if (auth.currentUser) {
    refreshTokenIfNeeded();
  }
});

window.addEventListener('focus', () => {
  if (auth.currentUser) {
    refreshTokenIfNeeded();
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && auth.currentUser) {
    refreshTokenIfNeeded();
  }
});

// Exposer les fonctions de debug
window.__checkMyTokens = async function() {
  if (!auth.currentUser) {
    console.log("Utilisateur non connecté");
    return;
  }
  
  try {
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");
    
    const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
    const data = snap.data();
    
    console.log("=== DEBUG TOKENS FCM ===");
    console.log("Tokens enregistrés:", data.fcmTokens);
    console.log("Token préféré:", data.preferredFcmToken);
    console.log("Appareils:", data.fcmDevices);
    console.log("Token actuel (localStorage):", window.__LAST_FCM_TOKEN);
    console.log("FCM initialisé:", window.__FCM_INITIALIZED);
    console.log("========================");
    
    return data;
  } catch (e) {
    console.error("Erreur debug tokens:", e);
  }
};

window.__forceTokenRefresh = refreshTokenIfNeeded;

// =================== ADMIN PANEL ===================
let isAdmin = false;

// Vérifier le rôle admin au chargement
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const idTokenResult = await user.getIdTokenResult();
      isAdmin = idTokenResult.claims.admin === true;
      
      if (isAdmin) {
        document.getElementById('admin-panel-btn').style.display = 'inline-block';
        document.getElementById('admin-status').textContent = '👑 Admin';
        document.getElementById('admin-controls').style.display = 'inline-block';
      }
    } catch (error) {
      console.error('Erreur vérification admin:', error);
    }
  }
});

// Panneau d'administration
document.getElementById('admin-panel-btn')?.addEventListener('click', async () => {
  if (!isAdmin) return;
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Panneau d'Administration</h2>
      <div id="admin-users-list"></div>
      <button onclick="this.closest('.modal').remove()" class="close-btn">Fermer</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Charger la liste des utilisateurs
  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch('https://europe-west1-app-calendrier-d1a1d.cloudfunctions.net/listUsersWithRoles', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    const usersList = document.getElementById('admin-users-list');
    
    usersList.innerHTML = `
      <h3>Utilisateurs (${data.users.length})</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="border: 1px solid #ccc; padding: 8px;">Email</th>
            <th style="border: 1px solid #ccc; padding: 8px;">Nom</th>
            <th style="border: 1px solid #ccc; padding: 8px;">Rôle</th>
            <th style="border: 1px solid #ccc; padding: 8px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${data.users.map(user => `
            <tr>
              <td style="border: 1px solid #ccc; padding: 8px;">${user.email}</td>
              <td style="border: 1px solid #ccc; padding: 8px;">${user.displayName}</td>
              <td style="border: 1px solid #ccc; padding: 8px;">
                <span style="color: ${user.isAdmin ? 'green' : 'gray'};">
                  ${user.isAdmin ? '👑 Admin' : '👤 User'}
                </span>
              </td>
              <td style="border: 1px solid #ccc; padding: 8px;">
                <button onclick="toggleAdminRole('${user.uid}', ${user.isAdmin})" 
                        class="admin-toggle-btn">
                  ${user.isAdmin ? 'Retirer Admin' : 'Rendre Admin'}
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Erreur chargement utilisateurs:', error);
    document.getElementById('admin-users-list').innerHTML = 
      '<p style="color: red;">Erreur lors du chargement des utilisateurs</p>';
  }
});

// Fonction pour basculer le rôle admin
window.toggleAdminRole = async (userId, isCurrentlyAdmin) => {
  if (!confirm(`Êtes-vous sûr de vouloir ${isCurrentlyAdmin ? 'retirer' : 'attribuer'} les droits admin à cet utilisateur ?`)) {
    return;
  }
  
  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch('https://europe-west1-app-calendrier-d1a1d.cloudfunctions.net/manageAdminRole', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        targetUserId: userId,
        action: isCurrentlyAdmin ? 'remove' : 'add'
      })
    });
    
    if (response.ok) {
      alert('Rôle admin mis à jour avec succès');
      // Recharger la liste
      document.getElementById('admin-panel-btn').click();
      document.getElementById('admin-panel-btn').click();
    } else {
      throw new Error('Erreur lors de la mise à jour du rôle');
    }
  } catch (error) {
    console.error('Erreur mise à jour rôle:', error);
    alert('Erreur lors de la mise à jour du rôle admin');
  }
};

// =================== EXPORTS ===================
export { db, auth };


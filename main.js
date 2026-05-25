/* ================== IMPORTS ================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";
import {
  getMessaging,
  getToken,
  onMessage,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";
import { ThemeEngine, getFormThemeConfig, loadConfigToForm, updateThemePreview, PRESET_THEMES } from "./theme-engine.js";

/* ================== Firebase config ================== */
const firebaseConfig = {
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
};

/* ================== Init Firebase ================== */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const messaging = getMessaging(app);

/* ================== CHARGEMENT IMMÉDIAT DES DONNÉES ================== */
console.log("🚀 Démarrage de l'application - Version 80");

// Vérifier immédiatement si l'utilisateur est déjà connecté et charger les données
if (auth.currentUser) {
  console.log("🚀 Utilisateur déjà connecté, chargement immédiat des données...");
  
  // Définir une fonction de chargement rapide avant le reste du code
  async function quickLoadUserData() {
    try {
      console.log("🚀 CHARGEMENT IMMÉDIAT des données utilisateur...");
      
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      
      if (userDoc.exists()) {
        const freshData = userDoc.data();
        window.__tempUserData = freshData;
        
        console.log("🔥 Données brutes chargées immédiatement:", freshData);
        console.log("🔥 Valeur de defaultHour dans les données brutes:", freshData.defaultHour);
        console.log("🔥 Paramètres chargés immédiatement:", {
          ecoleUser: freshData.ecoleUser ? "[présent]" : "[manquant]",
          defaultReminder: freshData.defaultReminder || 1,
          defaultHour: freshData.defaultHour || "18:00"
        });
        console.log("🚀 ✅ Données utilisateur chargées avec succès au démarrage");
      }
    } catch (err) {
      console.error("🚀 ❌ Erreur chargement immédiat:", err);
    }
  }
  
  // Lancer le chargement immédiat
  quickLoadUserData();
}

/* ================== Credential helpers ================== */
function encryptText(plain) {
  return String(plain ?? "");
}

function decryptText(cipher) {
  return String(cipher ?? "");
}

/* ================== DOM references ================== */
const calendar = document.getElementById("calendar");
const monthYear = document.getElementById("monthYear");
const prevMonthBtn = document.getElementById("prev-month-btn");
const nextMonthBtn = document.getElementById("next-month-btn");
const settingsBtn = document.getElementById("settings-btn");
const testNotifBtn = document.getElementById("test-notif-btn");

const modalBg = document.getElementById("modal-bg");
const modalTitle = document.getElementById("modal-title");
const typeSelect = document.getElementById("typeSelect");
const matiereInput = document.getElementById("matiere");
const titreInput = document.getElementById("titre");
const dateInput = document.getElementById("date");
// const heureInput = document.getElementById("heure"); // Supprimé - plus dans le HTML
const rappelCheckbox = document.getElementById("rappel");
const rappelOffsetInput = document.getElementById("rappel-offset");
const rappelTimeInput = document.getElementById("rappel-time");
const rappelDateInput = document.getElementById("rappel-date");
const customDateContainer = document.getElementById("custom-date-container");
const cancelBtn = document.getElementById("cancel-btn");
const deleteBtn = document.getElementById("delete-btn");
const taskForm = document.getElementById("taskForm");

const paramsBg = document.getElementById("params-bg");
const paramsForm = document.getElementById("paramsForm");
const userIdInput = document.getElementById("userId");
const userPassInput = document.getElementById("userPass");
const defaultReminderInput = document.getElementById("defaultReminder");
const defaultHourInput = document.getElementById("defaultHour");
const paramsCancelBtn = document.getElementById("params-cancel-btn");

const dayTasksBg = document.getElementById("dayTasks-bg");
const dayTasksTitle = document.getElementById("dayTasks-title");
const dayTasksList = document.getElementById("dayTasks-list");
const dayTasksAddBtn = document.getElementById("dayTasks-add-btn");
const dayTasksCloseBtn = document.getElementById("dayTasks-close-btn");

const loginBg = document.getElementById("login-bg");
const loginUserInput = document.getElementById("loginUser");
const loginPassInput = document.getElementById("loginPass");
const loginSubmitBtn = document.getElementById("loginSubmit");
const loginGoogleBtn = document.getElementById("loginGoogle");

const trashDiv = document.getElementById("trash");

/* ================== Constants & state ================== */
const MONTH_NAMES = [
  "Janvier",
  "Fevrier",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Aout",
  "Septembre",
  "Octobre",
  "Novembre",
  "Decembre"
];

const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const state = {
  currentYear: null,
  currentMonth: null,
  selectedDate: null,
  defaultReminder: 1,
  defaultHour: "18:00",
  currentUser: null,
  currentUserDoc: null,
  editingDocId: null,
  editingGroupId: null,
  editingGroupDocs: null,
  preservedReminderOffset: null,
  preservedReminderDate: null,
  preservedReminderTime: null,
  authReady: false
};

let externalHWUnsub = null;

const dragContext = {
  id: null,
  groupId: null,
  type: null
};

/* ================== Utils ================== */
function ensureAuthed() {
  if (!state.currentUser) {
    if (!state.authReady) {
      throw new Error("Auth state not ready");
    }
    if (loginBg) loginBg.style.display = "flex";
    throw new Error("User not authenticated");
  }
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(str) {
  if (str instanceof Date) return str;
  if (typeof str !== 'string') {
    str = String(str || "");
  }
  const [y, m, d] = (str || "").split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return new Date(NaN);
  }
  return new Date(y, m - 1, d);
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function sanitizeHour(value) {
  if (!value) return ""; // Retourner une chaîne vide au lieu de l'heure par défaut
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return "";
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getDateParts(dateStr) {
  const d = parseDate(dateStr);
  if (isNaN(d.getTime()) || !isFinite(d.getTime())) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate()
    };
  }
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate()
  };
}

function diffInDays(laterDateStr, earlierDateStr) {
  const later = parseDate(laterDateStr);
  const earlier = parseDate(earlierDateStr);
  const ms = startOfDay(later).getTime() - startOfDay(earlier).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function computeTimestamp(dateStr, heure) {
  const date = parseDate(dateStr);
  if (isNaN(date.getTime()) || !isFinite(date.getTime())) {
    return Date.now(); // Fallback to current time
  }
  const [hh, mm] = sanitizeHour(heure).split(":").map(Number);
  date.setHours(hh, mm, 0, 0);
  return date.getTime();
}

function isBeforeToday(dateStr) {
  const date = startOfDay(parseDate(dateStr));
  return date < startOfDay(new Date());
}

function generateGroupId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `grp_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function computeReminderDate(dueDateStr, offsetDays, clampToToday = false) {
  let offset = Number(offsetDays);
  if (!Number.isFinite(offset)) offset = Number(state.defaultReminder) || 0;
  const dueDate = parseDate(dueDateStr);
  const reminderDate = new Date(dueDate);
  reminderDate.setDate(reminderDate.getDate() - offset);
  
  // Ne plus forcer la date d'aujourd'hui - garder les rappels tels quels
  // Même s'ils sont dans le passé, on les garde à leur date calculée
  
  return reminderDate;
}

/* ================== FCM Notification Management ================== */
async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("Ce navigateur ne supporte pas les notifications");
    return false;
  }
  
  if (Notification.permission === "granted") {
    return true;
  }
  
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  
  return false;
}

async function getFCMToken() {
  try {
    if (!messaging) {
      console.warn("Messaging non initialisé");
      return null;
    }
    
    const currentToken = await getToken(messaging, {
      vapidKey: "BEk1IzaUQOXzKFu7RIkILgmWic1IgWfMdAECHofkTC5D5kmUY6tC0lWVIUtqCyHdrD96aiccAYW5A00PTQHYBZM"
    });
    
    if (currentToken) {
      console.log("FCM token obtenu:", currentToken);
      return currentToken;
    } else {
      console.warn("Aucun FCM token disponible");
      return null;
    }
  } catch (error) {
    console.error("Erreur obtention FCM token:", error);
    return null;
  }
}

// Fonction pour détecter si l'appareil est mobile
function isMobileDevice() {
  // Détection plus précise
  const isMobile = window.innerWidth <= 768 || 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent) ||
    ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  
  console.log(`Détection appareil: ${isMobile ? 'mobile' : 'desktop'} (width: ${window.innerWidth}, userAgent: ${navigator.userAgent.substring(0, 50)}...)`);
  return isMobile;
}

// Fonction pour afficher le statut des notifications à l'utilisateur
function showNotificationStatus() {
  const isMobile = isMobileDevice();
  const statusDiv = document.createElement('div');
  statusDiv.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${isMobile ? '#4CAF50' : '#2196F3'};
    color: white;
    padding: 10px 15px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    opacity: 0;
    transition: opacity 0.3s;
  `;
  statusDiv.textContent = isMobile ? '📱 Notifications activées (mobile)' : '💻 Notifications limitées (desktop)';
  document.body.appendChild(statusDiv);
  
  setTimeout(() => statusDiv.style.opacity = '1', 100);
  setTimeout(() => {
    statusDiv.style.opacity = '0';
    setTimeout(() => document.body.removeChild(statusDiv), 300);
  }, 3000);
}

async function saveFCMTokenToUser(token) {
  if (!state.currentUser || !token) return;
  
  try {
    const userRef = doc(db, "users", state.currentUser.uid);
    const deviceId = getOrCreateDeviceId();
    const isMobile = isMobileDevice();
    
    await updateDoc(userRef, {
      preferredFcmToken: token,
      fcmTokenUpdatedAt: new Date().toISOString(),
      [`fcmDevices.${deviceId}`]: {
        token,
        updatedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        isMobile: isMobile,
        priority: isMobile ? 'high' : 'normal'
      }
    });
    console.log(`Token FCM sauvegardé pour l'utilisateur (priorité: ${isMobile ? 'mobile' : 'desktop'})`);
  } catch (error) {
    console.error("Erreur sauvegarde token FCM:", error);
  }
}

async function initializeNotifications() {
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log("Permission de notification refusée");
      return;
    }
    
    // Vérifier si l'utilisateur a des appareils mobiles enregistrés
    if (state.currentUser && !isMobileDevice()) {
      try {
        const userDoc = await getDoc(doc(db, "users", state.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const fcmDevices = userData.fcmDevices || {};
          const hasMobileDevices = Object.values(fcmDevices).some(device => device.isMobile);
          const forceDesktopNotifications = userData.forceDesktopNotifications || false;
          
          if (hasMobileDevices && !forceDesktopNotifications) {
            console.log("📱 Appareils mobiles détectés, désactivation des notifications sur desktop");
            return; // Ne pas initialiser les notifications sur desktop
          }
          
          if (hasMobileDevices && forceDesktopNotifications) {
            console.log("💻 Forçage des notifications desktop activé par l'utilisateur");
          }
        }
      } catch (err) {
        console.warn("Erreur vérification appareils mobiles:", err);
      }
    }
    
    console.log(`🔔 Initialisation notifications sur ${isMobileDevice() ? 'mobile' : 'desktop'}`);
    
    // Afficher le statut à l'utilisateur
    setTimeout(() => showNotificationStatus(), 2000);
    
    // Initialize Firebase Cloud Messaging
    const { getMessaging, onMessage } = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js");
    const { getApp } = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js");
    
    window.messaging = getMessaging(getApp());
    
    // Get FCM token
    const token = await getFCMToken();
    if (token) {
      await saveFCMTokenToUser(token);
    }
    
    // Handle foreground messages
    onMessage(window.messaging, (payload) => {
      console.log("Message reçu en premier plan:", payload);
      
      const notificationTitle = payload.data?.title || payload.notification?.title || 'Notification';
      const notificationOptions = {
        body: payload.data?.body || payload.notification?.body || '',
        icon: payload.data?.icon || '/icone-notif-192.jpg',
        data: payload.data || {}
      };
      
      new Notification(notificationTitle, notificationOptions);
    });
    
  } catch (error) {
    console.error("Erreur initialisation notifications:", error);
  }
}

function buildTaskLabel(task) {
  const type = task.type || (task.rappel ? "rappel" : "devoir");
  const parts = [];
  if (task.matiere) parts.push(task.matiere);
  if (task.titre && task.titre !== task.matiere) parts.push(task.titre);
  if (task.heure) parts.push(`(${task.heure})`);
  if (type === "rappel") parts.push("[Rappel]");
  if (type === "evaluation") parts.push("[Eval]");
  return parts.join(" ").trim() || (type === "rappel" ? "Rappel" : "Devoir");
}

//* ================== External devoirs import ==================

// Fonction pour importer manuellement les devoirs
async function importDevoirsManuellement() {
  try {
    if (!state.currentUser) {
      console.log('Importation annulée : utilisateur non connecté');
      return null;
    }

    if (!state.currentUserDoc?.ecoleUser || !state.currentUserDoc?.ecolePass) {
      console.log('Importation annulée : identifiants manquants');
      return null;
    }

    console.log('Début de l\'importation...');
    
    // Récupérer le token d'authentification Firebase
    const token = await state.currentUser.getIdToken();
    
    const response = await fetch('https://europe-west1-app-calendrier-d1a1d.cloudfunctions.net/importDevoirs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        userId: state.currentUserDoc.ecoleUser, 
        password: state.currentUserDoc.ecolePass,
        userIdFirebase: state.currentUser.uid
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('Résultat de l\'importation:', result);
    
    if (result.count > 0) {
      console.log(`${result.count} devoirs importés avec succès`);
      await renderCalendar(state.currentYear, state.currentMonth);
      if (state.selectedDate) {
        await refreshDayTasksList(state.selectedDate);
      }
    } else {
      console.log('Aucun nouveau devoir à importer');
    }
    
    return result;
  } catch (err) {
    console.error("Erreur lors de l'importation:", err);
    // Ne pas afficher d'alerte pour ne pas déranger l'utilisateur
    return null;
  }
}

// Gestionnaire pour le bouton d'import manuel
document.getElementById('import-manuel-btn')?.addEventListener('click', function(e) {
  e.preventDefault();
  importDevoirsManuellement();
});

// Fonction pour vérifier et exécuter l'import automatique si nécessaire
async function checkAndRunAutoImport() {
  try {
    ensureAuthed();
    // Vérifier si l'import automatique est activé et si on a des identifiants
    if (state.currentUserDoc?.autoImport && 
        state.currentUserDoc?.ecoleUser && 
        state.currentUserDoc?.ecolePass) {
      console.log("Import automatique activé, vérification des devoirs...");
      await importDevoirsManuellement();
    }
  } catch (err) {
    console.error("Erreur lors de l'import automatique:", err);
    // Ne pas afficher d'alerte pour éviter de gêner l'utilisateur
  }
}

// Fonction utilitaire pour afficher des notifications
function showNotification(message, type = 'info') {
  // Vérifier si une notification est déjà affichée
  let notification = document.querySelector('.import-notification');
  
  if (!notification) {
    notification = document.createElement('div');
    notification.className = `import-notification ${type}`;
    document.body.appendChild(notification);
  } else {
    notification.className = `import-notification ${type}`;
  }
  
  notification.textContent = message;
  notification.style.display = 'block';
  
  // Cacher la notification après 5 secondes
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.style.display = 'none';
      notification.style.opacity = '1';
    }, 500);
  }, 5000);
}

// ================== SYSTÈME UNIFIÉ DE BLACKLIST ==================

// Ajouter un événement à la blacklist permanente (évite les doublons)
async function addToPermanentBlacklist(eventId, type = 'devoir', reason = 'manual') {
  if (!eventId || !state.currentUser) return false;
  
  try {
    // Vérifier si déjà blacklisté
    const alreadyBlacklisted = await isPermanentlyBlacklisted(eventId);
    if (alreadyBlacklisted) {
      console.log(`[Blacklist] ${eventId} déjà blacklisté`);
      return true;
    }
    
    const blacklistRef = doc(db, "users", state.currentUser.uid, "blacklistedEvents", eventId);
    await setDoc(blacklistRef, {
      eventId,
      type,
      blacklistedAt: Date.now(),
      blacklistedBy: state.currentUser.uid,
      reason,
      permanentlyDeleted: true
    });
    console.log(`[Blacklist] ${type} ${eventId} blacklisté (${reason})`);
    return true;
  } catch (err) {
    console.error('[Blacklist] Erreur ajout:', err);
    return false;
  }
}

// Vérifier si un événement est dans la blacklist permanente
async function isPermanentlyBlacklisted(eventId) {
  if (!eventId || !state.currentUser) return false;
  
  try {
    const blacklistRef = doc(db, "users", state.currentUser.uid, "blacklistedEvents", eventId);
    const snap = await getDoc(blacklistRef);
    return snap.exists();
  } catch (err) {
    console.error('[Blacklist] Erreur vérification:', err);
    return false;
  }
}

// Obtenir tous les événements blacklistés
async function getBlacklistedEvents() {
  if (!state.currentUser) return [];
  
  try {
    const colRef = collection(db, "users", state.currentUser.uid, "blacklistedEvents");
    const snap = await getDocs(colRef);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('[Blacklist] Erreur récupération:', err);
    return [];
  }
}

// Supprimer de la blacklist (restaurer)
async function removeFromBlacklist(eventId) {
  if (!eventId || !state.currentUser) return false;
  
  try {
    const blacklistRef = doc(db, "users", state.currentUser.uid, "blacklistedEvents", eventId);
    await deleteDoc(blacklistRef);
    console.log(`[Archive] ${eventId} retiré de l'archive`);
    
    // Pour les devoirs manuels, essayer de réactiver le document original
    if (eventId.startsWith('manual_')) {
      const match = eventId.match(/manual_([^_]+)_/);
      if (match && match[1]) {
        const docId = match[1];
        const docRef = doc(db, "devoirs", docId);
        
        try {
          // Vérifier si le document existe encore
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            // Réactiver le document en retirant les marqueurs de suppression
            await updateDoc(docRef, {
              manuallyDeleted: false,
              deletedAt: null,
              deletedReason: null,
              deletedBy: null
            });
            console.log(`[Archive] Document ${docId} réactivé`);
          } else {
            console.log(`[Archive] Document ${docId} n'existe plus, impossible de réactiver`);
          }
        } catch (err) {
          console.warn(`[Archive] Impossible de réactiver le document ${docId}:`, err);
        }
      }
    }
    
    return true;
  } catch (err) {
    console.error('[Archive] Erreur retrait:', err);
    return false;
  }
}

// Marquer un document comme supprimé (unifié)
async function markAsDeleted(docId, eventId = null, type = 'devoir', reason = 'manual') {
  if (!docId || !state.currentUser) return false;
  
  try {
    // Si pas d'eventId, en créer un pour les devoirs manuels
    if (!eventId) {
      eventId = `manual_${docId}_${Date.now()}`;
    }
    
    // Toujours ajouter à l'archive (blacklist) maintenant
    await addToPermanentBlacklist(eventId, type, reason);
    
    // Marquer le document comme supprimé
    await updateDoc(doc(db, "devoirs", docId), {
      manuallyDeleted: true,
      deletedAt: Date.now(),
      deletedReason: reason,
      deletedBy: state.currentUser.uid,
      eventId: eventId
    });
    
    return true;
  } catch (err) {
    console.error('[Suppression] Erreur marquage:', err);
    return false;
  }
}

// Extraire l'eventId depuis différentes sources
function extractEventId(docId, docData = null) {
  // Priorité aux données du document
  if (docData?.importedEventId) return docData.importedEventId;
  if (docData?.eventId) return docData.eventId;
  
  // Extraire depuis le nom du document
  if (docId.includes('_ext_')) return docId.split('_ext_')[1];
  if (docId.includes('_rappel_')) return docId.split('_rappel_')[1];
  
  return null;
}

// Suppression intelligente (unifiée)
async function smartDelete(docId, groupId = null, entryType = null) {
  if (!docId && !groupId) return false;
  
  try {
    if (entryType === 'rappel' || (docId && docId.includes('_rappel_'))) {
      // Suppression d'un rappel uniquement
      const reminderSnap = await fetchTaskDoc(docId);
      if (!reminderSnap) return false;
      
      const eventId = extractEventId(docId, reminderSnap.data);
      const reminderGroupId = reminderSnap.data?.groupId;
      
      // Marquer comme supprimé (garde le fantôme)
      await markAsDeleted(docId, eventId, 'rappel', 'manual');
      
      // Mettre à jour le devoir lié
      if (reminderGroupId) {
        const group = await loadGroupDocs(reminderGroupId);
        if (group.devoir) {
          await updateDoc(doc(db, "devoirs", group.devoir.id), { 
            hasRappel: false, 
            rappelDate: null 
          });
        }
      }
    } else if (groupId) {
      // Suppression d'un groupe complet
      const groupDocs = await loadGroupDocs(groupId);
      
      // Extraire l'eventId du devoir principal
      const eventId = extractEventId(
        groupDocs.devoir?.id || groupId, 
        groupDocs.devoir?.data
      );
      
      // Marquer le devoir principal comme supprimé
      if (groupDocs.devoir) {
        await markAsDeleted(groupDocs.devoir.id, eventId, groupDocs.devoir.data.type || 'devoir', 'manual');
      }
      
      // Marquer le rappel comme supprimé s'il existe
      if (groupDocs.rappel) {
        await markAsDeleted(groupDocs.rappel.id, eventId, 'rappel', 'manual');
      }
      
      // Supprimer physiquement le groupe
      await deleteGroup(groupId);
    } else {
      // Suppression d'un document unique
      const taskDoc = await fetchTaskDoc(docId);
      if (!taskDoc) return false;
      
      const eventId = extractEventId(docId, taskDoc.data);
      const type = taskDoc.data?.type || (taskDoc.data?.rappel ? 'rappel' : 'devoir');
      
      await markAsDeleted(docId, eventId, type, 'manual');
      
      // Ne plus supprimer physiquement le document pour permettre la restauration
      // await deleteDoc(doc(db, "devoirs", docId));
    }
    
    return true;
  } catch (err) {
    console.error('[SmartDelete] Erreur:', err);
    return false;
  }
}

async function createOrUpdateImportedTask(it) {
  const monthMap = {
    "janvier": 0, "février": 1, "fevrier": 1, "mars": 2, "avril": 3,
    "mai": 4, "juin": 5, "juillet": 6, "août": 7, "aout": 7,
    "septembre": 8, "octobre": 9, "novembre": 10, "décembre": 11, "decembre": 11
  };
  function parseFrenchHeadingToISO(txt) {
    if (!txt) return null;
    const parts = String(txt).replace(/\xa0/g, ' ').trim().split(/\s+/);
    if (parts.length >= 4) {
      const dayNum = Number(parts[1]);
      const monthKey = parts[2].toLowerCase();
      const yearNum = Number(parts[3]);
      const m = monthMap[monthKey];
      if (Number.isFinite(dayNum) && Number.isFinite(yearNum) && m != null) {
        const d = new Date(yearNum, m, dayNum);
        const y = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        return `${y}-${mo}-${da}`;
      }
    }
    return null;
  }
  function parseDDMMYYYY(s) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s||'').trim());
    if (!m) return null;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  }

  const eventId = String(it.eventId || '').trim();
  if (!eventId) return false;
  
  // Vérifier si l'événement est dans la blacklist permanente
  if (await isPermanentlyBlacklisted(eventId)) {
    return false;
  }
  
  // Vérifier si le devoir a été supprimé manuellement
  const existingDevoirId = `${state.currentUser.uid}_ext_${eventId}`;
  const existingDoc = await getDoc(doc(db, "devoirs", existingDevoirId));
  if (existingDoc.exists() && existingDoc.data().manuallyDeleted) {
    return false;
  }
  
  const dueISO = parseDDMMYYYY(it.modalDate) || parseFrenchHeadingToISO(it.dueHeading) || parseDDMMYYYY(it.assignedDate) || formatDate(new Date());
  
  // Double filtrage de sécurité pour les devoirs passés
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDate = new Date(dueISO);
  const timeStr = it.modalTime || it.heure;
  
  if (dueDate < today) {
    console.log(`[Import] Devoir ignoré (date passée): ${dueISO} -> ${dueDate.toDateString()}`);
    return false;
  } else if (dueDate.getTime() === today.getTime() && timeStr) {
    // Pour les devoirs du jour, vérifier l'heure
    try {
      const timeCleaned = timeStr.replace('h', ':').replace('H', ':').trim();
      if (timeCleaned.includes(':')) {
        const [hour, minute] = timeCleaned.split(':');
        const itemTime = new Date();
        itemTime.setHours(parseInt(hour), parseInt(minute), 0, 0);
        if (itemTime <= now) {
          console.log(`[Import] Devoir ignoré (heure passée aujourd'hui): ${dueISO} ${timeStr}`);
          return false;
        }
      }
    } catch (e) {
      // En cas d'erreur, on garde par prudence
    }
  }
  const parts = getDateParts(dueISO);
  const heure = ""; // Plus d'heure par défaut pour les devoirs importés
  const docId = `${state.currentUser.uid}_ext_${eventId}`;
  const ref = doc(db, 'devoirs', docId);
  const exists = await getDoc(ref);
  const rawSubject = String(it.modalSubject || it.subject || '').trim();
  const lower = (s) => String(s || '').toLowerCase();
  const contains = (s, key) => lower(s).includes(lower(key));
  let matiere = rawSubject;
  if (contains(rawSubject, 'formation scientifique')) matiere = 'Sciences';
  else if (contains(rawSubject, 'math')) matiere = 'Maths';
  else if (contains(rawSubject, 'français') || contains(rawSubject, 'francais')) matiere = 'Français';
  else if (contains(rawSubject, 'anglais')) matiere = 'Anglais';
  else if (contains(rawSubject, 'histoire')) matiere = 'Histoire';
  else if (contains(rawSubject, 'géographie') || contains(rawSubject, 'geographie')) matiere = 'Géographie';

  const baseTitle = String(it.modalTitle || it.title || it.modalDetail || '').trim();
  // Créer un blob de texte pour la détection des évaluations
  const textBlob = [it.modalSubject, it.subject, it.modalTitle, it.title, it.modalDetail]
    .filter(Boolean)
    .join(' ');
    
  // Détection plus précise des évaluations
  const isEval = /(évaluation\s+sommative|evaluation\s+sommative|contrôle|controle|interrogation|interro|cs\d|évaluation\s+écrite|evaluation\s+ecrite)/i.test(textBlob);
  
  // Utiliser le titre original sans ajouter de préfixe [Eval]
  let titrePrincipale = baseTitle.replace(/^\s*\[Eval\]\s*/i, '').trim();
  
  // Si c'est une évaluation et qu'il y a une description, on l'ajoute
  if (isEval && it.modalDetail) {
    titrePrincipale += ` - ${it.modalDetail}`;
  }

  const payload = {
    ownerUid: state.currentUser.uid,
    groupId: generateGroupId(),
    type: isEval ? 'evaluation' : 'devoir',
    rappel: false,
    hasRappel: false,
    notified: false,
    matiere,
    titre: titrePrincipale,
    date: dueISO,
    dueDate: dueISO,
    rappelDate: null,
    heure,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    timestamp: computeTimestamp(dueISO, heure),
    importedFrom: 'eel-realtime',
    importedEventId: eventId,
    labels: Array.isArray(it.labels) ? it.labels : [],
    sourceTab: it.source || 'active',
    modalTitle: it.modalTitle || '',
    modalDetail: it.modalDetail || '',
    modalDate: it.modalDate || ''
  };
  try {
    const already = exists.exists();
    if (already) {
      // Vérifier si le devoir a été supprimé automatiquement
      const existingData = exists.data();
      if (existingData.autoDeleted) {
        console.log(`[Import] Devoir supprimé automatiquement détecté, pas de réimportation: ${docId}`);
        return false;
      }
      await setDoc(ref, payload, { merge: true });
      console.log(`[Import] Updated ${docId} (${payload.matiere} — ${payload.titre})`);
    } else {
      await setDoc(ref, payload);
      console.log(`[Import] Created ${docId} (${payload.matiere} — ${payload.titre})`);
    }

    // Auto reminder for evaluations using user's default reminder settings
    if (isEval) {
      const reminderDate = computeReminderDate(dueISO, state.defaultReminder, false);
      
      // Validation pour éviter les dates invalides
      if (isNaN(reminderDate.getTime()) || !isFinite(reminderDate.getTime())) {
        console.warn('[Realtime] Date de rappel invalide, utilisation de la date d\'échéance');
        return docId; // Ne pas créer de rappel avec une date invalide
      }
      
      // Utiliser un ID stable basé sur eventId au lieu de docId
      const reminderId = `${state.currentUser.uid}_rappel_${eventId}`;
      
      // Vérifier si l'événement est dans la blacklist permanente
      if (await isPermanentlyBlacklisted(eventId)) {
        return docId;
      }
      
      // Vérifier si le rappel a été supprimé manuellement
      const existingReminderDoc = await getDoc(doc(db, 'devoirs', reminderId));
      if (existingReminderDoc.exists() && existingReminderDoc.data().manuallyDeleted) {
        return docId;
      }
      
      // Vérifier si le rappel existe déjà pour éviter de le déplacer
      const existingReminder = await getDoc(doc(db, 'devoirs', reminderId));
      if (existingReminder.exists()) {
        const reminderData = existingReminder.data();
        // Si le rappel a été supprimé automatiquement, ne pas le recréer
        if (reminderData.autoDeleted || (reminderData.timestampRappel && reminderData.timestampRappel < Date.now() - 2*60*60*1000)) {
          return docId;
        }
        console.log('[Realtime] Rappel existant trouvé, pas de modification');
        return docId;
      } else {
        // Le document n'existe plus (peut-être supprimé par cleanupPastReminders)
        console.log('[Realtime] Rappel non trouvé (peut-être supprimé), création autorisée');
      }
      
      const reminderRef = doc(db, 'devoirs', reminderId);
      const reminderDateISO = reminderDate instanceof Date && !isNaN(reminderDate.getTime()) ? reminderDate.toISOString().split('T')[0] : dueISO;
      const remPayload = {
        ownerUid: state.currentUser.uid,
        groupId: payload.groupId,
        type: 'rappel',
        rappel: true,
        hasRappel: false,
        matiere,
        titre: `[Rappel] ${payload.titre}`,
        date: reminderDateISO,
        rappelDate: reminderDateISO,
        dueDate: dueISO,
        heure,
        year: getDateParts(reminderDateISO).year,
        month: getDateParts(reminderDateISO).month,
        day: getDateParts(reminderDateISO).day,
        timestampRappel: computeTimestamp(reminderDateISO, heure),
        notified: false,
        importedFrom: 'eel-realtime',
        importedEventId: eventId,
        sourceTab: payload.sourceTab || 'active'
      };
      await setDoc(reminderRef, remPayload, { merge: true });
      await setDoc(ref, { hasRappel: true, rappelDate: reminderDateISO, groupId: payload.groupId, notified: false }, { merge: true });
    }
    return docId;
  } catch (e) {
    console.warn('realtime import create/update failed:', e);
    return false;
  }
}

function enableExternalHomeworksRealtime() {
  try { ensureAuthed(); } catch (_) { return; }
  if (typeof externalHWUnsub === "function") {
    try { externalHWUnsub(); } catch (_) {}
    externalHWUnsub = null;
  }
  const colRef = collection(db, "users", state.currentUser.uid, "externalHomeworks");
  console.log(`[Realtime] Subscribing to ${state.currentUser.uid}/externalHomeworks…`);
  externalHWUnsub = onSnapshot(colRef, async (snap) => {
    try {
      console.log(`[Realtime] Changes: ${snap.docChanges().length}`);
      const created = [];
      for (const ch of snap.docChanges()) {
        if (ch.type === "added" || ch.type === "modified") {
          const data = ch.doc.data();
          const ok = await createOrUpdateImportedTask(data);
          if (ok) created.push(ok);
        }
      }
      if (created.length) {
        console.log(`[Realtime] Created ${created.length} devoir(s) from realtime.`);
        try {
          await renderCalendar(state.currentYear, state.currentMonth);
          if (state.selectedDate) await refreshDayTasksList(state.selectedDate);
        } catch (_) {}
      }
    } catch (e) {
      console.warn('realtime onSnapshot error:', e);
    }
  });
}

function sortTasksForDisplay(tasks) {
  return tasks.slice().sort((a, b) => {
    const dateA = String(a.rappelDate || a.date || "");
    const dateB = String(b.rappelDate || b.date || "");
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const timeA = a.heure || "";
    const timeB = b.heure || "";
    if (timeA !== timeB) return timeA.localeCompare(timeB);
    const typeA = a.type || (a.rappel ? "rappel" : "devoir");
    const typeB = b.type || (b.rappel ? "rappel" : "devoir");
    return typeA.localeCompare(typeB);
  });
}

function clearDragHighlights() {
  document.querySelectorAll(".date.drop-target").forEach((cell) => {
    cell.classList.remove("drop-target");
  });
}

function resetDragContext() {
  dragContext.id = null;
  dragContext.groupId = null;
  dragContext.type = null;
  document.body.classList.remove("dragging-task");
  trashDiv?.classList.remove("over");
  clearDragHighlights();
}

/* ================== Firestore helpers ================== */
async function loadGroupDocs(groupId) {
  const result = { devoir: null, rappel: null };
  if (!groupId || !state.currentUser) return result;
  try {
    const base = collection(db, "devoirs");
    const snap = await getDocs(
      query(base, where("ownerUid", "==", state.currentUser.uid), where("groupId", "==", groupId))
    );
    const tasks = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      // Ignorer les documents supprimés manuellement
      if (data.manuallyDeleted) {
        return;
      }
      if (data.timestamp) {
        tasks.push({ id: docSnap.id, data });
      }
    });
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      // Ignorer les documents supprimés manuellement
      if (data.manuallyDeleted) {
        return;
      }
      const entry = { id: docSnap.id, data };
      const type = data.type || (data.rappel ? "rappel" : "devoir");
      if (type === "rappel") {
        result.rappel = entry;
      } else {
        result.devoir = entry;
      }
    });
  } catch (err) {
    console.warn("loadGroupDocs error:", err);
  }
  return result;
}

async function fetchTaskDoc(taskId) {
  if (!taskId) return null;
  try {
    const ref = doc(db, "devoirs", taskId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, data: snap.data() };
  } catch (err) {
    console.warn("fetchTaskDoc error:", err);
    return null;
  }
}

async function deleteGroup(groupId) {
  if (!groupId || !state.currentUser) return;
  try {
    const base = collection(db, "devoirs");
    const snap = await getDocs(
      query(base, where("ownerUid", "==", state.currentUser.uid), where("groupId", "==", groupId))
    );
    
    const deletions = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      // Supprimer physiquement seulement les documents importés automatiquement
      // Garder les documents manuels pour permettre la restauration
      if (data.importedEventId || docSnap.id.includes('_ext_') || docSnap.id.includes('_rappel_')) {
        deletions.push(deleteDoc(doc(db, "devoirs", docSnap.id)));
      }
      // Les documents manuels sont déjà marqués comme supprimés via markAsDeleted
    });
    await Promise.all(deletions);
  } catch (err) {
    console.error("deleteGroup error:", err);
  }
}

/* ================== Drag & drop handlers ================== */
function handleTaskDragStart(event) {
  const target = event.currentTarget;
  dragContext.id = target?.dataset?.id || null;
  dragContext.groupId = target?.dataset?.groupId || null;
  dragContext.type = target?.dataset?.type || null;
  if (!dragContext.id) return;
  document.body.classList.add("dragging-task");
  try {
    if (event.dataTransfer) {
      event.dataTransfer.setData("text/plain", dragContext.id);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.dropEffect = "move";
    }
  } catch (err) {
    console.warn("dataTransfer setData failed:", err);
  }
}

function handleTaskDragEnd() {
  resetDragContext();
}

function handleCalendarDragOver(event) {
  if (!dragContext.id) return;
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  event.currentTarget.classList.add("drop-target");
}

function handleCalendarDragLeave(event) {
  event.currentTarget.classList.remove("drop-target");
}

async function handleCalendarDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  const targetDate = event.currentTarget.dataset.date;
  const draggedId = dragContext.id || event.dataTransfer?.getData("text/plain");
  const draggedGroupId = dragContext.groupId;
  const draggedType = dragContext.type;
  resetDragContext();
  if (!draggedId || !targetDate) return;

  const targetDateObj = startOfDay(parseDate(targetDate));
  const today = startOfDay(new Date());
  // Plus de restriction sur les dates passées
  // if (targetDateObj < today) {
  //   alert("Impossible de placer une tache dans le passe.");
  //   return;
  // }

  try {
    const baseDoc = await fetchTaskDoc(draggedId);
    if (!baseDoc) {
      console.warn("Task not found for drop:", draggedId);
      return;
    }
    let groupId = baseDoc.data.groupId || draggedGroupId || null;
    let groupDocs = groupId ? await loadGroupDocs(groupId) : { devoir: null, rappel: null };

    const inferredType = baseDoc.data.type || (baseDoc.data.rappel ? "rappel" : "devoir");
    if (!groupDocs.devoir && inferredType !== "rappel") {
      groupDocs.devoir = baseDoc;
    }
    if (!groupDocs.rappel && inferredType === "rappel") {
      groupDocs.rappel = baseDoc;
    }

    if (!groupId) {
      groupId =
        groupDocs.devoir?.data.groupId ||
        groupDocs.rappel?.data.groupId ||
        generateGroupId();
    }

    const targetParts = getDateParts(targetDate);

    if ((draggedType || inferredType) === "rappel") {
      const reminderEntry = groupDocs.rappel || baseDoc;
      const dueEntry = groupDocs.devoir;
      const reminderData = reminderEntry.data;
      const dueData = dueEntry?.data || null;

      // Validation: uniquement si on a un devoir associé avec une date valide
      if (dueEntry && dueData) {
        const dueDateStr = dueData.dueDate || dueData.date;
        if (dueDateStr) {
          const dueDateObj = startOfDay(parseDate(dueDateStr));
          if (!isNaN(dueDateObj.getTime()) && targetDateObj > dueDateObj) {
            alert("Un rappel ne peut pas etre apres le devoir. Modifie le devoir avant de deplacer le rappel.");
            return;
          }
        }
      }

      const dueDateForPayload = dueData?.dueDate || dueData?.date || reminderData.dueDate || targetDate;
      const heure = reminderData.heure || dueData?.heure || state.defaultHour; // Garder defaultHour pour les rappels
      const payload = {
        ...reminderData,
        date: targetDate,
        rappelDate: targetDate,
        dueDate: dueDateForPayload,
        dueDate: dueData?.dueDate || dueData?.date || reminderData.dueDate || targetDate,
        year: targetParts.year,
        month: targetParts.month,
        day: targetParts.day,
        timestampRappel: computeTimestamp(targetDate, heure),
        notified: false,
        groupId,
        type: "rappel",
        rappel: true,
        heure,
        ownerUid: reminderData.ownerUid || dueData?.ownerUid || state.currentUser.uid
      };
      await updateDoc(doc(db, "devoirs", reminderEntry.id), payload);
      if (dueEntry) {
        await updateDoc(doc(db, "devoirs", dueEntry.id), {
          rappelDate: targetDate,
          hasRappel: true,
          groupId
        });
      }
    } else {
      const dueEntry = groupDocs.devoir || baseDoc;
      const reminderEntry = groupDocs.rappel;
      const dueData = dueEntry.data;
      const heure = dueData.heure || ""; // Plus d'heure par défaut pour les devoirs
      const reminderData = reminderEntry?.data || null;
      const reminderDateStr = reminderData?.rappelDate || reminderData?.date || null;
      if (reminderDateStr) {
        const reminderDateObj = startOfDay(parseDate(reminderDateStr));
        if (reminderDateObj > targetDateObj) {
          alert("Le rappel associe est apres la nouvelle date. Deplace d'abord le rappel.");
          return;
        }
      }
      const duePayload = {
        ...dueData,
        date: targetDate,
        dueDate: targetDate,
        year: targetParts.year,
        month: targetParts.month,
        day: targetParts.day,
        groupId,
        // Preserve original type (e.g., 'evaluation')
        type: dueData.type || "devoir",
        rappel: false,
        notified: false,
        hasRappel: Boolean(reminderEntry),
        rappelDate: reminderDateStr || null
      };

      if (!reminderEntry) {
        duePayload.hasRappel = false;
        duePayload.rappelDate = null;
      }

      await updateDoc(doc(db, "devoirs", dueEntry.id), duePayload);
      if (reminderEntry) {
        await updateDoc(doc(db, "devoirs", reminderEntry.id), {
          dueDate: targetDate,
          groupId,
          notified: false,
          ownerUid: reminderData.ownerUid || state.currentUser.uid
        });
      }
    }
  } catch (err) {
    console.error("Erreur lors du drop calendrier:", err);
  }

  await renderCalendar(state.currentYear, state.currentMonth);
  if (state.selectedDate) {
    await refreshDayTasksList(state.selectedDate);
  }
}

async function handleTrashDrop(event) {
  event.preventDefault();
  const droppedId = dragContext.id || event.dataTransfer?.getData("text/plain");
  const droppedGroupId = dragContext.groupId;
  const droppedType = dragContext.type;
  resetDragContext();
  if (!droppedId) return;
  
  try {
    // Utiliser le système unifié de suppression
    const success = await smartDelete(droppedId, droppedGroupId, droppedType);
    if (!success) {
      throw new Error('Échec de la suppression');
    }
    
    console.log('[Corbeille] Élément supprimé et blacklisté');
  } catch (err) {
    console.error("Erreur suppression via corbeille:", err);
    alert("Impossible de supprimer le devoir.");
  }
  
  await renderCalendar(state.currentYear, state.currentMonth);
  if (state.selectedDate) {
    await refreshDayTasksList(state.selectedDate);
  }
}

/* ================== GESTION DES BLACKLISTS (UI) ================== */

// Afficher la liste des événements archivés avec détails
async function displayBlacklist() {
  const blacklistList = document.getElementById('blacklist-list');
  if (!blacklistList) return;
  
  try {
    const blacklistedEvents = await getBlacklistedEvents();
    
    if (blacklistedEvents.length === 0) {
      blacklistList.innerHTML = '<p class="empty-state">📭 Aucun devoir dans l\'archive</p>';
      return;
    }
    
    // Récupérer les détails des devoirs pour chaque événement blacklisté
    const detailedEvents = await Promise.all(
      blacklistedEvents.map(async (event) => {
        let taskDetails = null;
        
        // Essayer de trouver le document original du devoir
        try {
          let possibleDocIds = [];
          
          // Pour les devoirs importés automatiquement
          if (event.eventId && !event.eventId.startsWith('manual_')) {
            possibleDocIds = [
              `${state.currentUser.uid}_ext_${event.eventId}`,
              `${state.currentUser.uid}_rappel_${event.eventId}`
            ];
          }
          // Pour les devoirs manuels, extraire le docId depuis l'eventId
          else if (event.eventId && event.eventId.startsWith('manual_')) {
            const match = event.eventId.match(/manual_([^_]+)_/);
            if (match && match[1]) {
              possibleDocIds = [match[1]];
            }
          }
          
          for (const docId of possibleDocIds) {
            const docSnap = await getDoc(doc(db, "devoirs", docId));
            if (docSnap.exists()) {
              taskDetails = { id: docId, ...docSnap.data() };
              break;
            }
          }
        } catch (err) {
          console.warn(`Impossible de récupérer les détails pour ${event.eventId}:`, err);
        }
        
        return {
          ...event,
          taskDetails
        };
      })
    );
    
    const html = detailedEvents.map(event => {
      const archiveDate = new Date(event.blacklistedAt).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const reasonText = {
        'manual': 'Supprimé manuellement',
        'auto': 'Suppression automatique',
        'cleanup': 'Nettoyage automatique'
      }[event.reason] || event.reason;
      
      // Utiliser les détails du devoir si disponibles, sinon l'eventId
      const title = event.taskDetails?.titre || `Devoir/Évaluation ${event.eventId}`;
      const matiere = event.taskDetails?.matiere || 'Non spécifié';
      const type = event.taskDetails?.type || event.type || 'devoir';
      const date = event.taskDetails?.date || event.taskDetails?.dueDate || 'Date inconnue';
      const heure = event.taskDetails?.heure || '';
      
      // Déterminer si c'est un devoir manuel ou importé
      const isManual = event.eventId && event.eventId.startsWith('manual_');
      const sourceText = isManual ? '📝 Ajouté manuellement' : '🔄 Importé automatiquement';
      
      const typeIcon = type === 'evaluation' ? '📝' : type === 'rappel' ? '⏰' : '📚';
      
      return `
        <div class="blacklist-item" data-event-id="${event.eventId}">
          <div class="blacklist-content">
            <div class="blacklist-header">
              <span class="blacklist-type">${typeIcon} ${matiere}</span>
              <span class="blacklist-source">${sourceText}</span>
            </div>
            <div class="blacklist-title">${title}</div>
            ${date ? `<div class="blacklist-date">📅 ${formatDateForDisplay(date)}${heure ? ` à ${heure}` : ''}</div>` : ''}
            <div class="blacklist-archived">🗄️ Archivé le: ${archiveDate}</div>
          </div>
          <div class="blacklist-actions">
            <button class="restore-btn" data-event-id="${event.eventId}" title="Restaurer ce devoir">
              ♻️ Restaurer
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    blacklistList.innerHTML = html;
    
    // Ajouter les écouteurs d'événements pour la restauration
    blacklistList.querySelectorAll('.restore-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const eventId = e.target.dataset.eventId;
        console.log(`[Archive] Tentative de restauration pour: ${eventId}`);
        
        if (confirm('♻️ Restaurer ce devoir ?\n\nIl pourra réapparaître dans ton calendrier lors des prochains imports.')) {
          const success = await removeFromBlacklist(eventId);
          console.log(`[Archive] Résultat restauration: ${success}`);
          
          if (success) {
            showNotification('✅ Devoir restauré avec succès', 'success');
            console.log('[Archive] Début rafraîchissement archive...');
            await displayBlacklist();
            console.log('[Archive] Archive rafraîchie, début rafraîchissement calendrier...');
            // Rafraîchir le calendrier pour voir les changements
            await renderCalendar(state.currentYear, state.currentMonth);
            console.log('[Archive] Calendrier rafraîchi');
          } else {
            showNotification('❌ Erreur lors de la restauration', 'error');
          }
        }
      });
    });
    
  } catch (err) {
    console.error('[Archive UI] Erreur affichage:', err);
    blacklistList.innerHTML = '<p class="error">❌ Erreur lors du chargement de l\'archive</p>';
  }
}

// Fonction utilitaire pour formater les dates
function formatDateForDisplay(dateStr) {
  if (!dateStr) return 'Date inconnue';
  const date = parseDate(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// Vider toute l'archive
async function clearBlacklist() {
  if (!confirm('⚠️ ATTENTION: Cette action supprimera DÉFINITIVEMENT tous les devoirs archivés.\nCette action est IRRÉVERSIBLE !\n\nConfirmer la suppression définitive de toute l\'archive ?')) {
    return;
  }
  
  try {
    const blacklistedEvents = await getBlacklistedEvents();
    
    // Supprimer définitivement les documents de devoirs correspondants
    for (const event of blacklistedEvents) {
      try {
        // Pour les devoirs manuels (commencent par "manual_")
        if (event.eventId.startsWith('manual_')) {
          const match = event.eventId.match(/manual_([^_]+)_/);
          if (match && match[1]) {
            const docId = match[1];
            await deleteDoc(doc(db, "devoirs", docId));
            console.log(`[Archive] Document ${docId} supprimé définitivement`);
          }
        } 
        // Pour les devoirs importés (contiennent "_ext_")
        else {
          const docId = `${state.currentUser.uid}_ext_${event.eventId}`;
          await deleteDoc(doc(db, "devoirs", docId));
          console.log(`[Archive] Document importé ${docId} supprimé définitivement`);
          
          // Supprimer aussi le rappel associé s'il existe
          const reminderId = `${state.currentUser.uid}_rappel_${event.eventId}`;
          try {
            await deleteDoc(doc(db, "devoirs", reminderId));
            console.log(`[Archive] Rappel ${reminderId} supprimé définitivement`);
          } catch (e) {
            // Le rappel n'existe peut-être pas, c'est normal
          }
        }
      } catch (err) {
        console.warn(`[Archive] Erreur suppression document pour ${event.eventId}:`, err);
      }
    }
    
    // Vider l'archive après la suppression des documents
    const deletions = blacklistedEvents.map(event => removeFromBlacklist(event.eventId));
    await Promise.all(deletions);
    
    await displayBlacklist();
    showNotification('🗑️ Archive vidée avec succès - Tous les devoirs ont été supprimés définitivement', 'success');
  } catch (err) {
    console.error('[Archive] Erreur vidage:', err);
    showNotification('❌ Erreur lors du vidage de l\'archive', 'error');
  }
}

// Gestion des onglets dans les paramètres
function initSettingsTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      
      // Désactiver tous les onglets
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      // Activer l'onglet sélectionné
      btn.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');
      
      // Charger la blacklist si nécessaire
      if (targetTab === 'blacklist') {
        displayBlacklist();
      }
    });
  });
}
// Initialiser les écouteurs d'événements pour la blacklist
document.getElementById('clear-blacklist-btn')?.addEventListener('click', clearBlacklist);

// Initialiser les onglets des paramètres
initSettingsTabs();

// Déconnexion
document.getElementById('params-logout-btn')?.addEventListener('click', async () => {
  try {
    await signOut(auth);
    window.location.reload();
  } catch (err) {
    console.error('Erreur lors de la déconnexion:', err);
    alert('Erreur lors de la déconnexion');
  }
});

/* ================== Calendar render ================== */
async function renderCalendar(year, month) {
  try {
    ensureAuthed();
  } catch (err) {
    calendar.innerHTML = "<div class='not-logged'>Connecte-toi pour voir le calendrier</div>";
    if (monthYear) monthYear.textContent = "";
    return;
  }

  state.currentYear = year;
  state.currentMonth = month;
  calendar.innerHTML = "";

  if (monthYear) {
    monthYear.textContent = `${MONTH_NAMES[month]} ${year}`;
  }

  DAY_NAMES.forEach((name) => {
    const el = document.createElement("div");
    el.className = "day-name";
    el.textContent = name;
    calendar.appendChild(el);
  });

  const firstDay = new Date(year, month, 1);
  const startDay = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const tasksByDay = {};
  try {
    console.log(`[Calendar] Chargement événements pour ${year}/${month + 1}`);
    const snap = await getDocs(
      query(
        collection(db, "devoirs"),
        where("ownerUid", "==", state.currentUser.uid),
        where("year", "==", year),
        where("month", "==", month)
      )
    );
    
    const allEvents = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      allEvents.push({ id: docSnap.id, ...data });
    });
    
    console.log(`[Calendar] ${allEvents.length} événements trouvés au total`);
    
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      // Ignorer les documents supprimés manuellement
      if (data.manuallyDeleted) {
        console.log(`[Calendar] Événement ignoré (supprimé): ${docSnap.id} - ${data.titre}`);
        return;
      }
      const day = Number(data.day);
      if (!Number.isFinite(day)) return;
      if (!tasksByDay[day]) tasksByDay[day] = [];
      tasksByDay[day].push({ id: docSnap.id, ...data });
      console.log(`[Calendar] Événement ajouté jour ${day}: ${docSnap.id} - ${data.titre}`);
    });
    
    console.log(`[Calendar] ${Object.keys(tasksByDay).length} jours avec des événements`);
  } catch (err) {
    console.error("Erreur chargement devoirs du mois:", err);
  }

  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement("div");
    empty.className = "empty";
    calendar.appendChild(empty);
  }

  const today = startOfDay(new Date());

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "date";
    const dateObj = new Date(year, month, day);
    const dateStr = formatDate(dateObj);
    cell.dataset.date = dateStr;

    const header = document.createElement("div");
    header.className = "date-header";

    const numberEl = document.createElement("div");
    numberEl.className = "num";
    numberEl.textContent = String(day);
    header.appendChild(numberEl);

    if (startOfDay(dateObj).getTime() === today.getTime()) {
      cell.classList.add("today");
      const lbl = document.createElement("span");
      lbl.className = "today-label";
      lbl.textContent = "Aujourd'hui";
      header.appendChild(lbl);
    }

    cell.appendChild(header);

    const dayTasks = tasksByDay[day] ? sortTasksForDisplay(tasksByDay[day]) : [];
    if (dayTasks.length) {
      cell.classList.add("has-tasks");
      const container = document.createElement("div");
      container.className = "tasks";

      dayTasks.slice(0, 3).forEach((task) => {
        const entryType = task.type || (task.rappel ? "rappel" : "devoir");
        const el = document.createElement("div");
        el.className = "task";
        if (entryType === "rappel") el.classList.add("rappel");
        if (entryType === "evaluation") el.classList.add("evaluation");
        el.textContent = buildTaskLabel(task);
        el.dataset.id = task.id;
        el.dataset.groupId = task.groupId || task.id;
        el.dataset.type = entryType;
        el.draggable = true;
        el.addEventListener("dragstart", handleTaskDragStart);
        el.addEventListener("dragend", handleTaskDragEnd);
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          openModal(task.date || dateStr, task.id, task);
        });
        container.appendChild(el);
      });

      if (dayTasks.length > 3) {
        const more = document.createElement("div");
        more.className = "task more";
        more.textContent = `+${dayTasks.length - 3} autres`;
        container.appendChild(more);
      }

      cell.appendChild(container);
    }

    cell.addEventListener("dragenter", handleCalendarDragOver);
    cell.addEventListener("dragover", handleCalendarDragOver);
    cell.addEventListener("dragleave", handleCalendarDragLeave);
    cell.addEventListener("drop", handleCalendarDrop);
    cell.addEventListener("click", () => openDayTasksModal(dateStr));

    calendar.appendChild(cell);
  }
}

/* ================== Day tasks modal ================== */
function openDayTasksModal(dateStr) {
  console.log("openDayTasksModal appelée avec dateStr:", dateStr);
  
  try {
    ensureAuthed();
    console.log("Authentification vérifiée");
  } catch (err) {
    console.error("Erreur d'authentification:", err);
    if (calendar) calendar.innerHTML = "<div class='not-logged'>Connecte-toi pour voir le calendrier</div>";
    return;
  }
  
  // Vérifier que les éléments DOM existent
  console.log("Vérification des éléments DOM:");
  console.log("- dayTasksBg:", !!dayTasksBg);
  console.log("- dayTasksTitle:", !!dayTasksTitle);
  console.log("- dayTasksList:", !!dayTasksList);
  
  if (!dayTasksBg) {
    console.error("L'élément dayTasks-bg n'existe pas dans le DOM");
    return;
  }
  
  if (modalBg) modalBg.style.display = "none";
  dayTasksBg.style.display = "flex";
  console.log("Modal dayTasks affichée");
  
  if (dayTasksTitle) {
    dayTasksTitle.textContent = `Devoirs du ${dateStr}`;
    console.log("Titre mis à jour:", `Devoirs du ${dateStr}`);
  }
  
  if (dayTasksList) {
    dayTasksList.innerHTML = "";
    console.log("Liste vidée");
  } else {
    console.error("L'élément dayTasks-list n'existe pas dans le DOM");
    return;
  }
  
  state.selectedDate = dateStr;
  console.log("Date sélectionnée:", dateStr);
  
  try {
    refreshDayTasksList(dateStr);
    console.log("refreshDayTasksList appelée");
  } catch (err) {
    console.error("Erreur lors de l'appel à refreshDayTasksList:", err);
  }
}

if (dayTasksCloseBtn) {
  dayTasksCloseBtn.addEventListener("click", () => {
    if (dayTasksBg) dayTasksBg.style.display = "none";
  });
}

if (dayTasksAddBtn) {
  dayTasksAddBtn.addEventListener("click", () => {
    if (dayTasksBg) dayTasksBg.style.display = "none";
    openModal(state.selectedDate);
  });
}

async function refreshDayTasksList(dateStr) {
  if (!state.currentUser) {
    return;
  }
  
  if (!dayTasksList) {
    return;
  }
  
  try {
    const base = collection(db, "devoirs");
    // Récupérer tous les documents qui pourraient correspondre à cette date
    const [byDateSnap, byReminderSnap, byDueDateSnap] = await Promise.all([
      getDocs(query(base, where("ownerUid", "==", state.currentUser.uid), where("date", "==", dateStr))),
      getDocs(query(base, where("ownerUid", "==", state.currentUser.uid), where("rappelDate", "==", dateStr))),
      getDocs(query(base, where("ownerUid", "==", state.currentUser.uid), where("dueDate", "==", dateStr)))
    ]);

    const map = new Map();
    // Combiner tous les résultats sans doublons
    [byDateSnap, byReminderSnap, byDueDateSnap].forEach(snap => {
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        // Ignorer les documents supprimés manuellement
        if (data.manuallyDeleted) {
          return;
        }
        map.set(docSnap.id, data);
      });
    });

    const entries = sortTasksForDisplay(
      Array.from(map.entries()).map(([id, data]) => ({ id, ...data }))
    );

    console.log("Entrées triées:", entries.length);

    // Filtrage simple : afficher toutes les tâches pour la date sélectionnée
    const filteredEntries = entries.filter((task) => {
      // Pour un rappel, utiliser sa date (rappelDate)
      // Pour un devoir normal, utiliser sa date (date)
      const displayDate = (task.type === "rappel" || task.rappel) ? 
        (task.rappelDate || task.date) : 
        (task.date || task.rappelDate);
      
      // Convertir la date en chaîne pour comparaison
      const displayDateStr = formatDate(startOfDay(parseDate(displayDate)));
      
      // Afficher seulement si la date d'affichage correspond à la date sélectionnée
      return displayDateStr === dateStr;
    });

    console.log("Entrées filtrées:", filteredEntries.length);

    dayTasksList.innerHTML = "";
    
    // Ajouter un compteur si trop de tâches
    if (filteredEntries.length > 5) {
      const counter = document.createElement("div");
      counter.className = "tasks-counter";
      counter.textContent = `${filteredEntries.length} devoirs ce jour`;
      counter.style.cssText = "background: linear-gradient(135deg, #2a3f5f, #1e3a5f); color: white; padding: 10px 16px; border-radius: 10px; margin-bottom: 12px; text-align: center; font-size: 14px; font-weight: 500; box-shadow: 0 2px 8px rgba(0,0,0,0.3);";
      dayTasksList.appendChild(counter);
    }
    
    console.log("Début de l'affichage des", filteredEntries.length, "tâches");
    
    filteredEntries.forEach((task, index) => {
      console.log(`Tâche ${index}:`, task);
      const div = document.createElement("div");
      div.className = "day-task";
      const entryType = task.type || (task.rappel ? "rappel" : "devoir");
      if (entryType === "rappel") div.classList.add("rappel");
      if (entryType === "evaluation") div.classList.add("evaluation");
      const label = buildTaskLabel(task);
      console.log(`Label pour tâche ${index}:`, label);
      div.textContent = label;
      div.dataset.id = task.id;
      div.dataset.groupId = task.groupId || task.id;
      div.dataset.type = entryType;
      div.draggable = true;
      div.addEventListener("dragstart", handleTaskDragStart);
      div.addEventListener("dragend", handleTaskDragEnd);
      div.addEventListener("dblclick", () => {
        if (dayTasksBg) dayTasksBg.style.display = "none";
        openModal(task.date || dateStr, task.id, task);
      });
      dayTasksList.appendChild(div);
    });
    
    console.log("Affichage des tâches terminé");
    
    // Ajouter un défilement si trop de tâches
    if (filteredEntries.length > 6) {
      dayTasksList.style.maxHeight = "70vh";
      dayTasksList.style.overflowY = "auto";
      dayTasksList.style.paddingRight = "10px";
      dayTasksList.style.scrollbarWidth = "thin";
      dayTasksList.style.scrollbarColor = "#4da6ff #1a1a2e";
    } else {
      dayTasksList.style.maxHeight = "";
      dayTasksList.style.overflowY = "";
      dayTasksList.style.paddingRight = "";
    }
  } catch (err) {
    dayTasksList.innerHTML = `<div style='color: #ff6b6b; padding: 10px;'>Erreur lors du chargement des devoirs</div>`;
  }
}

/* ================== Modal create/edit ================== */
async function openModal(dateStr, docId = null, data = null) {
  try {
    ensureAuthed();
  } catch (err) {
    alert("Connecte-toi d'abord.");
    return;
  }

  state.selectedDate = dateStr;
  state.editingDocId = docId || null;
  state.editingGroupId = data?.groupId || null;
  state.editingEntryType = (data?.type || (data?.rappel ? "rappel" : (data ? "devoir" : null)));
  state.editingGroupDocs = null;
  state.preservedReminderOffset = null;
  state.preservedReminderDate = null;
  state.preservedReminderTime = null;

  if (modalBg) modalBg.style.display = "flex";
  if (modalTitle) modalTitle.textContent = docId ? "Editer un devoir" : "Ajouter un devoir";

  let dueData = data || null;
  let reminderData = null;

  if (state.editingGroupId) {
    state.editingGroupDocs = await loadGroupDocs(state.editingGroupId);
    if (state.editingGroupDocs.devoir) {
      dueData = {
        ...state.editingGroupDocs.devoir.data,
        id: state.editingGroupDocs.devoir.id
      };
      state.editingDocId = state.editingGroupDocs.devoir.id;
    }
    if (state.editingGroupDocs.rappel) {
      reminderData = state.editingGroupDocs.rappel.data;
    }
  } else if (docId && (!data || !data.groupId)) {
    const fetched = await fetchTaskDoc(docId);
    if (fetched) {
      const fetchedData = fetched.data;
      if (fetchedData.groupId) {
        state.editingGroupId = fetchedData.groupId;
        state.editingGroupDocs = await loadGroupDocs(state.editingGroupId);
        if (state.editingGroupDocs.devoir) {
          dueData = {
            ...state.editingGroupDocs.devoir.data,
            id: state.editingGroupDocs.devoir.id
          };
          state.editingDocId = state.editingGroupDocs.devoir.id;
        } else {
          dueData = fetchedData;
        }
        reminderData = state.editingGroupDocs.rappel?.data || null;
      } else {
        dueData = fetchedData;
      }
    }
  }

  const dueDateStr =
    dueData?.dueDate || dueData?.date || state.selectedDate || formatDate(new Date());
  const heureStr = dueData?.heure || ""; // Pas d'heure par défaut pour les devoirs

  if (matiereInput) matiereInput.value = dueData?.matiere || "";
  if (titreInput) titreInput.value = dueData?.titre || "";
  if (dateInput) dateInput.value = dueDateStr;
  // if (heureInput) heureInput.value = heureStr; // Supprimé - plus dans le HTML
  if (typeSelect) {
    const dtype = (dueData?.type === "evaluation") ? "evaluation" : "devoir";
    typeSelect.value = dtype;
  }

  let hasReminder = Boolean(
    reminderData || dueData?.hasRappel || dueData?.rappel
  );
  if (!dueData && !reminderData && !state.editingDocId && !state.editingGroupId) {
    hasReminder = true;
  }
  if (rappelCheckbox) rappelCheckbox.checked = hasReminder;

  // Initialiser l'heure du rappel pour les nouveaux devoirs
  if (!dueData && !reminderData && rappelTimeInput) {
    // Utiliser l'heure par défaut depuis Firebase ou l'état local
    rappelTimeInput.value = state.currentUserDoc?.defaultHour || state.defaultHour || "18:00";
  }

  if (hasReminder) {
    const dueBase = dueData?.dueDate || dueData?.date || dueDateStr;
    const reminderDate = reminderData?.rappelDate || reminderData?.date || dueData?.rappelDate;
    if (dueBase && reminderDate) {
      state.preservedReminderOffset = diffInDays(dueBase, reminderDate);
      state.preservedReminderDate = reminderDate;
      state.preservedReminderTime = reminderData?.heure || heureStr;
      
      // Mettre à jour le champ heure du rappel
      if (rappelTimeInput) {
        rappelTimeInput.value = state.preservedReminderTime;
      }
      
      // Vérifier si la date du rappel correspond à un offset standard
      const offset = diffInDays(dueBase, reminderDate);
      const standardOffsets = [0, 1, 2, 3, 7];
      
      if (standardOffsets.includes(offset) && rappelOffsetInput) {
        // Utiliser l'offset standard
        rappelOffsetInput.value = offset.toString();
        customDateContainer.style.display = "none";
      } else {
        // Utiliser la date personnalisée
        rappelOffsetInput.value = "custom";
        customDateContainer.style.display = "block";
        if (rappelDateInput) {
          rappelDateInput.value = formatDate(parseDate(reminderDate));
        }
      }
    }
  } else {
    // Masquer le champ de date personnalisé si pas de rappel
    customDateContainer.style.display = "none";
    // Réinitialiser l'heure du rappel à la valeur par défaut
    if (rappelTimeInput) {
      if (state.currentUserDoc?.defaultHour) {
        rappelTimeInput.value = state.currentUserDoc.defaultHour;
      } else {
        rappelTimeInput.value = "";
      }
    }
  }

  if (deleteBtn) {
    deleteBtn.style.display = docId || state.editingGroupId ? "inline-block" : "none";
  }

  try {
    matiereInput?.focus();
  } catch (_) {}
}

function closeModal() {
  if (modalBg) modalBg.style.display = "none";
  state.editingDocId = null;
  state.editingGroupId = null;
  state.editingGroupDocs = null;
  state.preservedReminderOffset = null;
  state.preservedReminderDate = null;
  state.preservedReminderTime = null;
  try {
    taskForm?.reset();
    // Masquer le champ de date personnalisé et réinitialiser le select
    customDateContainer.style.display = "none";
    if (rappelOffsetInput) {
      rappelOffsetInput.value = "1"; // Valeur par défaut
    }
  } catch (_) {}
  if (deleteBtn) deleteBtn.style.display = "none";
}

cancelBtn?.addEventListener("click", () => closeModal());

deleteBtn?.addEventListener("click", async () => {
  try {
    ensureAuthed();
  } catch (err) {
    return;
  }
  
  try {
    // Utiliser le système unifié de suppression
    const success = await smartDelete(state.editingDocId, state.editingGroupId, state.editingEntryType);
    if (!success) {
      throw new Error('Échec de la suppression');
    }
    
    console.log('[Modal] Élément supprimé et blacklisté');
    closeModal();
    await renderCalendar(state.currentYear, state.currentMonth);
    if (state.selectedDate) {
      await refreshDayTasksList(state.selectedDate);
    }
  } catch (err) {
    console.error("Erreur suppression devoir:", err);
    alert("Impossible de supprimer le devoir.");
  }
});

taskForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await handleTaskFormSubmit();
});

// Gérer l'affichage du champ de date personnalisé
rappelOffsetInput?.addEventListener("change", () => {
  if (rappelOffsetInput.value === "custom") {
    customDateContainer.style.display = "block";
    // Pré-remplir avec la date du devoir par défaut
    if (dateInput?.value && rappelDateInput) {
      rappelDateInput.value = dateInput.value;
    }
  } else {
    customDateContainer.style.display = "none";
  }
});

// Ajouter un écouteur de clic direct sur le bouton pour mobile (évite les double-clics)
const taskSubmitBtn = document.querySelector('#task-form button[type="submit"]');
if (taskSubmitBtn) {
  taskSubmitBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    await handleTaskFormSubmit();
  });
}

async function handleTaskFormSubmit() {
  try {
    ensureAuthed();
  } catch (err) {
    alert("Connecte-toi d'abord.");
    return;
  }

  const matiere = matiereInput?.value.trim();
  const titre = titreInput?.value.trim();
  const dateVal = dateInput?.value;
  const heureVal = ""; // Plus de champ heure pour les devoirs
  const wantReminder = Boolean(rappelCheckbox?.checked);
  const selectedType = typeSelect ? String(typeSelect.value || "devoir") : "devoir";

  if (!matiere || !titre || !dateVal) {
    alert("Remplis tous les champs.");
    return;
  }

  // Plus de restriction sur les dates passées
  // if (isBeforeToday(dateVal)) {
  //   alert("Impossible de creer ou deplacer un devoir dans le passe.");
  //   return;
  // }

  let groupId = state.editingGroupId;
  let groupDocs = state.editingGroupDocs;

  if (!groupId && state.editingDocId) {
    const fetched = await fetchTaskDoc(state.editingDocId);
    if (fetched?.data?.groupId) {
      groupId = fetched.data.groupId;
      groupDocs = await loadGroupDocs(groupId);
    }
  }

  if (!groupId) {
    groupId = generateGroupId();
  }
  if (!groupDocs) {
    groupDocs = await loadGroupDocs(groupId);
  }

  const dueEntry = groupDocs.devoir;
  const reminderEntry = groupDocs.rappel;

  const baseCommon = {
    matiere,
    titre,
    heure: heureVal,
    ownerUid: state.currentUser.uid
  };

  const dueParts = getDateParts(dateVal);
  const duePayload = {
    ...baseCommon,
    date: dateVal,
    dueDate: dateVal,
    year: dueParts.year,
    month: dueParts.month,
    day: dueParts.day,
    groupId,
    type: selectedType === "evaluation" ? "evaluation" : "devoir",
    rappel: false,
    hasRappel: wantReminder,
    rappelDate: null,
    notified: false
  };

  let reminderPayload = null;

  if (wantReminder) {
    let offset = state.preservedReminderOffset;
    let reminderDate;
    
    // Vérifier si l'utilisateur a choisi une date personnalisée
    if (rappelOffsetInput?.value === "custom" && rappelDateInput?.value) {
      // Utiliser la date personnalisée
      reminderDate = parseDate(rappelDateInput.value);
    } else {
      // Utiliser la logique existante avec les jours avant
      // Pour une nouvelle tâche, utiliser la valeur du formulaire
      if (!Number.isFinite(offset) && rappelOffsetInput) {
        offset = Number(rappelOffsetInput.value) || 0;
      }
      // Ne pas forcer la date d'aujourd'hui par défaut
      const clamp = false;
      if (!Number.isFinite(offset)) {
        offset = Number(state.defaultReminder) || 0;
      }
      reminderDate = computeReminderDate(dateVal, offset, clamp);
    }
    
    let reminderParts = getDateParts(reminderDate);
    // Utiliser la valeur du champ rappel-time si disponible, sinon la valeur préservée ou l'heure du devoir
    const reminderTime = rappelTimeInput?.value || state.preservedReminderTime || heureVal;
    
    // S'assurer que le rappel n'est pas après la date d'échéance
    if (startOfDay(parseDate(reminderDate)) > startOfDay(parseDate(dateVal))) {
      reminderDate = dateVal;
      reminderParts = getDateParts(reminderDate);
    }
    
    reminderPayload = {
      ...baseCommon,
      date: reminderDate,
      rappelDate: reminderDate,
      dueDate: dateVal,
      year: reminderParts.year,
      month: reminderParts.month,
      day: reminderParts.day,
      timestampRappel: computeTimestamp(reminderDate, reminderTime),
      groupId,
      type: "rappel",
      rappel: true,
      notified: false,
      heure: reminderTime
    };
    // Le devoir principal garde sa date originale mais a une rappelDate
    duePayload.rappelDate = reminderDate;
  }

  try {
    let dueId = dueEntry?.id || state.editingDocId;
    if (dueId) {
      await updateDoc(doc(db, "devoirs", dueId), duePayload);
    } else {
      const added = await addDoc(collection(db, "devoirs"), duePayload);
      dueId = added.id;
    }

    if (wantReminder && reminderPayload) {
      console.log("Création/mise à jour du rappel:", reminderPayload);
      if (reminderEntry) {
        console.log("Mise à jour du rappel existant:", reminderEntry.id);
        await updateDoc(doc(db, "devoirs", reminderEntry.id), reminderPayload);
      } else {
        console.log("Création d'un nouveau rappel");
        const newReminder = await addDoc(collection(db, "devoirs"), reminderPayload);
        console.log("Nouveau rappel créé avec ID:", newReminder.id);
      }
    } else if (reminderEntry) {
      console.log("Suppression du rappel:", reminderEntry.id);
      
      // Extraire l'eventId du nom du document pour les rappels
      let eventId = reminderEntry.data?.importedEventId;
      if (!eventId && reminderEntry.id.includes('_rappel_')) {
        eventId = reminderEntry.id.split('_rappel_')[1];
      }
      
      // Ajouter à la blacklist permanente avant suppression
      if (eventId) {
        await addToPermanentBlacklist(eventId, 'rappel');
      }
      
      // Marquer comme supprimé manuellement mais garder le document fantôme
      await updateDoc(doc(db, "devoirs", reminderEntry.id), { 
        manuallyDeleted: true, 
        deletedAt: Date.now(),
        // Garder les infos essentielles pour la détection
        eventId: eventId || reminderEntry.data?.eventId || '',
        ownerUid: reminderEntry.data?.ownerUid || state.currentUser.uid
      });
      console.log('[Form] Rappel marqué comme supprimé manuellement (document fantôme):', reminderEntry.id);
      // Pas de deleteDoc pour garder le fantôme
    }

    closeModal();
    await renderCalendar(state.currentYear, state.currentMonth);
    // Ajouter un petit délai pour la synchronisation Firestore
    setTimeout(async () => {
      if (state.selectedDate) {
        console.log("Rafraîchissement forcé de la liste pour:", state.selectedDate);
        await refreshDayTasksList(state.selectedDate);
      }
    }, 500);
  } catch (err) {
    console.error("Erreur sauvegarde devoir:", err);
    alert("Erreur en sauvegardant le devoir.");
  }
}

/* ================== Navigation ================== */
prevMonthBtn?.addEventListener("click", () => {
  let month = (state.currentMonth ?? new Date().getMonth()) - 1;
  let year = state.currentYear ?? new Date().getFullYear();
  if (month < 0) {
    month = 11;
    year -= 1;
  }
  renderCalendar(year, month);
});

nextMonthBtn?.addEventListener("click", () => {
  let month = (state.currentMonth ?? new Date().getMonth()) + 1;
  let year = state.currentYear ?? new Date().getFullYear();
  if (month > 11) {
    month = 0;
    year += 1;
  }
  renderCalendar(year, month);
});

let touchStartX = 0;
let touchEndX = 0;
let swipeEnabled = true;
let disableSwipeTemporarily = false;

document.addEventListener(
  "touchstart",
  (event) => {
    if (event.target.closest(".day-task") || event.target.closest(".task")) {
      disableSwipeTemporarily = true;
      return;
    }
    touchStartX = event.changedTouches[0].screenX;
  },
  false
);

document.addEventListener(
  "touchend",
  (event) => {
    touchEndX = event.changedTouches[0].screenX;
    handleSwipe();
  },
  false
);

function handleSwipe() {
  if (!swipeEnabled) return;
  if (disableSwipeTemporarily) {
    disableSwipeTemporarily = false;
    return;
  }
  const distance = touchEndX - touchStartX;
  const threshold = window.innerWidth / 4;
  if (distance > threshold) {
    let month = (state.currentMonth ?? new Date().getMonth()) - 1;
    let year = state.currentYear ?? new Date().getFullYear();
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    renderCalendar(year, month);
    lockSwipe();
  } else if (distance < -threshold) {
    let month = (state.currentMonth ?? new Date().getMonth()) + 1;
    let year = state.currentYear ?? new Date().getFullYear();
    if (month > 11) {
      month = 0;
      year += 1;
    }
    renderCalendar(year, month);
    lockSwipe();
  }
}

function lockSwipe() {
  swipeEnabled = false;
  setTimeout(() => {
    swipeEnabled = true;
    disableSwipeTemporarily = false;
  }, 500);
}

settingsBtn?.addEventListener("click", () => {
  openParams().catch(err => console.error("Erreur ouverture paramètres:", err));
});

/* ================== Modal Hours Update ================== */
function updateModalHoursIfOpen() {
  // Si le modal est ouvert et que c'est un nouveau devoir, mettre à jour seulement l'heure du rappel
  if (modalBg && modalBg.style.display === "flex" && !state.editingDocId && !state.editingGroupId) {
    // Ne pas mettre d'heure par défaut pour le devoir (champ supprimé)
    if (rappelTimeInput && !rappelTimeInput.value) {
      rappelTimeInput.value = state.defaultHour || "18:00";
    }
  }
}

/* ================== Silent Settings Load ================== */
async function loadSettingsSilently() {
  if (!state.currentUser) {
    console.log("🔇 Pas d'utilisateur connecté, skip chargement silencieux");
    return;
  }
  
  try {
    console.log("🔇 Chargement silencieux des paramètres...");
    await loadUserSettingsOrAsk();
    console.log("🔇 ✅ Paramètres chargés silencieusement:", { 
      defaultHour: state.defaultHour,
      defaultReminder: state.defaultReminder 
    });
  } catch (err) {
    console.warn("🔇 Erreur chargement silencieux:", err);
  }
}

/* ================== Settings ================== */
async function openParams() {
  if (!state.currentUser) {
    alert("Connecte-toi d'abord.");
    return;
  }
  
  console.log("openParams appelé - rechargement forcé des données");
  
  // Toujours recharger les données pour avoir les dernières valeurs
  try {
    await loadUserSettingsOrAsk();
    console.log("🔥 Données rechargées avec succès dans openParams");
  } catch (err) {
    console.warn("Erreur lors du rechargement des paramètres:", err);
  }
  
  if (paramsBg) {
    // Charger les valeurs depuis le stockage local (uniquement pour identifiants) et depuis Firestore (pour paramètres)
    const savedUser = localStorage.getItem('savedUser');
    const savedPass = localStorage.getItem('savedPass');
    
    if (userIdInput) userIdInput.value = savedUser || state.currentUserDoc?.ecoleUser || "";
    if (defaultReminderInput) defaultReminderInput.value = state.currentUserDoc?.defaultReminder?.toString() || "1";
    if (defaultHourInput) defaultHourInput.value = state.currentUserDoc?.defaultHour || "18:00";
    if (userPassInput) userPassInput.value = savedPass || state.currentUserDoc?.ecolePass || "";
    
    // Charger l'option de forçage des notifications desktop
    const forceDesktopCheckbox = document.getElementById('force-desktop-notifications');
    if (forceDesktopCheckbox) {
      forceDesktopCheckbox.checked = state.currentUserDoc?.forceDesktopNotifications || false;
    }
    
    console.log("Valeurs affichées dans les paramètres:", {
      defaultReminder: defaultReminderInput?.value,
      defaultHour: defaultHourInput?.value,
      fromState: state.currentUserDoc?.defaultHour,
      stateDefault: state.defaultHour
    });
    
    // Mettre à jour l'état de la case à cocher d'import automatique
    const autoImportCheckbox = document.getElementById('autoImport');
    if (autoImportCheckbox) {
      autoImportCheckbox.checked = state.currentUserDoc?.autoImport || false;
    }
    // Charger la config du thème dans le formulaire de personnalisation
    loadConfigToForm(themeEngine.getConfig());
    updateThemePreview();
    
    paramsBg.style.display = "flex";
  }
}

paramsCancelBtn?.addEventListener("click", () => {
  if (paramsBg) paramsBg.style.display = "none";
});

paramsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await handleParamsFormSubmit();
});

// Ajouter un écouteur de clic direct sur le bouton pour mobile
const paramsSubmitBtn = document.querySelector('#params-form button[type="submit"]');
if (paramsSubmitBtn) {
  paramsSubmitBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    await handleParamsFormSubmit();
  });
}

async function handleParamsFormSubmit() {
  try {
    ensureAuthed();
  } catch (err) {
    alert("Connecte-toi d'abord.");
    return;
  }

  const ecoleUser = userIdInput?.value.trim() || '';
  const ecolePassPlain = userPassInput?.value.trim() || '';
  const reminderVal = parseInt(defaultReminderInput?.value, 10) || 1;
  const hourVal = sanitizeHour(defaultHourInput?.value);
  const forceDesktopNotifications = document.getElementById('force-desktop-notifications')?.checked || false;
  
  // Sauvegarder les identifiants dans le stockage local
  if (ecoleUser) localStorage.setItem('savedUser', ecoleUser);
  if (ecolePassPlain) localStorage.setItem('savedPass', ecolePassPlain);
  
  if (Number.isNaN(reminderVal) || reminderVal < 0 || reminderVal > 365) {
    alert("Le nombre de jours avant rappel doit être entre 0 et 365.");
    return;
  }

  // Valider la taille de l'URL de l'image avant de sauvegarder
  const imageUrl = currentBackgroundSettings.data?.url || null;
  // Pas de validation de taille pour permettre le fonctionnement avec Storage

  const data = {
    ecoleUser,
    ecolePass: ecolePassPlain,
    defaultReminder: reminderVal,
    defaultHour: hourVal,
    forceDesktopNotifications,
    lastUpdated: new Date().toISOString(),
    // Aplatir les préférences de personnalisation (compatibilité ancien format)
    bgType: currentBackgroundSettings.type,
    bgColor: currentBackgroundSettings.data?.color || null,
    bgGradientStart: currentBackgroundSettings.data?.start || null,
    bgGradientEnd: currentBackgroundSettings.data?.end || null,
    bgGradientDirection: currentBackgroundSettings.data?.direction || null,
    // Ne sauvegarder l'URL que si elle n'est pas trop longue
    bgImageUrl: (currentBackgroundSettings.data?.url && currentBackgroundSettings.data.url.length < 500000) ? currentBackgroundSettings.data.url : null,
    bgImageSize: currentBackgroundSettings.data?.size || null,
    bgImageRepeat: currentBackgroundSettings.data?.repeat || null,
    caseBgColor: currentCaseSettings.bgColor,
    caseBorderColor: currentCaseSettings.borderColor,
    caseOpacity: currentCaseSettings.opacity,
    caseTextColor: currentCaseSettings.textColor,
    // Couleurs des tâches
    devoirColor: currentTaskColors.devoir,
    evaluationColor: currentTaskColors.evaluation,
    congeColor: currentTaskColors.conge,
    rendezvousColor: currentTaskColors.rendezvous,
    // Couleurs des rappels
    rappelImminentColor: currentRappelColors.imminent,
    rappelProcheColor: currentRappelColors.proche,
    rappelLoinColor: currentRappelColors.loin,
    syncAcrossDevices: currentBackgroundSettings.syncAcrossDevices || currentCaseSettings.syncAcrossDevices || currentTaskColors.syncAcrossDevices || currentRappelColors.syncAcrossDevices || false,
    // NOUVEAU: Configuration ThemeEngine complète
    themeConfig: themeEngine.getConfig()
  };

  try {
    // Sauvegarder dans Firestore
    await setDoc(doc(db, "users", state.currentUser.uid), data, { merge: true });
    
    console.log("Paramètres sauvegardés dans Firestore:", data);
    
    // Mettre à jour le state local
    state.currentUserDoc = { ...(state.currentUserDoc || {}), ...data };
    state.defaultReminder = reminderVal;
    state.defaultHour = hourVal;
    
    // Afficher un message de confirmation
    showNotification("Paramètres et personnalisation sauvegardés avec succès", 'success');
    
    // Mettre à jour le thème avec les valeurs du formulaire et appliquer
    const formConfig = getFormThemeConfig();
    themeEngine.config = { ...themeEngine.config, ...formConfig, theme: 'custom' };
    themeEngine.applyTheme();
    
    // Fermer la modale
    if (paramsBg) paramsBg.style.display = "none";
    
    // Rafraîchir l'affichage si nécessaire
    await renderCalendar(state.currentYear, state.currentMonth);
    
    // Lancer l'import automatique si des identifiants sont fournis
    if (ecoleUser && ecolePassPlain) {
      setTimeout(importDevoirsManuellement, 1000);
    }
  } catch (err) {
    console.error("Erreur sauvegarde paramètres:", err);
    alert("Impossible d'enregistrer les paramètres.");
  }
}

async function loadUserSettingsOrAsk() {
  console.log("🔥 loadUserSettingsOrAsk appelé pour:", state.currentUser?.uid);
  console.log("🔥 state.currentUserDoc avant chargement:", state.currentUserDoc);
  
  try {
    ensureAuthed();
    
    // Toujours charger les paramètres depuis Firestore pour avoir les dernières valeurs
    const userDoc = await getDoc(doc(db, "users", state.currentUser.uid));
    
    if (userDoc.exists()) {
      // Forcer l'écrasement complet avec les données fraîches de Firestore
      const freshData = userDoc.data();
      state.currentUserDoc = { ...freshData };
      
      console.log("🔥 Données brutes chargées depuis Firestore:", freshData);
      console.log("🔥 Valeur de defaultHour dans les données brutes:", freshData.defaultHour);
      console.log("🔥 state.currentUserDoc écrasé avec données fraîches:", state.currentUserDoc);
      
      // Mettre à jour les valeurs par défaut (uniquement depuis Firestore)
      state.defaultReminder = state.currentUserDoc.defaultReminder || 1;
      state.defaultHour = state.currentUserDoc.defaultHour || "18:00";
      
      // Mettre à jour les heures dans le modal s'il est ouvert
      updateModalHoursIfOpen();
      
      console.log("🔥 Paramètres chargés:", {
        ecoleUser: state.currentUserDoc.ecoleUser ? "[présent]" : "[manquant]",
        defaultReminder: state.defaultReminder,
        defaultHour: state.defaultHour
      });
      
      // Charger les préférences de fond après avoir chargé les données utilisateur
      await loadBackgroundSettings();
      console.log("🔥 Préférences de fond chargées depuis loadUserSettingsOrAsk");
      
      // Si des identifiants sont présents, lancer l'import
      if (state.currentUserDoc.ecoleUser && state.currentUserDoc.ecolePass) {
        console.log("Identifiants détectés, lancement de l'import...");
        setTimeout(importDevoirsManuellement, 1000);
      }
    } else {
      console.log("Aucun document utilisateur trouvé, création avec valeurs par défaut");
      // Créer un document utilisateur vide
      await setDoc(doc(db, "users", state.currentUser.uid), {
        createdAt: new Date().toISOString(),
        defaultReminder: 1,
        defaultHour: "18:00"
      }, { merge: true });
      
      // Recharger après création
      state.currentUserDoc = {
        defaultReminder: 1,
        defaultHour: "18:00"
      };
      state.defaultReminder = 1;
      state.defaultHour = "18:00";
    }
  } catch (err) {
    console.error("Erreur chargement paramètres:", err);
    // Utiliser les valeurs par défaut en cas d'erreur
    state.currentUserDoc = {
      defaultReminder: 1,
      defaultHour: "18:00"
    };
    state.defaultReminder = 1;
    state.defaultHour = "18:00";
  }
}

export async function getEcoleCredentials() {
  ensureAuthed();
  const snap = await getDoc(doc(db, "users", state.currentUser.uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  const identifiant = data.ecoleUser || "";
  const motdepasse = data.ecolePass || "";
  return { identifiant, motdepasse };
}

/* ================== Auth UI handlers ================== */
loginSubmitBtn?.addEventListener("click", async () => {
  const email = loginUserInput?.value.trim();
  const pass = loginPassInput?.value.trim();
  if (!email || !pass) {
    alert("Email et mot de passe requis.");
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    if (loginBg) loginBg.style.display = "none";
  } catch (_) {
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      if (loginBg) loginBg.style.display = "none";
    } catch (err) {
      console.error("Auth error:", err);
      alert("Erreur connexion/inscription.");
    }
  }
});

loginGoogleBtn?.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
    if (loginBg) loginBg.style.display = "none";
  } catch (err) {
    console.error("Google login error:", err);
    alert("Erreur login Google.");
  }
});

/* ================== Service worker helper ================== */
async function ensureServiceWorkerRegistered() {
  try {
    if (!("serviceWorker" in navigator)) return;
    if (navigator.serviceWorker.controller) return;
    const existing = await navigator.serviceWorker.getRegistration();
    if (!existing) {
      try {
        await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      } catch (err) {
        console.warn("SW register depuis main.js a echoue:", err);
      }
    }
    await navigator.serviceWorker.ready;
  } catch (err) {
    console.warn("ensureServiceWorkerRegistered failed:", err);
  }
}

/* ================== Auth state ================== */
onAuthStateChanged(auth, async (user) => {
  console.log("🔥 onAuthStateChanged déclenché, user:", user?.uid);
  state.authReady = true;
  if (user) {
    state.currentUser = user;
    if (loginBg) loginBg.style.display = "none";

    // Aucune ouverture d'onglet externe côté front
    try {
      // Toujours charger les paramètres pour s'assurer qu'ils sont à jour
      console.log("🔥 Chargement forcé des paramètres depuis onAuthStateChanged");
      await loadUserSettingsOrAsk();
      console.log("🔥 Données chargées avec succès depuis onAuthStateChanged");
      
      // Charger les préférences de fond après connexion
      await loadBackgroundSettings();
      console.log("🔥 Préférences de fond chargées");
      
      // Lancer aussi le chargement silencieux pour double sécurité
      setTimeout(() => loadSettingsSilently(), 100);
    } catch (err) {
      console.warn("loadUserSettingsOrAsk failed:", err);
    }
    const now = new Date();
    state.currentYear = now.getFullYear();
    state.currentMonth = now.getMonth();
    try {
      await renderCalendar(state.currentYear, state.currentMonth);
    } catch (err) {
      console.error("renderCalendar error:", err);
    }
    await ensureServiceWorkerRegistered();

    // Activer l'import temps-réel depuis Firestore
    try {
      enableExternalHomeworksRealtime();
    } catch (err) {
      console.warn("enableExternalHomeworksRealtime failed:", err);
    }
  } else {
    state.currentUser = null;
    state.currentUserDoc = null;
    if (typeof externalHWUnsub === "function") {
      try { externalHWUnsub(); } catch (_) {}
      externalHWUnsub = null;
    }
    if (loginBg) loginBg.style.display = "flex";
    if (calendar) {
      calendar.innerHTML = "<div class='not-logged'>Connecte-toi pour voir le calendrier</div>";
    }
    if (monthYear) monthYear.textContent = "";
  }
});

/* ================== Trash interactions ================== */
trashDiv?.addEventListener("mouseenter", () => trashDiv.classList.add("over"));
trashDiv?.addEventListener("mouseleave", () => trashDiv.classList.remove("over"));
trashDiv?.addEventListener("dragover", (event) => {
  const hasData = Boolean(dragContext.id) || event.dataTransfer?.types?.includes("text/plain");
  if (!hasData) return;
  event.preventDefault();
  trashDiv.classList.add("over");
});
trashDiv?.addEventListener("drop", handleTrashDrop);

/* ================== Debug helpers ================== */
window.__appDebug = {
  encryptText,
  decryptText,
  logout: () => signOut(auth)
};

/* ================== Initial load ================== */
(async () => {
  console.log("🚀 Démarrage de l'application - Version 78");
  
  // Vérifier immédiatement si l'utilisateur est déjà connecté et charger les données
  if (auth.currentUser) {
    console.log("🚀 Utilisateur déjà connecté, chargement immédiat des données...");
    state.currentUser = auth.currentUser;
    state.authReady = true;
    
    // Charger les données utilisateur IMMÉDIATEMENT avant tout autre chose
    try {
      console.log("🚀 CHARGEMENT IMMÉDIAT des données utilisateur...");
      await loadUserSettingsOrAsk();
      console.log("🚀 ✅ Données utilisateur chargées avec succès au démarrage");
    } catch (err) {
      console.error("🚀 ❌ Erreur chargement données utilisateur:", err);
    }
  }
  
  await ensureServiceWorkerRegistered().catch(() => {});
  
  if (auth.currentUser) {
    try {
      console.log("🚀 Initialisation FCM et calendrier...");
      
      // Charger les paramètres utilisateur silencieusement au démarrage
      console.log("🚀 Lancement du chargement silencieux des paramètres...");
      loadSettingsSilently(); // Pas de await pour ne pas bloquer le démarrage
      
      // Initialiser les notifications FCM
      await initializeNotifications();
    } catch (err) {
      console.error("🚀 Erreur initialisation FCM:", err);
    }
    const now = new Date();
    state.currentYear = now.getFullYear();
    state.currentMonth = now.getMonth();
    
    // Vérifier si on est à la fin du mois (dernier jour du mois)
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const isEndOfMonth = now.getDate() >= lastDayOfMonth - 1; // 1 jour avant la fin du mois
    
    if (isEndOfMonth) {
      // Afficher le mois suivant
      state.currentMonth++;
      if (state.currentMonth > 11) {
        state.currentMonth = 0;
        state.currentYear++;
      }
    }
    
    await renderCalendar(state.currentYear, state.currentMonth);
  }
})();

/* ================== Test notification helper ================== */
async function createImmediateTask() {
  try {
    ensureAuthed();
  } catch (err) {
    if (loginBg) loginBg.style.display = "flex";
    return;
  }
  const now = Date.now() + 2 * 60 * 1000;
  const when = new Date(now);
  const dateStr = formatDate(when);
  const heureStr = when.toTimeString().slice(0, 5);
  const groupId = generateGroupId();
  const parts = getDateParts(dateStr);
  const base = {
    matiere: "Test",
    titre: "Notif immediate",
    heure: heureStr,
    ownerUid: state.currentUser.uid
  };
  const duePayload = {
    ...base,
    date: dateStr,
    dueDate: dateStr,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    groupId,
    type: "devoir",
    rappel: false,
    hasRappel: true,
    rappelDate: dateStr,
    notified: false
  };
  const reminderPayload = {
    ...base,
    date: dateStr,
    rappelDate: dateStr,
    dueDate: dateStr,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    timestampRappel: now,
    groupId,
    type: "rappel",
    rappel: true,
    notified: false
  };
  try {
    await addDoc(collection(db, "devoirs"), duePayload);
    await addDoc(collection(db, "devoirs"), reminderPayload);
    alert(`Devoir test cree pour ${when.toLocaleString()}`);
  } catch (err) {
    console.error("Erreur creation devoir test:", err);
    alert("Erreur creation devoir test.");
  }
}

testNotifBtn?.addEventListener("click", () => {
  createImmediateTask();
});

// Plus de synchronisation entre heure du devoir et heure du rappel (champ heure supprimé)

// Expose pour console
window.__createImmediateTask = createImmediateTask;

/* ================== PERSONNALISATION DU FOND ================== */

let currentBackgroundSettings = {
  type: 'default',
  data: null,
  syncAcrossDevices: false
};

let currentCaseSettings = {
  bgColor: '#171b26',
  borderColor: '#3a4259',
  opacity: 95,
  textColor: '#cfe0ff',
  syncAcrossDevices: false
};

let currentTaskColors = {
  devoir: '#4CAF50',
  evaluation: '#FF9800',
  conge: '#2196F3',
  rendezvous: '#9C27B0',
  syncAcrossDevices: false
};

let currentRappelColors = {
  imminent: '#F44336',
  proche: '#FF9800',
  loin: '#2196F3',
  syncAcrossDevices: false
};

function applyBackgroundToPage() {
  console.log("🎨 applyBackgroundToPage appelée avec:", currentBackgroundSettings);

  const body = document.body;
  if (!body) return;

  const { type, data } = currentBackgroundSettings;

  // nettoyer ancien fond custom
  const existingBg = document.getElementById('custom-bg');
  if (existingBg) existingBg.remove();

  body.removeAttribute('data-bg-type');
  body.style.cssText = '';

  if (!type || type === 'default') {
    body.style.background = '';
    return;
  }

  body.setAttribute('data-bg-type', type);

  switch (type) {

    case 'color':
      body.style.background = data?.color || '#0b1020';
      break;

    case 'gradient':
      const start = data?.start || '#0b1020';
      const end = data?.end || '#0a0f1a';
      const direction = data?.direction || '180deg';

      if (direction === 'radial') {
        body.style.background = `radial-gradient(circle, ${start}, ${end})`;
      } else {
        body.style.background = `linear-gradient(${direction}, ${start}, ${end})`;
      }
      break;

    case 'image':
    case 'gif':

      if (!data?.url) {
        console.error("URL vide pour image/gif");
        return;
      }

      const bgDiv = document.createElement("div");

      bgDiv.id = "custom-bg";
      
      // Fallback background color to avoid white showing through
      const fallbackBg = '#0b1020';
      
      // Pour les GIFs/images, utiliser 'cover' par défaut ou '100% 100%' pour étirer
      let size = data?.size || 'cover';
      if (size === 'stretch') {
        size = '100% 100%';
      }

      bgDiv.style.cssText = `
        position: absolute;
        top:0;
        left:0;
        width:100vw;
        height:100%;
        min-height:100vh;
        background-color: ${fallbackBg};
        background-image: url('${data.url}');
        background-position: center;
        background-size: ${size};
        background-repeat: ${data?.repeat || 'no-repeat'};
        z-index:-999;
        pointer-events:none;
      `;

      document.body.insertBefore(bgDiv, document.body.firstChild);

      body.style.background = "none";
      body.style.backgroundColor = "transparent";

      break;

  }

  // garder transparence des modaux
  const modals = document.querySelectorAll('.modal, #params, .day-tasks, .login');

  modals.forEach(modal => {
    modal.style.background = 'rgba(25,29,42,0.92)';
  });
};

function updatePreview() {

  const preview = document.getElementById('background-preview');
  if (!preview) return;

  preview.style.background = '';
  preview.style.backgroundSize = '';
  preview.style.backgroundRepeat = '';
  preview.style.backgroundPosition = '';

  const type = document.getElementById('background-type')?.value || 'default';

  let background = '';

  switch (type) {

    case 'color':
      const color = document.getElementById('solid-color')?.value || '#0b1020';
      background = color;
      break;

    case 'gradient':

      const start = document.getElementById('gradient-start')?.value || '#0b1020';
      const end = document.getElementById('gradient-end')?.value || '#0a0f1a';
      const direction = document.getElementById('gradient-direction')?.value || '180deg';

      if (direction === 'radial') {
        background = `radial-gradient(circle, ${start}, ${end})`;
      } else {
        background = `linear-gradient(${direction}, ${start}, ${end})`;
      }

      break;

    case 'image':
    case 'gif':

      const url = document.getElementById('media-url')?.value;

      if (url) {

        const size = document.getElementById('media-size')?.value || 'cover';
        const repeat = document.getElementById('media-repeat')?.value || 'no-repeat';

        preview.style.background = `url("${url}")`;
        preview.style.backgroundSize = size;
        preview.style.backgroundRepeat = repeat;
        preview.style.backgroundPosition = 'center';

      }

      return;

    default:

      background = `
      radial-gradient(1200px 800px at 20% -10%, rgba(30,144,255,0.15), transparent 60%),
      radial-gradient(900px 600px at 110% 10%, rgba(30,207,107,0.12), transparent 60%),
      linear-gradient(180deg,#0b1020,#0a0f1a)
      `;

  }

  preview.style.background = background;

}

// Sauvegarde les paramètres de fond dans Firestore
async function saveBackgroundToFirestore() {
  const type = document.getElementById('background-type')?.value || 'default';
  let data = null;
  
  switch (type) {
    case 'color':
      data = { color: document.getElementById('solid-color')?.value || '#0b1020' };
      break;
    case 'gradient':
      data = {
        start: document.getElementById('gradient-start')?.value || '#0b1020',
        end: document.getElementById('gradient-end')?.value || '#0a0f1a',
        direction: document.getElementById('gradient-direction')?.value || '180deg'
      };
      break;
    case 'image':
    case 'gif':
      data = {
        url: document.getElementById('media-url')?.value,
        size: document.getElementById('media-size')?.value || 'cover',
        repeat: document.getElementById('media-repeat')?.value || 'no-repeat'
      };
      break;
  }
  
  currentBackgroundSettings = {
    type: type,
    data: data,
    syncAcrossDevices: document.getElementById('global-background')?.checked || false
  };
  
  const saveData = {
    bgType: type,
    bgColor: data?.color,
    bgGradientStart: data?.start,
    bgGradientEnd: data?.end,
    bgGradientDirection: data?.direction,
    bgImageUrl: data?.url,
    bgImageSize: data?.size,
    bgImageRepeat: data?.repeat,
    backgroundUpdatedAt: new Date().toISOString()
  };
  
  try {
    if (state.currentUser?.uid) {
      await setDoc(doc(db, "users", state.currentUser.uid), saveData, { merge: true });
      console.log('🎨 Paramètres de fond sauvegardés dans Firestore');
    }
  } catch (err) {
    console.warn('🎨 Erreur sauvegarde Firestore:', err);
  }
}

// Afficher/masquer les options de fond selon le type
function showBackgroundOptions(type) {
  const colorOptions = document.getElementById('color-options');
  const gradientOptions = document.getElementById('gradient-options');
  const mediaOptions = document.getElementById('media-options');
  
  if (colorOptions) colorOptions.style.display = 'none';
  if (gradientOptions) gradientOptions.style.display = 'none';
  if (mediaOptions) mediaOptions.style.display = 'none';
  
  switch (type) {
    case 'color':
      if (colorOptions) colorOptions.style.display = 'block';
      break;
    case 'gradient':
      if (gradientOptions) gradientOptions.style.display = 'block';
      break;
    case 'image':
    case 'gif':
      if (mediaOptions) mediaOptions.style.display = 'block';
      break;
  }
}

// Gestionnaire de fichier pour le fond personnalisé
document.getElementById('media-file')?.addEventListener('change', function(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  
  // Vérifier la taille (max 5MB pour éviter de bloquer le navigateur)
  if (file.size > 5 * 1024 * 1024) {
    alert('Fichier trop grand (max 5MB)');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(event) {
    const dataUrl = event.target.result;
    const mediaUrl = document.getElementById('media-url');
    if (mediaUrl) {
      mediaUrl.value = dataUrl;
      
      // Mettre à jour currentBackgroundSettings pour la sauvegarde
      const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
      const type = isGif ? 'gif' : 'image';
      
      currentBackgroundSettings = {
        type: type,
        data: {
          url: dataUrl,
          size: document.getElementById('media-size')?.value || 'cover',
          repeat: document.getElementById('media-repeat')?.value || 'no-repeat'
        },
        syncAcrossDevices: document.getElementById('global-background')?.checked || false
      };
      
      updatePreview();
      applyBackgroundToPage();
      
      // Sauvegarder dans Firestore
      saveBackgroundToFirestore();
    }
  };
  
  try {
    saveBackgroundToFirestore();
  } catch (err) {
    console.warn('Erreur sauvegarde:', err);
  }
});

// Gestionnaire du changement de type de fond
document.getElementById('background-type')?.addEventListener('change', function(e) {
  showBackgroundOptions(e.target.value);
  updatePreview();
  saveBackgroundToFirestore();
});

// Gestionnaires pour les options de taille et répétition
document.getElementById('media-size')?.addEventListener('change', function() {
  if (currentBackgroundSettings.type === 'image' || currentBackgroundSettings.type === 'gif') {
    currentBackgroundSettings.data.size = this.value;
    updatePreview();
    applyBackgroundToPage();
    saveBackgroundToFirestore();
  }
});

document.getElementById('media-repeat')?.addEventListener('change', function() {
  if (currentBackgroundSettings.type === 'image' || currentBackgroundSettings.type === 'gif') {
    currentBackgroundSettings.data.repeat = this.value;
    updatePreview();
    applyBackgroundToPage();
    saveBackgroundToFirestore();
  }
});

document.getElementById('media-url')?.addEventListener('input', function() {
  const type = document.getElementById('background-type')?.value;
  if (type === 'image' || type === 'gif') {
    currentBackgroundSettings = {
      type: type,
      data: {
        url: this.value,
        size: document.getElementById('media-size')?.value || 'cover',
        repeat: document.getElementById('media-repeat')?.value || 'no-repeat'
      },
      syncAcrossDevices: document.getElementById('global-background')?.checked || false
    };
    updatePreview();
    applyBackgroundToPage();
    saveBackgroundToFirestore();
  }
});

// Listeners pour couleur unie
document.getElementById('solid-color')?.addEventListener('input', function() {
  if (document.getElementById('background-type')?.value === 'color') {
    updatePreview();
    applyBackgroundToPage();
    saveBackgroundToFirestore();
  }
});

// Listeners pour les options de gradient
document.getElementById('gradient-start')?.addEventListener('input', function() {
  if (document.getElementById('background-type')?.value === 'gradient') {
    updatePreview();
    applyBackgroundToPage();
    saveBackgroundToFirestore();
  }
});

document.getElementById('gradient-end')?.addEventListener('input', function() {
  if (document.getElementById('background-type')?.value === 'gradient') {
    updatePreview();
    applyBackgroundToPage();
    saveBackgroundToFirestore();
  }
});

document.getElementById('gradient-direction')?.addEventListener('change', function() {
  if (document.getElementById('background-type')?.value === 'gradient') {
    updatePreview();
    applyBackgroundToPage();
    saveBackgroundToFirestore();
  }
});

// Instance globale du ThemeEngine
const themeEngine = new ThemeEngine();

// Synchroniser les variables legacy depuis localStorage immédiatement
syncLegacyFromThemeEngine();

// Fonction pour synchroniser les variables legacy depuis ThemeEngine
function syncLegacyFromThemeEngine() {
  const cfg = themeEngine.getConfig();
  currentBackgroundSettings = {
    type: cfg.background.type,
    data: cfg.background.data ? { ...cfg.background.data } : null,
    syncAcrossDevices: false
  };
  currentCaseSettings = {
    bgColor: cfg.calendar.bgColor,
    borderColor: cfg.calendar.borderColor,
    opacity: cfg.calendar.opacity,
    textColor: cfg.calendar.textColor,
    syncAcrossDevices: false
  };
  currentTaskColors = {
    devoir: cfg.tasks.devoir,
    evaluation: cfg.tasks.evaluation,
    conge: cfg.tasks.conge,
    rendezvous: cfg.tasks.rendezvous,
    syncAcrossDevices: false
  };
  currentRappelColors = {
    imminent: cfg.reminders.imminent,
    proche: cfg.reminders.proche,
    loin: cfg.reminders.loin,
    syncAcrossDevices: false
  };
}

// Fonction loadBackgroundSettings utilisant ThemeEngine
async function loadBackgroundSettings() {
  try {
    console.log("🎨 ThemeEngine: Chargement des préférences...");
    
    if (auth.currentUser) {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        themeEngine.init(userData);
        syncLegacyFromThemeEngine();
        console.log("🎨 ThemeEngine: Initialisé avec les données utilisateur, thème:", themeEngine.getCurrentTheme());
      }
    }
  } catch (err) {
    console.error('ThemeEngine: Erreur chargement:', err);
  }
}

// Gestion des onglets de paramètres
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.dataset.tab;
    
    // Activer l'onglet
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Afficher le contenu
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById(`${tabId}-tab`)?.classList.add('active');
    
    // Si on ouvre l'onglet personnalisation, charger les valeurs
    if (tabId === 'customization') {
      loadConfigToForm(themeEngine.getConfig());
      updateThemePreview();
    }
  });
});

// Sélecteur de mode (clair/sombre/auto)
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('theme-mode').value = mode;
    
    themeEngine.setMode(mode);
  });
});

// Sélecteur de thèmes prédéfinis
document.querySelectorAll('.theme-card').forEach(card => {
  card.addEventListener('click', () => {
    const themeKey = card.dataset.theme;
    
    document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    document.getElementById('theme-preset').value = themeKey;
    
    themeEngine.applyPreset(themeKey);
    loadConfigToForm(themeEngine.getConfig());
    updateThemePreview();
  });
});

// Accordéon options avancées
document.getElementById('advanced-toggle')?.addEventListener('click', function() {
  const content = document.getElementById('advanced-content');
  const isOpen = content.style.display === 'block';
  content.style.display = isOpen ? 'none' : 'block';
  this.classList.toggle('open', !isOpen);
});

// Gestion du type de fond
document.getElementById('theme-bg-type')?.addEventListener('change', function() {
  const type = this.value;
  
  document.querySelectorAll('[id^="theme-color-options"], [id^="theme-gradient-options"], [id^="theme-media-options"]').forEach(el => {
    el.style.display = 'none';
  });
  
  if (type === 'color') {
    document.getElementById('theme-color-options').style.display = 'block';
  } else if (type === 'gradient') {
    document.getElementById('theme-gradient-options').style.display = 'block';
  } else if (type === 'image' || type === 'gif') {
    document.getElementById('theme-media-options').style.display = 'block';
  }
  
  updateThemeFromForm();
});

// Mise à jour de l'aperçu et du ThemeEngine en temps réel
function updateThemeFromForm() {
  const formConfig = getFormThemeConfig();
  themeEngine.config = { ...themeEngine.config, ...formConfig, theme: 'custom' };
  themeEngine.applyTheme();
  syncLegacyFromThemeEngine();
  updateThemePreview();
}

['theme-solid-color', 'theme-gradient-start', 'theme-gradient-end', 'theme-media-url'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', updateThemeFromForm);
});

// Bouton réinitialiser
document.getElementById('theme-reset')?.addEventListener('click', () => {
  themeEngine.reset();
  loadConfigToForm(themeEngine.getConfig());
  updateThemePreview();
  showNotification("Thème réinitialisé", 'success');
});

// Fonction utilitaire pour synchroniser color input et hex input
function setupColorHexSync(colorId, hexId) {
  const colorInput = document.getElementById(colorId);
  const hexInput = document.getElementById(hexId);
  
  if (colorInput && hexInput) {
    colorInput.addEventListener('input', () => {
      hexInput.value = colorInput.value;
      updateThemeFromForm();
    });
    hexInput.addEventListener('input', () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(hexInput.value)) {
        colorInput.value = hexInput.value;
        updateThemeFromForm();
      }
    });
  }
}

// Synchroniser tous les inputs de couleur
setupColorHexSync('theme-solid-color', 'theme-solid-hex');
setupColorHexSync('theme-gradient-start', 'theme-gradient-start-hex');
setupColorHexSync('theme-gradient-end', 'theme-gradient-end-hex');
setupColorHexSync('theme-case-bg', 'theme-case-hex');
setupColorHexSync('theme-case-border', 'theme-case-border-hex');
setupColorHexSync('theme-case-text', 'theme-case-text-hex');
setupColorHexSync('theme-devoir', 'theme-devoir-hex');
setupColorHexSync('theme-evaluation', 'theme-evaluation-hex');
setupColorHexSync('theme-conge', 'theme-conge-hex');
setupColorHexSync('theme-rendezvous', 'theme-rendezvous-hex');
setupColorHexSync('theme-rappel-imminent', 'theme-rappel-imminent-hex');
setupColorHexSync('theme-rappel-proche', 'theme-rappel-proche-hex');
setupColorHexSync('theme-rappel-loin', 'theme-rappel-loin-hex');

// Opacité slider + autres inputs qui doivent aussi mettre à jour le ThemeEngine
document.getElementById('theme-case-opacity')?.addEventListener('input', function() {
  document.getElementById('theme-case-opacity-value').textContent = this.value + '%';
  updateThemeFromForm();
});

['theme-gradient-direction', 'theme-media-size', 'theme-media-repeat', 'theme-case-align', 'theme-mode', 'theme-anim-enabled', 'theme-anim-speed', 'theme-font-size', 'theme-compact'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', updateThemeFromForm);
});

/* ================== MODE EXAMEN ================== */

// DOM references
const examModeBtn = document.getElementById('exam-mode-btn');
const examModeBg = document.getElementById('exam-mode-bg');
const examModeCloseBtn = document.getElementById('exam-mode-close-btn');
const addSubjectBtn = document.getElementById('add-subject-btn');
const addScheduleBtn = document.getElementById('add-schedule-btn');
const subjectModalBg = document.getElementById('subject-modal-bg');
const scheduleModalBg = document.getElementById('schedule-modal-bg');
const subjectForm = document.getElementById('subjectForm');
const scheduleForm = document.getElementById('scheduleForm');

// State
let examSubjects = [];
let examSchedule = [];
let editingSubjectId = null;
let editingScheduleId = null;

// Open/Close exam mode
examModeBtn?.addEventListener('click', () => {
  ensureAuthed();
  loadExamData();
  examModeBg.style.display = 'flex';
});

examModeCloseBtn?.addEventListener('click', () => {
  examModeBg.style.display = 'none';
});

examModeBg?.addEventListener('click', (e) => {
  if (e.target === examModeBg) examModeBg.style.display = 'none';
});

// Tab switching
document.querySelectorAll('.exam-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.dataset.tab;
    
    document.querySelectorAll('.exam-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    document.querySelectorAll('.exam-tab-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById(`${tabId}-tab`)?.classList.add('active');
    
    if (tabId === 'calendar') {
      renderExamCalendar();
    }
  });
});

// Load exam data from Firestore
async function loadExamData() {
  if (!state.currentUser) return;
  
  try {
    // Load subjects
    const subjectsRef = collection(db, "users", state.currentUser.uid, "examSubjects");
    const subjectsSnap = await getDocs(subjectsRef);
    examSubjects = subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderSubjectsList();
    
    // Load schedule
    const scheduleRef = collection(db, "users", state.currentUser.uid, "examSchedule");
    const scheduleSnap = await getDocs(scheduleRef);
    examSchedule = scheduleSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderScheduleList();
    
    // Update subject select in schedule modal
    updateSubjectSelect();
  } catch (err) {
    console.error("Error loading exam data:", err);
  }
}

// Render subjects list
function renderSubjectsList() {
  const list = document.getElementById('subjects-list');
  if (!list) return;
  
  if (examSubjects.length === 0) {
    list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Aucune matière ajoutée</p>';
    return;
  }
  
  list.innerHTML = examSubjects.map(subject => `
    <div class="subject-card" data-id="${subject.id}">
      <h4>${escapeHtml(subject.name)}</h4>
      <div class="subject-topics">${escapeHtml(subject.topics || '')}</div>
      ${subject.examDate ? `<div class="subject-exam-date">📅 Examen: ${formatDateFR(subject.examDate)}</div>` : ''}
    </div>
  `).join('');
  
  // Add click listeners for editing
  list.querySelectorAll('.subject-card').forEach(card => {
    card.addEventListener('click', () => openSubjectModal(card.dataset.id));
  });
}

// Render schedule list
function renderScheduleList() {
  const list = document.getElementById('schedule-list');
  if (!list) return;
  
  if (examSchedule.length === 0) {
    list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Aucun créneau planifié</p>';
    return;
  }
  
  // Sort by day and time
  const sortedSchedule = [...examSchedule].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.start.localeCompare(b.start);
  });
  
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  
  list.innerHTML = sortedSchedule.map(item => {
    const subject = examSubjects.find(s => s.id === item.subjectId);
    return `
      <div class="schedule-item" data-id="${item.id}">
        <div class="schedule-time">${item.start} - ${item.end}</div>
        <div class="schedule-subject">${subject ? escapeHtml(subject.name) : 'Matière inconnue'}</div>
        <div class="schedule-day">${dayNames[item.day]}</div>
        ${item.topics ? `<div class="schedule-topics">${escapeHtml(item.topics)}</div>` : ''}
      </div>
    `;
  }).join('');
  
  // Add click listeners for editing
  list.querySelectorAll('.schedule-item').forEach(card => {
    card.addEventListener('click', () => openScheduleModal(card.dataset.id));
  });
}

// Update subject select in schedule modal
function updateSubjectSelect() {
  const select = document.getElementById('schedule-subject');
  if (!select) return;
  
  select.innerHTML = '<option value="">Sélectionne une matière</option>' +
    examSubjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}

// Open subject modal (add or edit)
function openSubjectModal(subjectId = null) {
  editingSubjectId = subjectId;
  const modal = subjectModalBg;
  const title = document.getElementById('subject-modal-title');
  const deleteBtn = document.getElementById('subject-delete-btn');
  
  if (subjectId) {
    const subject = examSubjects.find(s => s.id === subjectId);
    if (subject) {
      title.textContent = 'Modifier la matière';
      document.getElementById('subject-name').value = subject.name;
      document.getElementById('subject-topics').value = subject.topics || '';
      document.getElementById('subject-exam-date').value = subject.examDate || '';
      deleteBtn.style.display = 'inline-block';
    }
  } else {
    title.textContent = 'Ajouter une matière';
    subjectForm.reset();
    deleteBtn.style.display = 'none';
  }
  
  modal.style.display = 'flex';
}

// Open schedule modal (add or edit)
function openScheduleModal(scheduleId = null) {
  editingScheduleId = scheduleId;
  const modal = scheduleModalBg;
  const title = document.getElementById('schedule-modal-title');
  const deleteBtn = document.getElementById('schedule-delete-btn');
  
  updateSubjectSelect();
  
  if (scheduleId) {
    const item = examSchedule.find(s => s.id === scheduleId);
    if (item) {
      title.textContent = 'Modifier le créneau';
      document.getElementById('schedule-subject').value = item.subjectId;
      document.getElementById('schedule-day').value = item.day;
      document.getElementById('schedule-start').value = item.start;
      document.getElementById('schedule-end').value = item.end;
      document.getElementById('schedule-topics').value = item.topics || '';
      deleteBtn.style.display = 'inline-block';
    }
  } else {
    title.textContent = 'Ajouter un créneau';
    scheduleForm.reset();
    deleteBtn.style.display = 'none';
  }
  
  modal.style.display = 'flex';
}

// Close modals
document.getElementById('subject-cancel-btn')?.addEventListener('click', () => {
  subjectModalBg.style.display = 'none';
  editingSubjectId = null;
});

document.getElementById('schedule-cancel-btn')?.addEventListener('click', () => {
  scheduleModalBg.style.display = 'none';
  editingScheduleId = null;
});

subjectModalBg?.addEventListener('click', (e) => {
  if (e.target === subjectModalBg) {
    subjectModalBg.style.display = 'none';
    editingSubjectId = null;
  }
});

scheduleModalBg?.addEventListener('click', (e) => {
  if (e.target === scheduleModalBg) {
    scheduleModalBg.style.display = 'none';
    editingScheduleId = null;
  }
});

// Add subject button
addSubjectBtn?.addEventListener('click', () => openSubjectModal());

// Add schedule button
addScheduleBtn?.addEventListener('click', () => openScheduleModal());

// Save subject
subjectForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!state.currentUser) return;
  
  const name = document.getElementById('subject-name').value.trim();
  const topics = document.getElementById('subject-topics').value.trim();
  const examDate = document.getElementById('subject-exam-date').value;
  
  try {
    if (editingSubjectId) {
      // Update existing
      const ref = doc(db, "users", state.currentUser.uid, "examSubjects", editingSubjectId);
      await updateDoc(ref, { name, topics, examDate, updatedAt: Date.now() });
      
      const index = examSubjects.findIndex(s => s.id === editingSubjectId);
      if (index !== -1) {
        examSubjects[index] = { ...examSubjects[index], name, topics, examDate, updatedAt: Date.now() };
      }
    } else {
      // Create new
      const ref = await addDoc(collection(db, "users", state.currentUser.uid, "examSubjects"), {
        name,
        topics,
        examDate,
        createdAt: Date.now()
      });
      examSubjects.push({ id: ref.id, name, topics, examDate, createdAt: Date.now() });
    }
    
    renderSubjectsList();
    updateSubjectSelect();
    subjectModalBg.style.display = 'none';
    editingSubjectId = null;
    subjectForm.reset();
  } catch (err) {
    console.error("Error saving subject:", err);
    showNotification("Erreur lors de la sauvegarde", 'error');
  }
});

// Delete subject
document.getElementById('subject-delete-btn')?.addEventListener('click', async () => {
  if (!editingSubjectId || !state.currentUser) return;
  
  if (!confirm('Supprimer cette matière ?')) return;
  
  try {
    await deleteDoc(doc(db, "users", state.currentUser.uid, "examSubjects", editingSubjectId));
    examSubjects = examSubjects.filter(s => s.id !== editingSubjectId);
    
    // Also remove schedule items for this subject
    const scheduleItems = examSchedule.filter(s => s.subjectId === editingSubjectId);
    for (const item of scheduleItems) {
      await deleteDoc(doc(db, "users", state.currentUser.uid, "examSchedule", item.id));
    }
    examSchedule = examSchedule.filter(s => s.subjectId !== editingSubjectId);
    
    renderSubjectsList();
    renderScheduleList();
    subjectModalBg.style.display = 'none';
    editingSubjectId = null;
  } catch (err) {
    console.error("Error deleting subject:", err);
    showNotification("Erreur lors de la suppression", 'error');
  }
});

// Save schedule
scheduleForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!state.currentUser) return;
  
  const subjectId = document.getElementById('schedule-subject').value;
  const day = parseInt(document.getElementById('schedule-day').value);
  const start = document.getElementById('schedule-start').value;
  const end = document.getElementById('schedule-end').value;
  const topics = document.getElementById('schedule-topics').value.trim();
  
  if (!subjectId) {
    showNotification("Sélectionne une matière", 'error');
    return;
  }
  
  try {
    if (editingScheduleId) {
      // Update existing
      const ref = doc(db, "users", state.currentUser.uid, "examSchedule", editingScheduleId);
      await updateDoc(ref, { subjectId, day, start, end, topics, updatedAt: Date.now() });
      
      const index = examSchedule.findIndex(s => s.id === editingScheduleId);
      if (index !== -1) {
        examSchedule[index] = { ...examSchedule[index], subjectId, day, start, end, topics, updatedAt: Date.now() };
      }
    } else {
      // Create new
      const ref = await addDoc(collection(db, "users", state.currentUser.uid, "examSchedule"), {
        subjectId,
        day,
        start,
        end,
        topics,
        createdAt: Date.now()
      });
      examSchedule.push({ id: ref.id, subjectId, day, start, end, topics, createdAt: Date.now() });
    }
    
    renderScheduleList();
    scheduleModalBg.style.display = 'none';
    editingScheduleId = null;
    scheduleForm.reset();
  } catch (err) {
    console.error("Error saving schedule:", err);
    showNotification("Erreur lors de la sauvegarde", 'error');
  }
});

// Delete schedule
document.getElementById('schedule-delete-btn')?.addEventListener('click', async () => {
  if (!editingScheduleId || !state.currentUser) return;
  
  if (!confirm('Supprimer ce créneau ?')) return;
  
  try {
    await deleteDoc(doc(db, "users", state.currentUser.uid, "examSchedule", editingScheduleId));
    examSchedule = examSchedule.filter(s => s.id !== editingScheduleId);
    
    renderScheduleList();
    scheduleModalBg.style.display = 'none';
    editingScheduleId = null;
  } catch (err) {
    console.error("Error deleting schedule:", err);
    showNotification("Erreur lors de la suppression", 'error');
  }
});

// Render exam calendar
function renderExamCalendar() {
  const calendar = document.getElementById('exam-calendar');
  if (!calendar) return;
  
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  
  // Group schedule by day
  const scheduleByDay = {};
  examSchedule.forEach(item => {
    if (!scheduleByDay[item.day]) scheduleByDay[item.day] = [];
    scheduleByDay[item.day].push(item);
  });
  
  // Sort each day's schedule by time
  Object.keys(scheduleByDay).forEach(day => {
    scheduleByDay[day].sort((a, b) => a.start.localeCompare(b.start));
  });
  
  let html = '';
  for (let day = 1; day <= 6; day++) { // Monday to Saturday
    const items = scheduleByDay[day] || [];
    if (items.length > 0) {
      html += `
        <div class="exam-calendar-day">
          <div class="day-header">${dayNames[day]}</div>
          <div class="day-sessions">
            ${items.map(item => {
              const subject = examSubjects.find(s => s.id === item.subjectId);
              return `
                <div class="exam-calendar-session">
                  <span class="session-time">${item.start} - ${item.end}</span>
                  <span class="session-subject">${subject ? escapeHtml(subject.name) : 'Inconnu'}</span>
                  ${item.topics ? `<div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">${escapeHtml(item.topics)}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
  }
  
  if (html === '') {
    html = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Aucun créneau planifié pour cette semaine</p>';
  }
  
  calendar.innerHTML = html;
}

// Utility: Format date in French
function formatDateFR(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Utility: Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

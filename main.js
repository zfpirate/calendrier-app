/* ================== Firebase imports ================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  setDoc,
  getDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported as messagingIsSupported
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";

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

/* ================== Crypto (AES helper) ================== */
/**
 * IMPORTANT :
 * - Garde cette clé privée (ne la commit pas en public, mets le repo en privé).
 * - Le bot DOIT utiliser la même clé pour déchiffrer.
 */
const SECRET_KEY = "3k8$Pq9!mZr2@xLw7#yT";

// Vérification basique que CryptoJS est bien dispo
function assertCryptoReady() {
  if (typeof CryptoJS === "undefined" || !CryptoJS.AES) {
    console.error("❌ CryptoJS introuvable. Ajoute le script CDN avant ce fichier.");
    throw new Error("CryptoJS non chargé");
  }
}

function encryptText(plain) {
  assertCryptoReady();
  if (typeof plain !== "string") plain = String(plain ?? "");
  return CryptoJS.AES.encrypt(plain, SECRET_KEY).toString();
}
function decryptText(cipher) {
  assertCryptoReady();
  if (!cipher || typeof cipher !== "string") return "";
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8) || "";
  } catch (e) {
    console.warn("⚠️ Échec déchiffrement (clé invalide / donnée corrompue)", e);
    return "";
  }
}

/* ================== FCM setup (no duplicate imports) ================== */
let messaging = null;
let fcmSupported = false;
let fcmInitialized = false;
(async () => {
  fcmSupported = await messagingIsSupported().catch(() => false);
  if (fcmSupported) messaging = getMessaging(app);
})();

/* ================== Service Worker helper ================== */
async function ensureServiceWorkerRegistered() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
    console.log("✅ Service Worker FCM enregistré:", reg);
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn("❌ Échec enregistrement SW FCM (vérifie chemin):", err);
    return null;
  }
}

/* ================== Google Auth ================== */
const googleProvider = new GoogleAuthProvider();

async function loginWithGoogleUIFlow() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log("✅ Connecté avec Google:", result.user.displayName);
    return result.user;
  } catch (err) {
    console.error("❌ Erreur login Google:", err);
    throw err;
  }
}

/* ================== Notifications (FCM) ================== */
const VAPID_KEY = "BEk1IzaUQOXzKFu7RIkILgmWic1IgWfMdAECHofkTC5D5kmUY6tC0lWVIUtqCyHdrD96aiccAYW5A00PTQHYBZM"; // ta VAPID key

async function enableNotificationsForCurrentUser() {
  if (!fcmSupported) {
    console.warn("FCM non supporté par ce navigateur.");
    return null;
  }
  if (!auth.currentUser) {
    console.warn("User non connecté — notifications pas activées.");
    return null;
  }
  try {
    const swReg = await ensureServiceWorkerRegistered();

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Permission notifications refusée");
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg ?? undefined
    });

    if (!token) {
      console.warn("Aucun token FCM récupéré (contexte / permission).");
      return null;
    }

    console.log("🔑 FCM token:", token);

    // stocke token dans Firestore users/{uid}.fcmTokens (array) pour gestion multi devices
    try {
      const uRef = doc(db, "users", auth.currentUser.uid);
      const userSnap = await getDoc(uRef);
      const current = userSnap.exists() ? (userSnap.data().fcmTokens || []) : [];
      const newTokens = Array.isArray(current) ? current.filter(t => t !== token).concat([token]) : [token];
      await setDoc(uRef, { fcmTokens: newTokens, fcmUpdatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.warn("Impossible d'enregistrer token FCM dans Firestore:", e);
    }

    fcmInitialized = true;
    return token;
  } catch (e) {
    console.error("Erreur enableNotificationsForCurrentUser:", e);
    return null;
  }
}

// foreground handler
function listenForegroundNotifications() {
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    console.log("📩 Notif foreground:", payload);
    const t = payload?.notification?.title || "Notification";
    const b = payload?.notification?.body || "";
    try {
      new Notification(t, { body: b, icon: payload?.notification?.icon });
    } catch {
      alert(`${t}\n${b}`);
    }
  });
}

/* ================== DOM references (existing in your HTML) ================== */
const calendar = document.getElementById("calendar");
const monthYear = document.getElementById("monthYear");
const prevMonthBtn = document.getElementById("prev-month-btn");
const nextMonthBtn = document.getElementById("next-month-btn");
const settingsBtn = document.getElementById("settings-btn");

const modalBg = document.getElementById("modal-bg");
const modalTitle = document.getElementById("modal-title");
const matiereInput = document.getElementById("matiere");
const titreInput = document.getElementById("titre");
const dateInput = document.getElementById("date");
const rappelCheckbox = document.getElementById("rappel");
const cancelBtn = document.getElementById("cancel-btn");
const deleteBtn = document.getElementById("delete-btn");
const taskForm = document.getElementById("taskForm");

const paramsBg = document.getElementById("params-bg");
const paramsForm = document.getElementById("paramsForm");
const userIdInput = document.getElementById("userId");
const userPassInput = document.getElementById("userPass");
const defaultReminderInput = document.getElementById("defaultReminder");
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

/* ================== State ================== */
let currentYear = null;
let currentMonth = null;
let selectedDate = null;
let editingTaskId = null;
let defaultReminder = 1;
let draggedRappel = null;
let offsetX = 0;
let offsetY = 0;
let currentUser = null;
let currentUserDoc = null;

/* ================== Helpers (format/parse) ================== */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function ensureAuthed() {
  if (!currentUser) {
    if (loginBg) loginBg.style.display = "flex";
    throw new Error("User not authenticated");
  }
}

/* ================== AUTH FLOW (single import used) ================== */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    if (loginBg) loginBg.style.display = "none";

    await loadUserSettingsOrAsk().catch(console.error);
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
    await renderCalendar(currentYear, currentMonth).catch(console.error);

    await ensureServiceWorkerRegistered();
    listenForegroundNotifications();
    if (!fcmInitialized) await enableNotificationsIfAuto();
  } else {
    currentUser = null;
    if (loginBg) loginBg.style.display = "flex";
  }
});

// helper: try enable notifications automatically if user doc requests it
async function enableNotificationsIfAuto() {
  try {
    const uRef = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(uRef);
    const auto = snap.exists() && snap.data().autoEnableNotifications;
    if (auto) await enableNotificationsForCurrentUser();
  } catch (e) {
    console.warn("autoEnableNotifications check failed", e);
  }
}

/* ================== LOGIN UI handlers ================== */
loginSubmitBtn?.addEventListener("click", async () => {
  const email = loginUserInput.value?.trim();
  const pass = loginPassInput.value?.trim();
  if (!email || !pass) { alert("Email / mot de passe requis."); return; }
  try { await signInWithEmailAndPassword(auth, email, pass); }
  catch (e) { await createUserWithEmailAndPassword(auth, email, pass); }
});

loginGoogleBtn?.addEventListener("click", async () => {
  try {
    await loginWithGoogleUIFlow();
  } catch (e) { alert("Erreur login Google"); }
});

/* ================== User settings (params) ================== */
async function loadUserSettingsOrAsk() {
  ensureAuthed();
  const userRef = doc(db, "users", currentUser.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      currentUserDoc = snap.data();
      defaultReminder = Number(currentUserDoc.defaultReminder ?? 1) || 1;
    } else {
      openParams();
    }
  } catch (e) {
    console.error("Erreur lecture users/{uid}", e);
  }
}

paramsForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  ensureAuthed();
  const ecoleUser = userIdInput.value.trim();
  const ecolePassPlain = userPassInput.value.trim();
  const reminderVal = parseInt(defaultReminderInput.value, 10);
  if (!ecoleUser || !ecolePassPlain || isNaN(reminderVal) || reminderVal < 0 || reminderVal > 7) {
    alert("Remplis les paramètres correctement (0-7 jours).");
    return;
  }

  // 🔒 Chiffrement du mot de passe avant Firestore
  const ecolePass = encryptText(ecolePassPlain);

  const userRef = doc(db, "users", currentUser.uid);
  const data = { ecoleUser, ecolePass, defaultReminder: reminderVal };
  try {
    await setDoc(userRef, data, { merge: true });
    currentUserDoc = { ...(currentUserDoc || {}), ...data };
    defaultReminder = reminderVal;
    paramsBg.style.display = "none";
    await renderCalendar(currentYear, currentMonth);
    console.log("✅ Identifiants école stockés (mdp chiffré).");
  } catch (e) {
    console.error("Erreur sauvegarde paramètres", e);
    alert("Erreur: impossible d’enregistrer.");
  }
});

paramsCancelBtn?.addEventListener("click", () => { paramsBg.style.display = "none"; });

function openParams() {
  ensureAuthed();
  // Identifiant en clair
  userIdInput.value = currentUserDoc?.ecoleUser || "";

  // 🔓 Déchiffrer à l’affichage du modal (si présent)
  const enc = currentUserDoc?.ecolePass;
  userPassInput.value = enc ? decryptText(enc) : "";

  defaultReminderInput.value = currentUserDoc?.defaultReminder ?? defaultReminder ?? 1;
  paramsBg.style.display = "flex";
}

/* ================== Calendar render & tasks (kept your logic) ================== */
async function renderCalendar(year, month) {
  ensureAuthed();
  calendar.innerHTML = "";
  currentYear = year;
  currentMonth = month;

  const monthNames = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const days = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  monthYear.textContent = `${monthNames[month]} ${year}`;

  days.forEach(day => {
    const d = document.createElement("div");
    d.className = "day-name";
    d.textContent = day;
    calendar.appendChild(d);
  });

  const firstDayOfMonth = new Date(year, month, 1);
  let startDay = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < startDay; i++) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "empty";
    calendar.appendChild(emptyDiv);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayDiv = document.createElement("div");
    dayDiv.className = "date";
    const dateStr = formatDate(new Date(year, month, day));
    dayDiv.dataset.date = dateStr;

    const now = new Date();
    if (day === now.getDate() && month === now.getMonth() && year === now.getFullYear()) {
      dayDiv.classList.add("today");
      const todayLabel = document.createElement("div");
      todayLabel.className = "today-label";
      todayLabel.textContent = "Aujourd'hui";
      dayDiv.appendChild(todayLabel);
    }

    const numDiv = document.createElement("div");
    numDiv.className = "num";
    numDiv.textContent = day;
    dayDiv.appendChild(numDiv);

    const tasksDiv = document.createElement("div");
    tasksDiv.className = "tasks";
    dayDiv.appendChild(tasksDiv);

    dayDiv.addEventListener("click", () => { openDayTasksModal(dateStr); });

    calendar.appendChild(dayDiv);
  }

  await loadTasks(year, month);
}

/* ================== Load tasks (Firestore) ================== */
rappelTaskDiv.addEventListener("mousedown", startDrag);
rappelTaskDiv.addEventListener("touchstart", startDrag);

function startDrag(e) {
  e.preventDefault();
  draggedRappel = rappelTaskDiv;
  const rect = rappelTaskDiv.getBoundingClientRect();

  if (e.type === "mousedown") {
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
  } else if (e.type === "touchstart") {
    offsetX = e.touches[0].clientX - rect.left;
    offsetY = e.touches[0].clientY - rect.top;
  }

  rappelTaskDiv.style.position = "absolute";
  rappelTaskDiv.style.zIndex = 1000;
  rappelTaskDiv.style.pointerEvents = "none";
  document.body.appendChild(rappelTaskDiv);

  function moveAt(pageX, pageY) {
    rappelTaskDiv.style.left = pageX - offsetX + "px";
    rappelTaskDiv.style.top = pageY - offsetY + "px";
  }

  function onMove(event) {
    if (event.type === "mousemove") moveAt(event.pageX, event.pageY);
    else if (event.type === "touchmove") moveAt(event.touches[0].pageX, event.touches[0].pageY);
  }

  function onEnd(event) {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onEnd);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onEnd);
    stopDragRappel(event);
  }

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onEnd);
  document.addEventListener("touchmove", onMove);
  document.addEventListener("touchend", onEnd);
}

/* ================== Drag stop (rappel) ================== */
async function stopDragRappel(e) {
  if (!draggedRappel) return;

  draggedRappel.style.display = "none";

  let clientX, clientY;
  if (e.type.startsWith("touch")) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  const elem = document.elementFromPoint(clientX, clientY);
  draggedRappel.style.display = "";

  const newDateDiv = elem ? elem.closest(".date") : null;
  const taskId = draggedRappel.dataset.id;
  const originalRappelDate = draggedRappel.dataset.rappelDate;

  if (!taskId) {
    draggedRappel = null;
    return;
  }

  const docRef = doc(db, "devoirs", taskId);
  const taskDoc = await getDoc(docRef);
  const taskData = taskDoc.exists() ? taskDoc.data() : null;
  const controlDate = taskData ? new Date(taskData.year, taskData.month, taskData.day) : null;

  if (!newDateDiv) {
    await deleteDoc(doc(db, "devoirs", taskId));
    draggedRappel.remove();
    await renderCalendar(currentYear, currentMonth);
  } else {
    let newDateStr = newDateDiv.dataset.date;
    const today = new Date(); today.setHours(0,0,0,0);
    const newDate = parseDate(newDateStr);

    if (newDate < today || (controlDate && newDate > controlDate)) {
      alert("Tu peux pas mettre un rappel avant aujourd’hui ou après la date du contrôle, date remise à l'origine.");
      newDateStr = originalRappelDate;
    }

    if (originalRappelDate !== newDateStr) {
      await updateDoc(docRef, { rappelDate: newDateStr });
    }
    await renderCalendar(currentYear, currentMonth);
  }

  // reset style
  draggedRappel.style.position = "relative";
  draggedRappel.style.left = "";
  draggedRappel.style.top = "";
  draggedRappel.style.zIndex = "";
  draggedRappel.style.pointerEvents = "";
  draggedRappel = null;
}

/* ================== Modal handlers (add/edit) ================== */
function openModal(dateStr, taskId = null, taskData = null) {
  const selectedDateObj = parseDate(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Bloque ajout sur date passée
  if (selectedDateObj < today && !taskId) {
      alert("Tu peux pas ajouter un devoir sur une date passée !");
      return;
  }

  selectedDate = dateStr;
  editingTaskId = taskId;
  modalBg.style.display = "flex";
  modalTitle.textContent = taskId ? "Modifier le devoir" : "Ajouter un devoir";

  matiereInput.value = taskData?.matiere || "";
  titreInput.value = taskData?.titre || "";
  dateInput.value = dateStr;
  rappelCheckbox.checked = taskData?.rappel ?? true;

  deleteBtn.style.display = taskId ? "inline-block" : "none";
}

cancelBtn.addEventListener("click", () => { modalBg.style.display = "none"; });

deleteBtn.addEventListener("click", async () => {
  if (editingTaskId) {
    await deleteDoc(doc(db, "devoirs", editingTaskId));
    modalBg.style.display = "none";
    await renderCalendar(currentYear, currentMonth);
  }
});

taskForm.addEventListener("submit", async e => {
  e.preventDefault();
  ensureAuthed();
  const matiere = matiereInput.value.trim();
  const titre = titreInput.value.trim();
  const dateVal = dateInput.value;
  const rappel = rappelCheckbox.checked;

  if (!matiere || !titre || !dateVal) { alert("Remplis tous les champs"); return; }

  const d = parseDate(dateVal);
  const data = { matiere, titre, rappel, year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), ownerUid: currentUser.uid };

  if (editingTaskId) {
    await updateDoc(doc(db, "devoirs", editingTaskId), data);
  } else {
    await addDoc(collection(db, "devoirs"), data);
  }
  modalBg.style.display = "none";
  await renderCalendar(currentYear, currentMonth);
});

/* ================== Day tasks modal ================== */
function openDayTasksModal(dateStr) {
  dayTasksBg.style.display = "flex";
  dayTasksTitle.textContent = `Devoirs du ${dateStr}`;
  dayTasksList.innerHTML = "";
  selectedDate = dateStr;

  document.querySelectorAll(`.date[data-date="${dateStr}"] .task`).forEach(taskDiv => {
    const div = document.createElement("div");
    div.textContent = taskDiv.textContent;
    dayTasksList.appendChild(div);
  });
}
dayTasksCloseBtn.addEventListener("click", () => { dayTasksBg.style.display = "none"; });
dayTasksAddBtn.addEventListener("click", () => { openModal(selectedDate); dayTasksBg.style.display = "none"; });

/* ================== Navigation buttons ================== */
prevMonthBtn.addEventListener("click", () => {
  let m = currentMonth - 1;
  let y = currentYear;
  if (m < 0) { m = 11; y -= 1; }
  renderCalendar(y, m);
});
nextMonthBtn.addEventListener("click", () => {
  let m = currentMonth + 1;
  let y = currentYear;
  if (m > 11) { m = 0; y += 1; }
  renderCalendar(y, m);
});

settingsBtn.addEventListener("click", () => { openParams(); });

/* ================== Bot: récupérer creds déchiffrés ================== */
/**
 * À appeler côté app/bot quand tu dois te connecter à l'école.
 * Retourne { identifiant, motdepasse } en clair (en mémoire seulement).
 * Le stockage Firestore reste chiffré.
 */
export async function getEcoleCredentials() { // export si tu importes ce module ailleurs
  ensureAuthed();
  const snap = await getDoc(doc(db, "users", currentUser.uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  const identifiant = data.ecoleUser || "";
  const motdepasse = decryptText(data.ecolePass || "");
  return { identifiant, motdepasse };
}

/* ================== Init on load ================== */
(async () => {
  await ensureServiceWorkerRegistered();

  const now = new Date();
  if (currentYear === null) currentYear = now.getFullYear();
  if (currentMonth === null) currentMonth = now.getMonth();

  try {
    if (auth.currentUser) {
      currentUser = auth.currentUser;
      await loadUserSettingsOrAsk();
      await renderCalendar(currentYear, currentMonth);
      listenForegroundNotifications();
      if (!fcmInitialized) await enableNotificationsForCurrentUser();
    } else {
      if (loginBg) loginBg.style.display = "flex";
    }
  } catch (e) {
    console.error("Init error:", e);
  }
})();

/* ================== (Optionnel) Expose quelques actions pour debug dans la console ================== */
window.__appDebug = {
  getEcoleCredentials,
  encryptText,
  decryptText,
  logout: () => signOut(auth)
};

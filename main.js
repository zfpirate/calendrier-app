/* ============================================================
   main.js - Calendrier Devoirs (version mise à jour : rappels séparés et draggables mobile/pc)
   ============================================================ */

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
const SECRET_KEY = "3k8$Pq9!mZr2@xLw7#yT";
function assertCryptoReady() {
  if (typeof CryptoJS === "undefined" || !CryptoJS.AES) {
    console.error("❌ CryptoJS introuvable. Ajoute le script CDN avant main.js");
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

/* ================== FCM setup ================== */
let messaging = null;
let fcmSupported = false;
let fcmInitialized = false;
(async () => {
  fcmSupported = await messagingIsSupported().catch(() => false);
  if (fcmSupported) messaging = getMessaging(app);
})();

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

const VAPID_KEY = "BEk1IzaUQOXzKFu7RIkILgmWic1IgWfMdAECHofkTC5D5kmUY6tC0lWVIUtqCyHdrD96aiccAYW5A00PTQHYBZM";

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
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg ?? undefined });
    if (!token) {
      console.warn("Aucun token FCM récupéré (contexte / permission).");
      return null;
    }
    console.log("🔑 FCM token:", token);
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

function listenForegroundNotifications() {
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    console.log("📩 Notif foreground:", payload);
    const t = payload?.notification?.title || "Notification";
    const b = payload?.notification?.body || "";
    try { new Notification(t, { body: b, icon: payload?.notification?.icon }); }
    catch { alert(`${t}\n${b}`); }
  });
}

/* ================== DOM references ================== */
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

/* ================== Helpers ================== */
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

/* ================== Calendar render & tasks ================== */
async function renderCalendar(year, month) {
  try { ensureAuthed(); } catch (e) { calendar.innerHTML = "<div class='not-logged'>Connecte-toi pour voir le calendrier</div>"; if (monthYear) monthYear.textContent = ""; return; }

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
/**
 * IMPORTANT:
 * - crée 2 éléments par devoir :
 *    - .task : affichage contrôle (non-draggable)
 *    - .rappel : élément draggable (mobile + pc) qui représente le rappel (peut être sur autre date)
 */
async function loadTasks(year, month) {
  ensureAuthed();
  try {
    const q = query(
      collection(db, "devoirs"),
      where("ownerUid", "==", currentUser.uid),
      where("year", "==", year),
      where("month", "==", month)
    );
    const snap = await getDocs(q);

    // Pour éviter doublons si loadTasks appelé plusieurs fois
    // (on recrée le calendrier à chaque render donc containers vides)

    snap.forEach(docSnap => {
      const data = docSnap.data();
      // 1) ajoute affichage du contrôle (dans la case de la date de contrôle)
      const controlDateKey = formatDate(new Date(data.year, data.month, data.day));
      const controlContainer = document.querySelector(`.date[data-date="${controlDateKey}"] .tasks`);
      if (controlContainer) {
        const taskDiv = document.createElement("div");
        taskDiv.className = "task";
        taskDiv.textContent = `${data.matiere} - ${data.titre}`;
        taskDiv.dataset.id = docSnap.id;
        // double-clic ouvre édition
        taskDiv.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          editingTaskId = docSnap.id;
          modalTitle.textContent = "Modifier le devoir";
          matiereInput.value = data.matiere || "";
          titreInput.value = data.titre || "";
          // dateInput is control date (not rappel)
          dateInput.value = controlDateKey;
          rappelCheckbox.checked = !!data.rappel;
          deleteBtn.style.display = "inline-block";
          modalBg.style.display = "flex";
        });
        controlContainer.appendChild(taskDiv);
      }

      // 2) ajoute l'élément rappel (draggable) dans la case correspondant à data.rappelDate
      const rappelDateKey = data.rappelDate || controlDateKey;
      const rappelContainer = document.querySelector(`.date[data-date="${rappelDateKey}"] .tasks`);
      if (rappelContainer) {
        const rappelDiv = document.createElement("div");
        rappelDiv.className = "rappel";
        // petit badge pour savoir que c'est un rappel
        rappelDiv.style.backgroundColor = "#FF6E00"; // orange pour rappel
        rappelDiv.style.color = "#fff";

        // 🎨 Style du rappel : fond sombre + barre orange + texte orange
        rappelDiv.style.backgroundColor = "#1E1E1E"; // fond sombre
       rappelDiv.style.borderLeft = "5px solid #FF6E00"; // barre orange flashy
       rappelDiv.style.color = "#FF6E00"; // texte même couleur que la barre

        rappelDiv.textContent = `🔔 ${data.matiere} - ${data.titre}`;
        rappelDiv.dataset.id = docSnap.id;
        rappelDiv.dataset.controlDate = controlDateKey;
        rappelDiv.dataset.rappelDate = rappelDateKey;
        // draggable handlers (pc + mobile)
        rappelDiv.addEventListener("mousedown", (e) => startDrag(e, rappelDiv));
        rappelDiv.addEventListener("touchstart", (e) => startDrag(e, rappelDiv));
        // click on rappel => open day tasks / or edit on dblclick
        rappelDiv.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          // open edit modal using control date and data
          editingTaskId = docSnap.id;
          modalTitle.textContent = "Modifier le devoir";
          matiereInput.value = data.matiere || "";
          titreInput.value = data.titre || "";
          dateInput.value = data.rappelDate || controlDateKey; // show control date, but ok
          rappelCheckbox.checked = !!data.rappel;
          deleteBtn.style.display = "inline-block";
          modalBg.style.display = "flex";
        });

        rappelContainer.appendChild(rappelDiv);
      }
    });
  } catch (e) {
    console.error("Erreur loadTasks:", e);
  }
}

/* ================== Drag & Drop (rappels) ================== */
function startDrag(e, rappelTaskDiv) {
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

async function stopDragRappel(e) {
  if (!draggedRappel) return;

  // hide temporarily so elementFromPoint is accurate
  draggedRappel.style.display = "none";

  let clientX, clientY;
  if (e.type && e.type.startsWith && e.type.startsWith("touch")) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  const elem = document.elementFromPoint(clientX, clientY);
  // restore display
  draggedRappel.style.display = "";

  const newDateDiv = elem ? elem.closest(".date") : null;
  const taskId = draggedRappel.dataset.id;
  const originalRappelDate = draggedRappel.dataset.rappelDate;
  const controlDateKey = draggedRappel.dataset.controlDate;

  if (!taskId) {
    draggedRappel = null;
    return;
  }

  try {
    const docRef = doc(db, "devoirs", taskId);
    const taskDoc = await getDoc(docRef);
    const taskData = taskDoc.exists() ? taskDoc.data() : null;
    const controlDate = taskData ? new Date(taskData.year, taskData.month, taskData.day) : null;

    if (!newDateDiv) {
      // déposé hors calendrier -> suppression totale du devoir
      await deleteDoc(doc(db, "devoirs", taskId));
      if (draggedRappel && draggedRappel.parentNode) draggedRappel.parentNode.removeChild(draggedRappel);
      await renderCalendar(currentYear, currentMonth);
    } else {
      let newDateStr = newDateDiv.dataset.date;
      const today = new Date(); today.setHours(0, 0, 0, 0);
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
  } catch (err) {
    console.error("stopDragRappel erreur:", err);
  } finally {
    // reset style
    try {
      if (draggedRappel) {
        draggedRappel.style.position = "relative";
        draggedRappel.style.left = "";
        draggedRappel.style.top = "";
        draggedRappel.style.zIndex = "";
        draggedRappel.style.pointerEvents = "";
      }
    } catch {}
    draggedRappel = null;
  }
}

/* ================== Modal handlers (add/edit) ================== */
function openModal(dateStr, taskId = null, taskData = null) {
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

function closeModal() {
  modalBg.style.display = "none";
  editingTaskId = null;
  taskForm.reset();
  deleteBtn.style.display = "none";
}

cancelBtn.addEventListener("click", () => { closeModal(); });

deleteBtn.addEventListener("click", async () => {
  if (editingTaskId) {
    try {
      await deleteDoc(doc(db, "devoirs", editingTaskId));
      closeModal();
      await renderCalendar(currentYear, currentMonth);
    } catch (e) {
      console.error("Erreur suppression devoir:", e);
    }
  }
});

/* ================== Task form submit ================== */
/**
 * Lors de la création/édition :
 * - dateInput = date du contrôle (obligatoire)
 * - rappelCheckbox = créer rappel oui/non
 * - rappelDate sera calculée = controleDate - defaultReminder jours (min = today)
 */
taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try { ensureAuthed(); } catch { alert("Connecte-toi d'abord."); return; }

  const matiere = matiereInput.value.trim();
  const titre = titreInput.value.trim();
  const dateVal = dateInput.value;
  const rappel = !!rappelCheckbox.checked;

  if (!matiere || !titre || !dateVal) { alert("Remplis tous les champs"); return; }

  const controlDate = parseDate(dateVal);
  const year = controlDate.getFullYear();
  const month = controlDate.getMonth();
  const day = controlDate.getDate();

  // calcul rappelDate par défaut : controlDate - defaultReminder (mais pas avant aujourd'hui)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let rappelDateObj = new Date(controlDate);
  if (rappel) {
    rappelDateObj.setDate(rappelDateObj.getDate() - (Number(defaultReminder) || 0));
    if (rappelDateObj < today) rappelDateObj = today;
  } else {
    // si pas de rappel on met rappelDate = controlDate (ou vide), mais pour logique on conserve controlDate
    rappelDateObj = controlDate;
  }
  const rappelDateStr = formatDate(rappelDateObj);

  const data = {
    matiere,
    titre,
    rappel,
    year,
    month,
    day,
    ownerUid: currentUser.uid,
    rappelDate: rappelDateStr
  };

  try {
    if (editingTaskId) {
      await updateDoc(doc(db, "devoirs", editingTaskId), data);
    } else {
      await addDoc(collection(db, "devoirs"), data);
    }
    closeModal();
    await renderCalendar(currentYear, currentMonth);
  } catch (e) {
    console.error("Erreur save devoir:", e);
    alert("Erreur en sauvegardant le devoir.");
  }
});

/* ================== Day tasks modal ================== */
function openDayTasksModal(dateStr) {
  ensureAuthed();
  dayTasksBg.style.display = "flex";
  dayTasksTitle.textContent = `Devoirs du ${dateStr}`;
  dayTasksList.innerHTML = "";
  selectedDate = dateStr;
  refreshDayTasksList(dateStr);
}
dayTasksCloseBtn.addEventListener("click", () => { dayTasksBg.style.display = "none"; });

dayTasksAddBtn.addEventListener("click", () => {
  openModal(selectedDate);
  dayTasksBg.style.display = "none";
});

async function refreshDayTasksList(dateStr) {
  try {
    const q = query(collection(db, "devoirs"), where("ownerUid", "==", currentUser.uid), where("rappelDate", "==", dateStr));
    const snap = await getDocs(q);
    dayTasksList.innerHTML = "";
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const div = document.createElement("div");
      div.className = "day-task";
      div.textContent = `${data.matiere} - ${data.titre}`;
      div.dataset.id = docSnap.id;
      div.addEventListener("dblclick", () => {
        editingTaskId = docSnap.id;
        openModal(dateStr, docSnap.id, data);
      });
      dayTasksList.appendChild(div);
    });
  } catch (e) {
    console.error("refreshDayTasksList:", e);
  }
}

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

/* ================== Params modal (settings) ================== */
function openParams() {
  ensureAuthed();
  userIdInput.value = currentUserDoc?.ecoleUser || "";
  const enc = currentUserDoc?.ecolePass;
  userPassInput.value = enc ? decryptText(enc) : "";
  defaultReminderInput.value = currentUserDoc?.defaultReminder ?? defaultReminder ?? 1;
  paramsBg.style.display = "flex";
}
paramsCancelBtn.addEventListener("click", () => { paramsBg.style.display = "none"; });

paramsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try { ensureAuthed(); } catch { alert("Connecte-toi d'abord."); return; }

  const ecoleUser = userIdInput.value.trim();
  const ecolePassPlain = userPassInput.value.trim();
  const reminderVal = parseInt(defaultReminderInput.value, 10);
  if (!ecoleUser || !ecolePassPlain || isNaN(reminderVal) || reminderVal < 0 || reminderVal > 365) {
    alert("Remplis les paramètres correctement (jours de rappel: 0-365).");
    return;
  }

  const ecolePass = encryptText(ecolePassPlain);
  const userRef = doc(db, "users", currentUser.uid);
  const data = { ecoleUser, ecolePass, defaultReminder: reminderVal };
  try {
    await setDoc(userRef, data, { merge: true });
    currentUserDoc = { ...(currentUserDoc || {}), ...data };
    defaultReminder = reminderVal;
    paramsBg.style.display = "none";
    await renderCalendar(currentYear, currentMonth);
    console.log("✅ Paramètres sauvegardés (mdp chiffré).");
  } catch (e) {
    console.error("Erreur sauvegarde paramètres", e);
    alert("Erreur: impossible d’enregistrer.");
  }
});

/* ================== Auth UI handlers ================== */
loginSubmitBtn?.addEventListener("click", async () => {
  const email = loginUserInput.value?.trim();
  const pass = loginPassInput.value?.trim();
  if (!email || !pass) { alert("Email / mot de passe requis."); return; }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    loginBg.style.display = "none";
  } catch (e) {
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      loginBg.style.display = "none";
    } catch (err) {
      console.error("Auth error:", err);
      alert("Erreur connexion/inscription : " + (err.message || err));
    }
  }
});
loginGoogleBtn?.addEventListener("click", async () => {
  try { await loginWithGoogleUIFlow(); loginBg.style.display = "none"; } catch (e) { console.error("Google login error:", e); alert("Erreur login Google"); }
});

/* ================== onAuthStateChanged - main flow ================== */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    if (loginBg) loginBg.style.display = "none";

    try { await loadUserSettingsOrAsk(); } catch (e) { console.warn("loadUserSettingsOrAsk failed:", e); }

    try {
      const now = new Date();
      currentYear = now.getFullYear();
      currentMonth = now.getMonth();
      await renderCalendar(currentYear, currentMonth);
    } catch (e) { console.error("renderCalendar error:", e); }

    await ensureServiceWorkerRegistered();
    listenForegroundNotifications();
    if (!fcmInitialized) await enableNotificationsIfAuto().catch(() => {});
  } else {
    currentUser = null;
    if (loginBg) loginBg.style.display = "flex";
    calendar.innerHTML = "<div class='not-logged'>Connecte-toi pour voir le calendrier</div>";
    if (monthYear) monthYear.textContent = "";
  }
});

async function enableNotificationsIfAuto() {
  try {
    if (!currentUser) return;
    const uRef = doc(db, "users", currentUser.uid);
    const snap = await getDoc(uRef);
    const auto = snap.exists() && snap.data().autoEnableNotifications;
    if (auto) await enableNotificationsForCurrentUser();
  } catch (e) {
    console.warn("autoEnableNotifications check failed", e);
  }
}

/* ================== Export helper for bot/app usage ================== */
export async function getEcoleCredentials() {
  ensureAuthed();
  const snap = await getDoc(doc(db, "users", currentUser.uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  const identifiant = data.ecoleUser || "";
  const motdepasse = decryptText(data.ecolePass || "");
  return { identifiant, motdepasse };
}

/* ================== Trash interactions (drag hint) ================== */
trashDiv?.addEventListener("mouseenter", () => { trashDiv.classList.add("over"); });
trashDiv?.addEventListener("mouseleave", () => { trashDiv.classList.remove("over"); });

/* ================== Debug helpers exposed globally ================== */
window.__appDebug = { getEcoleCredentials, encryptText, decryptText, logout: () => signOut(auth) };

/* ================== Init on load ================== */
(async () => {
  await ensureServiceWorkerRegistered().catch(() => {});
  try {
    if (auth.currentUser) {
      currentUser = auth.currentUser;
      await loadUserSettingsOrAsk().catch(console.error);
      const now = new Date();
      currentYear = now.getFullYear();
      currentMonth = now.getMonth();
      await renderCalendar(currentYear, currentMonth);
      listenForegroundNotifications();
      if (!fcmInitialized) await enableNotificationsIfAuto();
    } else {
      if (loginBg) loginBg.style.display = "flex";
    }
  } catch (e) {
    console.error("Init error:", e);
  }
})();


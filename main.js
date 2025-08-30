/* ================== main.js - Calendrier Devoirs (corrigé) ================== */

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

/* ================== Crypto helper (CryptoJS must be in HTML) ================== */
const SECRET_KEY = "3k8$Pq9!mZr2@xLw7#yT";
function assertCryptoReady() {
  if (typeof CryptoJS === "undefined" || !CryptoJS.AES) {
    console.error("❌ CryptoJS introuvable. Ajoute le script CDN avant main.js");
    throw new Error("CryptoJS non chargé");
  }
}
function encryptText(plain) {
  assertCryptoReady();
  return CryptoJS.AES.encrypt(String(plain ?? ""), SECRET_KEY).toString();
}
function decryptText(cipher) {
  assertCryptoReady();
  if (!cipher) return "";
  try {
    return CryptoJS.AES.decrypt(cipher, SECRET_KEY).toString(CryptoJS.enc.Utf8) || "";
  } catch (e) {
    console.warn("⚠️ Échec déchiffrement", e);
    return "";
  }
}

/* ================== FCM setup (optional) ================== */
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
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg ?? undefined
    });
    if (!token) {
      console.warn("Aucun token FCM récupéré (contexte / permission).");
      return null;
    }
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
const heureInput = document.getElementById("heure"); // time input in task modal
const rappelCheckbox = document.getElementById("rappel");
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

/* ================== State ================== */
let currentYear = null;
let currentMonth = null;
let selectedDate = null;
let editingTaskId = null;
let defaultReminder = 1;
let defaultHour = "18:00";
let draggedRappel = null;
let offsetX = 0;
let offsetY = 0;
let currentUser = null;
let currentUserDoc = null;

// preserve rappelDate when editing existing tasks (so drag-preserved date isn't overwritten)
let preservedRappelDate = null;

/* ================== Helpers (format/parse) ================== */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseDate(str) {
  if (!str) return new Date(NaN);
  const [y, m, d] = (str || "").split("-").map(Number);
  return new Date(y, m - 1, d);
}
function ensureAuthed() {
  if (!currentUser) {
    if (loginBg) loginBg.style.display = "flex";
    throw new Error("User not authenticated");
  }
}

/* ================== Load user settings ================== */
async function loadUserSettingsOrAsk() {
  ensureAuthed();
  try {
    const userRef = doc(db, "users", currentUser.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      currentUserDoc = snap.data();
      defaultReminder = Number(currentUserDoc.defaultReminder ?? 1) || 1;
      defaultHour = currentUserDoc.defaultHour ?? defaultHour ?? "18:00";
    } else {
      openParams();
    }
  } catch (e) {
    console.error("Erreur lecture users/{uid}", e);
  }
}

/* ================== Calendar render ================== */
async function renderCalendar(year, month) {
  try { ensureAuthed(); } catch (e) {
    calendar.innerHTML = "<div class='not-logged'>Connecte-toi pour voir le calendrier</div>";
    if (monthYear) monthYear.textContent = "";
    return;
  }

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
  let startDay = (firstDayOfMonth.getDay() + 6) % 7; // Monday-first
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

    dayDiv.addEventListener("click", (e) => {
      // only if clicking the cell (not a child)
      if (e.target !== dayDiv && !e.target.classList.contains('date')) return;
      openDayTasksModal(dateStr);
    });

    calendar.appendChild(dayDiv);
  }

  await loadTasks(year, month);
}

/* ================== Load tasks (Firestore) ================== */
/**
 * loadTasks : charge les devoirs pour ownerUid == currentUser.uid et
 * place :
 *  - une "task" (control) dans la case du devoir (date)
 *  - un "rappel" draggble dans la case correspondant à rappelDate (peut être control date)
 */
async function loadTasks(year, month) {
  ensureAuthed();
  try {
    const q = query(
      collection(db, "devoirs"),
      where("ownerUid", "==", currentUser.uid)
    );
    const snap = await getDocs(q);

    // Clear all tasks containers
    document.querySelectorAll(".date .tasks").forEach(t => t.innerHTML = "");

    snap.forEach(docSnap => {
      const data = docSnap.data();
      // compute control date (some docs use date string, some use year/month/day)
      let controlKey = data.date;
      if (!controlKey && typeof data.year !== "undefined") {
        controlKey = formatDate(new Date(data.year, data.month, data.day));
      }

      // ensure controlKey well-formed
      if (!controlKey) return;

      const controlContainer = document.querySelector(`.date[data-date="${controlKey}"] .tasks`);
      if (controlContainer) {
        const taskDiv = document.createElement("div");
        taskDiv.className = "task";
        taskDiv.textContent = `${data.matiere} - ${data.titre}`;
        taskDiv.dataset.id = docSnap.id;
        // Prevent cell click from opening day modal
        taskDiv.addEventListener("click", (e) => e.stopPropagation());
        // Double-click edit
        taskDiv.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          editingTaskId = docSnap.id;
          // preserve stored rappelDate when editing so drag date won't be lost
          preservedRappelDate = data.rappelDate || controlKey;
          closePanelsAndOpenModal(controlKey, docSnap.id, data);
        });
        controlContainer.appendChild(taskDiv);
      }

      // Rappel element (draggable) placed on data.rappelDate or controlKey
      const rappelKey = data.rappelDate || controlKey;
      const rappelContainer = document.querySelector(`.date[data-date="${rappelKey}"] .tasks`);
      if (rappelContainer) {
        const rappelDiv = document.createElement("div");
        rappelDiv.className = "rappel";
        // Theme: dark bg + left orange bar + orange text
        rappelDiv.style.backgroundColor = "#1E1E1E";
        rappelDiv.style.borderLeft = "5px solid #FF6E00";
        rappelDiv.style.color = "#FF6E00";
        rappelDiv.style.padding = "6px";
        rappelDiv.style.margin = "4px 0";
        rappelDiv.style.borderRadius = "4px";
        rappelDiv.style.cursor = "grab";

        const heureLabel = data.heure ? ` (${data.heure})` : "";
        rappelDiv.textContent = `🔔 ${data.matiere} - ${data.titre}${heureLabel}`;

        rappelDiv.dataset.id = docSnap.id;
        rappelDiv.dataset.controlDate = controlKey;
        rappelDiv.dataset.rappelDate = rappelKey;

        // prevent parent click
        rappelDiv.addEventListener("click", (e) => e.stopPropagation());

        // desktop drag API
        rappelDiv.setAttribute("draggable", "true");
        rappelDiv.addEventListener("dragstart", (ev) => {
          draggedRappel = rappelDiv;
          const rect = rappelDiv.getBoundingClientRect();
          offsetX = ev.clientX - rect.left;
          offsetY = ev.clientY - rect.top;
          rappelDiv.classList.add("dragging");
        });
        rappelDiv.addEventListener("dragend", async (ev) => {
          if (!draggedRappel) return;
          const target = document.elementFromPoint(ev.clientX, ev.clientY);
          await handleDropOnTarget(target, draggedRappel);
          rappelDiv.classList.remove("dragging");
          draggedRappel = null;
        });

        // touch drag (mobile)
        rappelDiv.addEventListener("touchstart", (ev) => {
          ev.preventDefault();
          draggedRappel = rappelDiv;
          const rect = rappelDiv.getBoundingClientRect();
          offsetX = ev.touches[0].clientX - rect.left;
          offsetY = ev.touches[0].clientY - rect.top;
          rappelDiv.style.position = "absolute";
          rappelDiv.style.zIndex = 2000;
          document.body.appendChild(rappelDiv);
          moveElementAt(rappelDiv, ev.touches[0].pageX, ev.touches[0].pageY, offsetX, offsetY);
        });
        rappelDiv.addEventListener("touchmove", (ev) => {
          if (!draggedRappel) return;
          moveElementAt(rappelDiv, ev.touches[0].pageX, ev.touches[0].pageY, offsetX, offsetY);
        });
        rappelDiv.addEventListener("touchend", async (ev) => {
          if (!draggedRappel) return;
          const t = ev.changedTouches[0];
          const target = document.elementFromPoint(t.clientX, t.clientY);
          await handleDropOnTarget(target, draggedRappel);
          draggedRappel = null;
        });

        // dblclick to edit (preserve rappelDate)
        rappelDiv.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          editingTaskId = docSnap.id;
          preservedRappelDate = data.rappelDate || rappelKey || controlKey;
          closePanelsAndOpenModal(controlKey, docSnap.id, data);
        });

        rappelContainer.appendChild(rappelDiv);
      }
    });
  } catch (e) {
    console.error("Erreur loadTasks:", e);
  }
}

/* move element helper (touch) */
function moveElementAt(elem, pageX, pageY, offX, offY) {
  elem.style.left = (pageX - offX) + "px";
  elem.style.top = (pageY - offY) + "px";
}

/* handle drop logic (desktop & mobile) */
async function handleDropOnTarget(targetElem, draggedElem) {
  try { draggedElem.style.display = ""; } catch {}
  const taskId = draggedElem.dataset.id;
  if (!taskId) return;

  const docRef = doc(db, "devoirs", taskId);
  const today = new Date(); today.setHours(0,0,0,0);

  // dropped on trash -> delete
  if (targetElem && (targetElem === trashDiv || (trashDiv && trashDiv.contains(targetElem)))) {
    try {
      await deleteDoc(docRef);
    } catch (e) {
      console.error("Erreur suppression lors du drop:", e);
    }
    await renderCalendar(currentYear, currentMonth);
    return;
  }

  // find date cell
  const dateCell = targetElem ? (targetElem.closest ? targetElem.closest(".date") : null) : null;
  if (!dateCell) {
    await renderCalendar(currentYear, currentMonth);
    return;
  }

  const newDateStr = dateCell.dataset.date;

  try {
    const taskSnap = await getDoc(docRef);
    const taskData = taskSnap.exists() ? taskSnap.data() : null;
    const controlDate = taskData ? new Date(taskData.year, taskData.month, taskData.day) : null;
    const newDate = parseDate(newDateStr);

    if (newDate < today || (controlDate && newDate > controlDate)) {
      alert("Tu peux pas mettre un rappel avant aujourd’hui ou après la date du contrôle. Remise à l'origine.");
      await renderCalendar(currentYear, currentMonth);
      return;
    }

    if (taskData && taskData.rappelDate !== newDateStr) {
      await updateDoc(docRef, { rappelDate: newDateStr });
    }
    await renderCalendar(currentYear, currentMonth);
  } catch (err) {
    console.error("stopDrag erreur:", err);
  }
}

/* ================== Small helper: close other panels and open modal ================== */
function closePanelsAndOpenModal(dateStr, taskId = null, taskData = null) {
  // close panels to ensure modal is on top
  try { dayTasksBg.style.display = "none"; } catch {}
  try { paramsBg.style.display = "none"; } catch {}
  try { closeModal(); } catch {}
  // then open
  openModal(dateStr, taskId, taskData);
}

/* ================== Modal handlers (add/edit) ================== */
function openModal(dateStr, taskId = null, taskData = null) {
  selectedDate = dateStr;
  editingTaskId = taskId;

  // ensure other panels closed
  try { dayTasksBg.style.display = "none"; } catch {}
  try { paramsBg.style.display = "none"; } catch {}

  modalBg.style.zIndex = "9999";
  modalBg.style.display = "flex";
  modalTitle.textContent = taskId ? "Modifier le devoir" : "Ajouter un devoir";

  matiereInput.value = taskData?.matiere || "";
  titreInput.value = taskData?.titre || "";

  // DATE INPUT should show the control date (date of the devoir) NOT the rappel date
  let controlDateValue = "";
  if (taskData?.date) controlDateValue = taskData.date;
  else if (typeof taskData?.year !== "undefined") controlDateValue = formatDate(new Date(taskData.year, taskData.month, taskData.day));
  else controlDateValue = dateStr || "";

  dateInput.value = controlDateValue;
  rappelCheckbox.checked = typeof taskData?.rappel === "boolean" ? taskData.rappel : true;
  heureInput.value = taskData?.heure || defaultHour;

  // preservedRappelDate was set earlier when opening edit, otherwise compute a default
  if (!preservedRappelDate) {
    // compute fallback default from control date and defaultReminder
    const cd = parseDate(controlDateValue);
    const r = new Date(cd);
    r.setDate(r.getDate() - (Number(defaultReminder) || 0));
    const today = new Date(); today.setHours(0,0,0,0);
    if (r < today) r.setTime(today.getTime());
    preservedRappelDate = formatDate(r);
  }

  deleteBtn.style.display = taskId ? "inline-block" : "none";

  try { matiereInput.focus(); } catch {}
}

function closeModal() {
  try { modalBg.style.display = "none"; } catch {}
  editingTaskId = null;
  try { taskForm.reset(); } catch {}
  try { deleteBtn.style.display = "none"; } catch {}
  preservedRappelDate = null;
}

cancelBtn.addEventListener("click", () => { closeModal(); });

deleteBtn.addEventListener("click", async () => {
  if (!editingTaskId) return;
  try {
    await deleteDoc(doc(db, "devoirs", editingTaskId));
    closeModal();
    await renderCalendar(currentYear, currentMonth);
  } catch (e) {
    console.error("Erreur suppression devoir:", e);
    alert("Impossible de supprimer le devoir.");
  }
});

/* ================== Single unified submit (create/edit) ================== */
/* ================== Double-clic sur rappel / Modifier ================== */
function openRappelForEdit(rappelId, dateRappel) {
  ensureAuthed();
  selectedDate = dateRappel; // garde la date du rappel sélectionnée

  // récupère les données du doc
  const docRef = doc(db, "devoirs", rappelId);
  getDoc(docRef).then((snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

    editingTaskId = rappelId;
    modalBg.style.display = "flex";
    modalTitle.textContent = "Modifier le devoir";

    matiereInput.value = data.matiere || "";
    titreInput.value = data.titre || "";
    dateInput.value = data.date || selectedDate; // la date originale du devoir
    heureInput.value = data.heure || defaultHour;
    rappelCheckbox.checked = !!data.rappel;

    deleteBtn.style.display = "inline-block";
  }).catch(err => console.error("Erreur récupération rappel:", err));
}

/* ================== Submit modal (create / edit) ================== */
taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return alert("Connecte-toi avant !");

  const matiere = matiereInput.value.trim();
  const titre = titreInput.value.trim();
  const dateVal = dateInput.value;
  const rappel = !!rappelCheckbox.checked;
  const heure = heureInput.value || defaultHour;

  if (!matiere || !titre || !dateVal) return alert("Remplis tous les champs !");

  const controlDate = parseDate(dateVal);
  const today = new Date(); today.setHours(0,0,0,0);

  let rappelDateObj = new Date(controlDate);
  if (rappel) {
    rappelDateObj.setDate(rappelDateObj.getDate() - (Number(defaultReminder) || 0));
    if (rappelDateObj < today) rappelDateObj = today;
  } else {
    rappelDateObj = controlDate;
  }
  const rappelDateStr = formatDate(rappelDateObj);

  const taskData = {
    matiere,
    titre,
    date: dateVal,
    heure,
    rappel,
    ownerUid: currentUser.uid,
    // NE PAS écraser rappelDate si c'est une édition
  };

  try {
    if (editingTaskId) {
      // Récupère l'ancien rappelDate et merge
      const docRef = doc(db, "devoirs", editingTaskId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const oldData = snap.data();
        taskData.rappelDate = oldData.rappelDate || rappelDateStr; // garde la date du rappel existante
      } else {
        taskData.rappelDate = rappelDateStr;
      }
      await updateDoc(docRef, taskData);
    } else {
      taskData.rappelDate = rappelDateStr;
      await addDoc(collection(db, "devoirs"), taskData);
    }
    closeModal();
    await renderCalendar(currentYear, currentMonth);
  } catch (err) {
    console.error("Erreur sauvegarde devoir:", err);
    alert("Erreur en sauvegardant le devoir. Vérifie la console pour err.code / err.message.");
  }
});


/* ================== Day tasks modal ================== */
function openDayTasksModal(dateStr) {
  try { modalBg.style.display = "none"; } catch {}
  dayTasksBg.style.display = "flex";
  dayTasksTitle.textContent = `Devoirs du ${dateStr}`;
  dayTasksList.innerHTML = "";
  selectedDate = dateStr;
  refreshDayTasksList(dateStr);
}
dayTasksCloseBtn.addEventListener("click", () => { dayTasksBg.style.display = "none"; });
dayTasksAddBtn.addEventListener("click", () => { dayTasksBg.style.display = "none"; openModal(selectedDate); });

async function refreshDayTasksList(dateStr) {
  try {
    const q = query(collection(db, "devoirs"), where("ownerUid", "==", currentUser.uid), where("rappelDate", "==", dateStr));
    const snap = await getDocs(q);
    dayTasksList.innerHTML = "";
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const div = document.createElement("div");
      div.className = "day-task";
      div.textContent = `${data.matiere} - ${data.titre}${data.heure ? " (" + data.heure + ")" : ""}`;
      div.dataset.id = docSnap.id;
      div.addEventListener("dblclick", () => {
        editingTaskId = docSnap.id;
        dayTasksBg.style.display = "none";
        preservedRappelDate = data.rappelDate || dateStr;
        openModal(formatDate(new Date(data.year, data.month, data.day)), docSnap.id, data);
      });
      dayTasksList.appendChild(div);
    });
  } catch (e) {
    console.error("refreshDayTasksList:", e);
  }
}

/* ================== Navigation buttons ================== */
prevMonthBtn?.addEventListener("click", () => {
  let m = currentMonth - 1;
  let y = currentYear;
  if (m < 0) { m = 11; y -= 1; }
  renderCalendar(y, m);
});
nextMonthBtn?.addEventListener("click", () => {
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
  defaultHourInput.value = currentUserDoc?.defaultHour ?? defaultHour ?? "18:00";
  paramsBg.style.display = "flex";
}

paramsCancelBtn.addEventListener("click", () => { paramsBg.style.display = "none"; });

paramsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try { ensureAuthed(); } catch { alert("Connecte-toi d'abord."); return; }

  const ecoleUser = userIdInput.value.trim();
  const ecolePassPlain = userPassInput.value.trim();
  const reminderVal = parseInt(defaultReminderInput.value, 10);
  const hourVal = defaultHourInput.value || "18:00";

  if (!ecoleUser || !ecolePassPlain || isNaN(reminderVal) || reminderVal < 0 || reminderVal > 365) {
    alert("Remplis les paramètres correctement (jours de rappel: 0-365).");
    return;
  }

  const ecolePass = encryptText(ecolePassPlain);
  const userRef = doc(db, "users", currentUser.uid);
  const data = {
    ecoleUser,
    ecolePass,
    defaultReminder: reminderVal,
    defaultHour: hourVal
  };

  try {
    await setDoc(userRef, data, { merge: true });
    currentUserDoc = { ...(currentUserDoc || {}), ...data };
    defaultReminder = reminderVal;
    defaultHour = hourVal;
    paramsBg.style.display = "none";
    await renderCalendar(currentYear, currentMonth);
    console.log("✅ Paramètres sauvegardés (mdp chiffré + heure).");
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
  try { await signInWithPopup(auth, new GoogleAuthProvider()); loginBg.style.display = "none"; }
  catch (e) { console.error("Google login error:", e); alert("Erreur login Google"); }
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
    if (!fcmInitialized) await enableNotificationsForCurrentUser().catch(() => {});
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

/* ================== Trash hover UI ================== */
trashDiv?.addEventListener("mouseenter", () => { trashDiv.classList.add("over"); });
trashDiv?.addEventListener("mouseleave", () => { trashDiv.classList.remove("over"); });

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

/* ================== Debug helpers ================== */
window.__appDebug = {
  getEcoleCredentials,
  encryptText,
  decryptText,
  logout: () => signOut(auth)
};

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
      if (!fcmInitialized) await enableNotificationsForCurrentUser();
    } else {
      if (loginBg) loginBg.style.display = "flex";
    }
  } catch (e) {
    console.error("Init error:", e);
  }
})();

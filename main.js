// ===================== main.js (adapté) =====================

// --- Import de l'app Firebase centralisée ---
import { app, db, auth } from "./firebase-config.js";

// --- Firestore functions ---
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// --- Auth functions ---
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

// --- Messaging (FCM) ---
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";

// ===================== Etat global =====================
let currentDate = new Date();
let selectedDate = null;
let currentUser = null;
let tasksByDate = {};
let allTasks = [];

let userSettings = {
  defaultReminderDays: 0,
  defaultHour: "18:00",
  defaultDayMode: "today",
};

// ===================== Helpers dates =====================
const pad2 = (n) => String(n).padStart(2, "0");
const toDateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayKey = () => toDateKey(new Date());

function parseDateTime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}`);
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function nextSchoolDay(date = new Date()) {
  const d = new Date(date);
  do { d.setDate(d.getDate() + 1); } while ([0,6].includes(d.getDay()));
  return d;
}

function clampReminderToFuture(reminderDate, reminderTime) {
  const now = new Date();
  const target = parseDateTime(reminderDate, reminderTime);
  if (target.getTime() <= now.getTime()) {
    const r = new Date(now.getTime() + 60_000);
    return { date: toDateKey(r), time: `${pad2(r.getHours())}:${pad2(r.getMinutes())}` };
  }
  return { date: reminderDate, time: reminderTime };
}

// ===================== FCM =====================
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

    if (currentUser) {
      await setDoc(doc(db, "fcmTokens", currentUser.uid), { token, updatedAt: new Date() });
      console.log("💾 Token FCM enregistré en base.");
    }

    onMessage(messaging, (payload) => {
      console.log("[FCM] Notification foreground:", payload);
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

// ===================== AuthState & FCM =====================
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    await loadUserSettings();
    renderCalendar();
    await loadTasksFromFirestore();
    loginBg.style.display = "none";

    // Initialiser FCM dès que connecté
    await initFCM();
  } else {
    loginBg.style.display = "flex";
    tasksByDate = {};
    allTasks = [];
    renderCalendar();
  }
});


// ===================== Sélecteurs DOM =====================
const elMonthYear = document.getElementById("monthYear");
const elCalendar = document.getElementById("calendar");
const btnPrev = document.getElementById("prev-month-btn");
const btnNext = document.getElementById("next-month-btn");
const btnSettings = document.getElementById("settings-btn");

const modalBg = document.getElementById("modal-bg");
const taskForm = document.getElementById("taskForm");
const inputMatiere = document.getElementById("matiere");
const inputTitre = document.getElementById("titre");
const inputDate = document.getElementById("date");
const inputHeure = document.getElementById("heure");
const inputRappel = document.getElementById("rappel");
const btnCancel = document.getElementById("cancel-btn");
const btnDelete = document.getElementById("delete-btn");
const modalTitle = document.getElementById("modal-title");

const paramsBg = document.getElementById("params-bg");
const paramsForm = document.getElementById("paramsForm");
const inputUserId = document.getElementById("userId");
const inputUserPass = document.getElementById("userPass");
const inputDefaultReminder = document.getElementById("defaultReminder");
const inputDefaultHour = document.getElementById("defaultHour");
const btnParamsCancel = document.getElementById("params-cancel-btn");

const dayTasksBg = document.getElementById("dayTasks-bg");
const dayTasksTitle = document.getElementById("dayTasks-title");
const dayTasksList = document.getElementById("dayTasks-list");
const dayTasksAddBtn = document.getElementById("dayTasks-add-btn");
const dayTasksCloseBtn = document.getElementById("dayTasks-close-btn");

const loginBg = document.getElementById("login-bg");
const loginUser = document.getElementById("loginUser");
const loginPass = document.getElementById("loginPass");
const loginSubmit = document.getElementById("loginSubmit");
const loginGoogle = document.getElementById("loginGoogle");

const trash = document.getElementById("trash");

// Pour édition
let editingTaskId = null;

// ===================== Rendu du calendrier (continu) =====================
function renderCalendar() {
  elCalendar.innerHTML = "";

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  elMonthYear.textContent = currentDate.toLocaleString("fr-FR", { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1);
  const startDay = (firstDay.getDay() + 6) % 7; // Lundi=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // En-têtes jours
  ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].forEach((label) => {
    const div = document.createElement("div");
    div.className = "day-name";
    div.textContent = label;
    elCalendar.appendChild(div);
  });

  // Cases vides avant le 1er
  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement("div");
    empty.className = "empty";
    elCalendar.appendChild(empty);
  }

  // Logique "continu" : si la dernière semaine du mois est affichée, on ajoute 2 semaines du mois suivant
  const lastWeekStart = daysInMonth - ((daysInMonth - startDay) % 7);
  const extraDays = (lastWeekStart >= daysInMonth - 7) ? 14 : 0;

  const totalDays = daysInMonth + extraDays;
  for (let day = 1; day <= totalDays; day++) {
    const isOverflow = day > daysInMonth;
    const displayNum = isOverflow ? (day - daysInMonth) : day;
    const dateObj = new Date(year, month, day);
    const dateKey = toDateKey(dateObj);

    const cell = document.createElement("div");
    cell.className = "date";
    if (isOverflow) cell.classList.add("continuous");
    cell.dataset.date = dateKey;

    const num = document.createElement("div");
    num.className = "num";
    num.textContent = displayNum;
    cell.appendChild(num);

    if (isSameDay(dateObj, new Date())) {
      cell.classList.add("today");
      const label = document.createElement("div");
      label.className = "today-label";
      label.textContent = "Aujourd'hui";
      cell.appendChild(label);
    }

    cell.addEventListener("click", () => openDayTasks(dateObj));

    // conteneur de tâches
    const tasksDiv = document.createElement("div");
    tasksDiv.className = "tasks";
    cell.appendChild(tasksDiv);

    elCalendar.appendChild(cell);
  }

  // injecter les tâches déjà chargées en cache
  injectTasksIntoCalendar();
}

// Injecte tasksByDate dans la grille existante
function injectTasksIntoCalendar() {
  document.querySelectorAll(".date").forEach((cell) => {
    const date = cell.dataset.date;
    const tasksDiv = cell.querySelector(".tasks");
    tasksDiv.innerHTML = "";

    (tasksByDate[date] || []).forEach((task) => {
      const t = document.createElement("div");
      t.className = "task" + (task.isReminder ? " rappel" : "");
      t.textContent = task.title;
      t.title = task.subject ? `${task.subject} — ${task.title}` : task.title;
      t.draggable = true;

      t.addEventListener("click", (e) => {
        e.stopPropagation();
        openTaskEditor(task);
      });

      t.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", task.id);
        t.classList.add("dragging");
      });
      t.addEventListener("dragend", () => t.classList.remove("dragging"));

      tasksDiv.appendChild(t);
    });
  });
}

// ===================== Chargement / Sauvegarde Firestore =====================
async function loadTasksFromFirestore() {
  if (!currentUser) return;
  tasksByDate = {};
  allTasks = [];

  const q = query(
    collection(db, "tasks"),
    where("uid", "==", currentUser.uid),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  snap.forEach((d) => {
    const data = d.data();
    const task = { id: d.id, ...data };
    allTasks.push(task);
    if (!tasksByDate[task.date]) tasksByDate[task.date] = [];
    tasksByDate[task.date].push(task);
  });

  injectTasksIntoCalendar();
}

async function saveTaskToFirestore(task) {
  const ref = await addDoc(collection(db, "tasks"), {
    ...task,
    uid: currentUser.uid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

async function updateTaskInFirestore(id, changes) {
  await updateDoc(doc(db, "tasks", id), changes);
}

async function deleteTaskFromFirestore(id) {
  await deleteDoc(doc(db, "tasks", id));
}

// ===================== Rappels (FCM hors-ligne) =====================
// Ecrit un rappel planifié pour Cloud Functions -> FCM même app fermée
async function scheduleFCMReminderFC(reminder) {
  // reminder: { title, body, sendAtISO, topic? }
  await addDoc(collection(db, "reminders"), {
    uid: currentUser.uid,
    title: reminder.title,
    body: reminder.body || "",
    sendAt: reminder.sendAtISO, // "YYYY-MM-DDTHH:mm"
    topic: reminder.topic || "allUsers",
    createdAt: serverTimestamp(),
  });
}

// Limite 10 rappels par jour
async function getReminderCountForDay(reminderDate) {
  // On compte dans tasks les isReminder pour ce jour
  const local = (tasksByDate[reminderDate] || []).filter((t) => t.isReminder).length;
  // Pour robustesse, on vérifie en BD aussi
  const q = query(
    collection(db, "tasks"),
    where("uid", "==", currentUser?.uid || ""),
    where("isReminder", "==", true),
    where("reminderDate", "==", reminderDate)
  );
  const snap = await getDocs(q);
  const remote = snap.size;
  // on prend le max (au cas où le cache serait désynchronisé)
  return Math.max(local, remote);
}

// ===================== UI: Ouverture / Edition tâches =====================
function openDayTasks(dateObj) {
  selectedDate = dateObj;
  dayTasksTitle.textContent = `Devoirs du ${dateObj.toLocaleDateString("fr-FR")}`;
  renderDayTasksList(toDateKey(dateObj));
  dayTasksBg.style.display = "flex";
}

function renderDayTasksList(dateKey) {
  dayTasksList.innerHTML = "";
  const list = tasksByDate[dateKey] || [];
  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.style.opacity = "0.7";
    empty.textContent = "Aucun devoir ou rappel pour ce jour.";
    dayTasksList.appendChild(empty);
    return;
  }
  list.forEach((task) => {
    const item = document.createElement("div");
    item.className = "task-item" + (task.isReminder ? " rappel" : "");
    item.textContent = task.subject ? `${task.subject} — ${task.title}` : task.title;
    item.addEventListener("click", () => openTaskEditor(task));
    dayTasksList.appendChild(item);
  });
}

function openTaskEditor(task = null) {
  // Préparation modal
  modalBg.style.display = "flex";
  editingTaskId = task ? task.id : null;
  modalTitle.textContent = task ? "Modifier le devoir" : "Ajouter un devoir";

  // Pré-remplissage
  const baseDate = (() => {
    if (task) return task.date;
    if (!selectedDate) return todayKey();
    if (userSettings.defaultDayMode === "today") return todayKey();
    if (userSettings.defaultDayMode === "selected") return toDateKey(selectedDate);
    if (userSettings.defaultDayMode === "nextSchoolDay") return toDateKey(nextSchoolDay(selectedDate));
    return todayKey();
  })();

  inputMatiere.value = task?.subject || "";
  inputTitre.value = task?.title || "";
  inputDate.value = task?.date || baseDate;
  inputHeure.value = task?.time || userSettings.defaultHour || "18:00";
  inputRappel.checked = task?.isReminder || false;

  // Afficher/masquer bouton supprimer
  btnDelete.style.display = task ? "inline-block" : "none";
}

// ===================== Validations contraintes =====================
function ensureNoHomeworkBeforeToday(dateStr) {
  const d = new Date(dateStr);
  const t = new Date();
  t.setHours(0,0,0,0);
  if (d.getTime() < t.getTime()) {
    throw new Error("Impossible d'ajouter un devoir avant aujourd'hui.");
  }
}

function ensureReminderInFuture(reminderDate, reminderTime) {
  const now = new Date();
  const r = parseDateTime(reminderDate, reminderTime);
  if (r.getTime() <= now.getTime()) {
    throw new Error("Le rappel ne peut pas être dans le passé.");
  }
}

async function ensureMaxReminders(reminderDate) {
  const count = await getReminderCountForDay(reminderDate);
  if (count >= 10) {
    throw new Error("Limite de 10 rappels par jour atteinte.");
  }
}

// ===================== Soumission / Suppression =====================
taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) {
    alert("Connecte-toi pour enregistrer des devoirs.");
    return;
  }
  try {
    const subject = inputMatiere.value.trim();
    const title = inputTitre.value.trim();
    const dateStr = inputDate.value;
    const timeStr = inputHeure.value || "18:00";
    const wantsReminder = inputRappel.checked;

    if (!subject || !title || !dateStr) throw new Error("Tous les champs sont requis.");
    ensureNoHomeworkBeforeToday(dateStr);

    let reminderDate = dateStr;
    let reminderTime = timeStr;

    // Si l'utilisateur veut un rappel, appliquer réglages par défaut (J- X jours, heure par défaut) si édition/ajout
    if (wantsReminder) {
      const d = new Date(dateStr);
      if (typeof userSettings.defaultReminderDays === "number" && userSettings.defaultReminderDays > 0) {
        d.setDate(d.getDate() - userSettings.defaultReminderDays);
        reminderDate = toDateKey(d);
      }
      reminderTime = userSettings.defaultHour || timeStr;

      // Si la date/heure par défaut est déjà passée -> mettre aujourd'hui/maintenant+1min
      const clamped = clampReminderToFuture(reminderDate, reminderTime);
      reminderDate = clamped.date;
      reminderTime = clamped.time;

      // Respecter limite 10/jour
      await ensureMaxReminders(reminderDate);

      // Garantir futur
      ensureReminderInFuture(reminderDate, reminderTime);
    }

    // Construction du document
    const payload = {
      subject,
      title,
      date: dateStr,
      time: timeStr,
      isReminder: !!wantsReminder,
    };
    if (wantsReminder) {
      payload.reminderDate = reminderDate;
      payload.reminderTime = reminderTime;
    }

    if (editingTaskId) {
      // Ne pas modifier le rappel si on édite "sans changer le rappel"
      // -> on met à jour seulement les champs hors rappel, sauf si rappel décoché
      const original = allTasks.find((t) => t.id === editingTaskId);
      if (!original) throw new Error("Tâche introuvable.");

      const changes = {
        subject,
        title,
        date: dateStr,
        time: timeStr,
      };

      if (!wantsReminder && original.isReminder) {
        // Suppression du rappel
        changes.isReminder = false;
        changes.reminderDate = null;
        changes.reminderTime = null;
      } else if (wantsReminder && !original.isReminder) {
        // Ajout d'un rappel (nouveau) => contraintes appliquées ci-dessus
        changes.isReminder = true;
        changes.reminderDate = reminderDate;
        changes.reminderTime = reminderTime;
      }
      await updateTaskInFirestore(editingTaskId, changes);

      // Si on a ajouté un nouveau rappel via l'édition, on planifie FCM
      if (wantsReminder && !original.isReminder) {
        await scheduleFCMReminderFC({
          title: `Rappel: ${title}`,
          body: subject ? `Matière: ${subject}` : "",
          sendAtISO: `${reminderDate}T${reminderTime}`,
        });
      }
    } else {
      // Nouvelle tâche
      const newId = await saveTaskToFirestore(payload);

      // Si rappel demandé, on planifie FCM
      if (wantsReminder) {
        await scheduleFCMReminderFC({
          title: `Rappel: ${title}`,
          body: subject ? `Matière: ${subject}` : "",
          sendAtISO: `${reminderDate}T${reminderTime}`,
        });
      }
    }

    modalBg.style.display = "none";
    editingTaskId = null;

    await loadTasksFromFirestore();
    if (selectedDate) renderDayTasksList(toDateKey(selectedDate));
  } catch (err) {
    alert(err.message || String(err));
  }
});

btnCancel.addEventListener("click", () => {
  modalBg.style.display = "none";
  editingTaskId = null;
});

btnDelete.addEventListener("click", async () => {
  if (!editingTaskId) return;
  if (!confirm("Supprimer ce devoir/rappel ?")) return;
  await deleteTaskFromFirestore(editingTaskId);
  modalBg.style.display = "none";
  editingTaskId = null;
  await loadTasksFromFirestore();
  if (selectedDate) renderDayTasksList(toDateKey(selectedDate));
});

// ===================== DayTasks actions =====================
dayTasksAddBtn.addEventListener("click", () => {
  openTaskEditor(null);
});
dayTasksCloseBtn.addEventListener("click", () => {
  dayTasksBg.style.display = "none";
});

// ===================== Drag & drop -> Poubelle =====================
trash.addEventListener("dragover", (e) => {
  e.preventDefault();
  trash.classList.add("drag-over");
});
trash.addEventListener("dragleave", () => trash.classList.remove("drag-over"));
trash.addEventListener("drop", async (e) => {
  e.preventDefault();
  trash.classList.remove("drag-over");
  const taskId = e.dataTransfer.getData("text/plain");
  if (!taskId) return;
  if (!confirm("Supprimer cet élément ?")) return;
  await deleteTaskFromFirestore(taskId);
  await loadTasksFromFirestore();
  if (selectedDate) renderDayTasksList(toDateKey(selectedDate));
});

// ===================== Paramètres (persistants Firestore) =====================
async function loadUserSettings() {
  if (!currentUser) return;
  const ref = doc(db, "settings", currentUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    userSettings = {
      defaultReminderDays: Number.isFinite(data.defaultReminderDays) ? data.defaultReminderDays : 0,
      defaultHour: data.defaultHour || "18:00",
      defaultDayMode: data.defaultDayMode || "today",
    };
  } else {
    // Créer avec valeurs par défaut
    await setDoc(ref, userSettings);
  }
  // Remplir formulaire
  inputDefaultReminder.value = userSettings.defaultReminderDays;
  inputDefaultHour.value = userSettings.defaultHour;
  // Champs userId/userPass: on peut les laisser vides (info locale)
}

async function saveUserSettings() {
  if (!currentUser) return;
  const ref = doc(db, "settings", currentUser.uid);
  userSettings.defaultReminderDays = Math.max(0, Math.min(7, parseInt(inputDefaultReminder.value || "0", 10)));
  userSettings.defaultHour = inputDefaultHour.value || "18:00";
  await setDoc(ref, userSettings, { merge: true });
}

btnSettings.addEventListener("click", async () => {
  if (!currentUser) {
    alert("Connecte-toi pour modifier tes paramètres.");
    return;
  }
  await loadUserSettings();
  paramsBg.style.display = "flex";
});

paramsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await saveUserSettings();
    paramsBg.style.display = "none";
    alert("Paramètres enregistrés.");
  } catch (e2) {
    alert("Erreur lors de l'enregistrement des paramètres.");
  }
});
btnParamsCancel.addEventListener("click", () => {
  paramsBg.style.display = "none";
});

// ===================== Navigation mois =====================
btnPrev.addEventListener("click", async () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
  await loadTasksFromFirestore();
});
btnNext.addEventListener("click", async () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
  await loadTasksFromFirestore();
});

// ===================== Auth =====================
loginSubmit.addEventListener("click", async () => {
  try {
    // Ajout d'attributs autocomplete recommandés (réduira les warnings)
    loginPass.setAttribute("autocomplete", "current-password");
    inputUserPass.setAttribute("autocomplete", "current-password");

    const email = (loginUser.value || "").trim();
    const pass = loginPass.value || "";
    if (!email || !pass) {
      alert("Email et mot de passe requis.");
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch {
      await createUserWithEmailAndPassword(auth, email, pass);
    }
    loginBg.style.display = "none";
  } catch (err) {
    alert(err.message || String(err));
  }
});

loginGoogle.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
    loginBg.style.display = "none";
  } catch (err) {
    alert(err.message || String(err));
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    // Charger paramètres + tâches
    await loadUserSettings();
    renderCalendar();
    await loadTasksFromFirestore();
    // Masquer l'écran de login si visible
    loginBg.style.display = "none";
  } else {
    // Montrer l'écran de login
    loginBg.style.display = "flex";
    // Vider l'UI
    tasksByDate = {};
    allTasks = [];
    renderCalendar();
  }
});

// ===================== Initialisation =====================
document.addEventListener("DOMContentLoaded", () => {
  // Rendu initial (sans tâches si pas connecté)
  renderCalendar();
});

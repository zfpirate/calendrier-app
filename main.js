/* ================== Globals & DOM ================== */
let currentUser, currentUserDoc, currentYear, currentMonth;
let selectedDate, editingTaskId, preservedRappelDate;
let defaultReminder = 1, defaultHour = "18:00";
let fcmInitialized = false;

const modalBg = document.getElementById("modalBg");
const dayTasksBg = document.getElementById("dayTasksBg");
const paramsBg = document.getElementById("paramsBg");
const modalTitle = document.getElementById("modalTitle");
const matiereInput = document.getElementById("matiere");
const titreInput = document.getElementById("titre");
const dateInput = document.getElementById("date");
const rappelCheckbox = document.getElementById("rappel");
const heureInput = document.getElementById("heure");
const deleteBtn = document.getElementById("deleteBtn");
const cancelBtn = document.getElementById("cancelBtn");
const taskForm = document.getElementById("taskForm");
const dayTasksList = document.getElementById("dayTasksList");
const dayTasksTitle = document.getElementById("dayTasksTitle");
const dayTasksCloseBtn = document.getElementById("dayTasksCloseBtn");
const dayTasksAddBtn = document.getElementById("dayTasksAddBtn");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const settingsBtn = document.getElementById("settingsBtn");
const userIdInput = document.getElementById("userId");
const userPassInput = document.getElementById("userPass");
const defaultReminderInput = document.getElementById("defaultReminder");
const defaultHourInput = document.getElementById("defaultHour");
const paramsCancelBtn = document.getElementById("paramsCancelBtn");
const paramsForm = document.getElementById("paramsForm");
const loginBg = document.getElementById("loginBg");
const loginUserInput = document.getElementById("loginUser");
const loginPassInput = document.getElementById("loginPass");
const loginSubmitBtn = document.getElementById("loginSubmit");
const loginGoogleBtn = document.getElementById("loginGoogle");
const calendar = document.getElementById("calendar");
const monthYear = document.getElementById("monthYear");
const trashDiv = document.getElementById("trash");

/* ================== Panels helpers ================== */
function closeAllPanels() {
  try { modalBg.style.display = "none"; } catch {}
  try { dayTasksBg.style.display = "none"; } catch {}
  try { paramsBg.style.display = "none"; } catch {}
}
function closePanelsAndOpenModal(dateStr, taskId = null, taskData = null) {
  closeAllPanels();
  try { closeModal(); } catch {}
  openModal(dateStr, taskId, taskData);
}

/* ================== Modal handlers (add / edit) ================== */
function openModal(dateStr, taskId = null, taskData = null) {
  selectedDate = dateStr;
  editingTaskId = taskId;

  try { dayTasksBg.style.display = "none"; } catch {}
  try { paramsBg.style.display = "none"; } catch {}

  modalBg.style.zIndex = "9999";
  modalBg.style.display = "flex";
  modalTitle.textContent = taskId ? "Modifier le devoir" : "Ajouter un devoir";

  matiereInput.value = taskData?.matiere || "";
  titreInput.value = taskData?.titre || "";
  dateInput.value = taskData?.date || dateStr || "";
  rappelCheckbox.checked = typeof taskData?.rappel === "undefined" ? true : !!taskData.rappel;
  heureInput.value = taskData?.heure || defaultHour;

  deleteBtn.style.display = taskId ? "inline-block" : "none";
  try { matiereInput.focus(); } catch {}
}

function closeModal() {
  try { modalBg.style.display = "none"; } catch {}
  editingTaskId = null;
  preservedRappelDate = null;
  try { taskForm.reset(); } catch {}
  try { deleteBtn.style.display = "none"; } catch {}
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

/* ================== Unified submit (create/edit) ================== */
taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try { ensureAuthed(); } catch { alert("Connecte-toi d'abord."); return; }

  const matiere = matiereInput.value.trim();
  const titre = titreInput.value.trim();
  const dateVal = dateInput.value;
  const rappel = !!rappelCheckbox.checked;
  const heure = heureInput.value || defaultHour;

  if (!matiere || !titre || !dateVal) { alert("Remplis tous les champs"); return; }

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

  const payload = {
    matiere,
    titre,
    date: dateVal,
    heure,
    rappel,
    ownerUid: currentUser.uid,
    year: controlDate.getFullYear(),
    month: controlDate.getMonth(),
    day: controlDate.getDate()
  };

  try {
    if (editingTaskId) {
      const docRef = doc(db, "devoirs", editingTaskId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const old = snap.data();
        const keepRappelDate = preservedRappelDate ?? old.rappelDate ?? rappelDateStr;
        payload.rappelDate = keepRappelDate;
      } else {
        payload.rappelDate = rappelDateStr;
      }
      await updateDoc(docRef, payload);
    } else {
      payload.rappelDate = rappelDateStr;
      await addDoc(collection(db, "devoirs"), payload);
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
  try { ensureAuthed(); } catch { calendar.innerHTML = "<div class='not-logged'>Connecte-toi</div>"; return; }
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
      div.draggable = true;

      // Drag start
      div.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", docSnap.id);
        trashDiv.classList.add("active");
      });
      // Double click edit
      div.addEventListener("dblclick", () => {
        editingTaskId = docSnap.id;
        dayTasksBg.style.display = "none";
        preservedRappelDate = data.rappelDate || dateStr;
        openModal(dateStr, docSnap.id, data);
      });
      dayTasksList.appendChild(div);
    });
  } catch (e) {
    console.error("refreshDayTasksList:", e);
  }
}

/* ================== Trash drag/drop ================== */
trashDiv?.addEventListener("dragover", (e) => e.preventDefault());
trashDiv?.addEventListener("drop", async (e) => {
  e.preventDefault();
  const id = e.dataTransfer.getData("text/plain");
  if (!id) return;
  try { await deleteDoc(doc(db, "devoirs", id)); await renderCalendar(currentYear, currentMonth); } catch(e){console.error(e);}
  trashDiv.classList.remove("active");
});
trashDiv?.addEventListener("dragleave", () => trashDiv.classList.remove("active"));

/* ================== Navigation & settings ================== */
prevMonthBtn?.addEventListener("click", () => {
  let m = currentMonth - 1; let y = currentYear;
  if (m < 0) { m = 11; y -= 1; }
  renderCalendar(y, m);
});
nextMonthBtn?.addEventListener("click", () => {
  let m = currentMonth + 1; let y = currentYear;
  if (m > 11) { m = 0; y += 1; }
  renderCalendar(y, m);
});
settingsBtn.addEventListener("click", () => { openParams(); });

/* ================== Params modal (settings) ================== */
function openParams() {
  try { ensureAuthed(); } catch { alert("Connecte-toi d'abord."); return; }
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
  const data = { ecoleUser, ecolePass, defaultReminder: reminderVal, defaultHour: hourVal };

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
loginForm?.setAttribute("autocomplete", "on");
loginSubmitBtn?.addEventListener("click", async () => {
  const email = loginUserInput.value?.trim();
  const pass = loginPassInput.value?.trim();
  if (!email || !pass) { alert("Email / mot de passe requis."); return; }
  try { await signInWithEmailAndPassword(auth, email, pass); loginBg.style.display = "none"; }
  catch (e) {
    try { await createUserWithEmailAndPassword(auth, email, pass); loginBg.style.display = "none"; }
    catch (err) { console.error("Auth error:", err); alert("Erreur connexion/inscription : " + (err.message || err)); }
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
      const now = new Date(); currentYear = now.getFullYear(); currentMonth = now.getMonth();
      await renderCalendar(currentYear, currentMonth);
    } catch (e) { console.error("renderCalendar error:", e); }

    startNotificationChecks();
    await ensureServiceWorkerRegistered();
    listenForegroundNotifications();
    if (!fcmInitialized) await enableNotificationsForCurrentUser().catch(() => {});
  } else {
    currentUser = null;
    if (loginBg) loginBg.style.display = "flex";
    calendar.innerHTML = "<div class='not-logged'>Connecte-toi pour voir le calendrier</div>";
    if (monthYear) monthYear.textContent = "";
    stopNotificationChecks();
  }
});

/* ================== Debug helpers ================== */
window.__appDebug = {
  getEcoleCredentials: async () => {
    ensureAuthed();
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return { identifiant: data.ecoleUser || "", motdepasse: decryptText(data.ecolePass || "") };
  },
  encryptText, decryptText,
  logout: () => signOut(auth)
};

/* ================== Init on load ================== */
(async () => {
  await ensureServiceWorkerRegistered().catch(() => {});
  try {
    if (auth.currentUser) {
      currentUser = auth.currentUser;
      await loadUserSettingsOrAsk().catch(console.error);
      const now = new Date(); currentYear = now.getFullYear(); currentMonth = now.getMonth();
      await renderCalendar(currentYear, currentMonth);
      listenForegroundNotifications();
      startNotificationChecks();
      if (!fcmInitialized) await enableNotificationsForCurrentUser();
    } else {
      if (loginBg) loginBg.style.display = "flex";
    }
  } catch (e) {
    console.error("Init error:", e);
  }
})();
/* ================== Firebase Messaging / PWA ================== */
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";

let messaging;

async function ensureServiceWorkerRegistered() {
  if (!("serviceWorker" in navigator)) return;
  try {
    console.log("🔄 Enregistrement du service worker...");
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    console.log("✅ Service Worker FCM enregistré:", registration);
    return registration;
  } catch (e) {
    console.error("❌ Erreur enregistrement SW:", e);
  }
}

async function enableNotificationsForCurrentUser() {
  if (!currentUser) return;
  try {
    messaging = getMessaging(firebaseApp);
    const registration = await ensureServiceWorkerRegistered();
    const token = await getToken(messaging, { vapidKey: "BEk1IzaUQOXzKFu7RIkILgmWic1IgWfMdAECHofkTC5D5kmUY6tC0lWVIUtqCyHdrD96aiccAYW5A00PTQHYBZM", serviceWorkerRegistration: registration });
    console.log("🔑 FCM token:", token);
    fcmInitialized = true;
  } catch (e) {
    console.error("❌ Erreur initialisation FCM:", e);
  }
}

function listenForegroundNotifications() {
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    console.log("📩 Notification foreground reçue:", payload);
    if (payload.notification) {
      new Notification(payload.notification.title || "Devoir", {
        body: payload.notification.body || "",
        icon: payload.notification.icon || "/icon-192.png"
      });
    }
  });
}

/* ================== Appel automatique pour init FCM ================== */
(async () => {
  if (currentUser && !fcmInitialized) {
    await enableNotificationsForCurrentUser();
    listenForegroundNotifications();
  }
})();

// ===================== main.js (final) =====================

// --- Import Firebase centralisé ---
import { app, db, auth } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc,
  query, where, orderBy, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";

// ===================== Etat global =====================
let currentDate = new Date();
let selectedDate = null;
let currentUser = null;
let tasksByDate = {};
let allTasks = [];
let editingTaskId = null;

let userSettings = {
  defaultReminderDays: 0,
  defaultHour: "18:00",
  defaultDayMode: "today",
};

// ===================== Helpers dates =====================
const pad2 = n => String(n).padStart(2, "0");
const toDateKey = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const todayKey = () => toDateKey(new Date());
function parseDateTime(dateStr, timeStr) { return new Date(`${dateStr}T${timeStr}`); }
function isSameDay(d1,d2){return d1.getFullYear()===d2.getFullYear()&&d1.getMonth()===d2.getMonth()&&d1.getDate()===d2.getDate();}
function nextSchoolDay(date=new Date()){const d=new Date(date); do{d.setDate(d.getDate()+1);}while([0,6].includes(d.getDay()));return d;}
function clampReminderToFuture(reminderDate, reminderTime){
  const now=new Date();
  const target=parseDateTime(reminderDate,reminderTime);
  if(target.getTime()<=now.getTime()){const r=new Date(now.getTime()+60000); return {date:toDateKey(r),time:`${pad2(r.getHours())}:${pad2(r.getMinutes())}`};}
  return {date:reminderDate,time:reminderTime};
}

// ===================== FCM =====================
const messaging = getMessaging(app);
async function initFCM(){
  try{
    if(!("serviceWorker" in navigator)) return console.warn("Service worker non supporté");
    if(!("Notification" in window)) return console.warn("Notifications non supportées");
    const registration=await navigator.serviceWorker.register("./firebase-messaging-sw.js");
    const permission=await Notification.requestPermission();
    if(permission!=="granted") return console.warn("Permission notifications refusée");
    const token=await getToken(messaging,{vapidKey:"BEk1IzaUQOXzKFu7RIkILgmWic1IgWfMdAECHofkTC5D5kmUY6tC0lWVIUtqCyHdrD96aiccAYW5A00PTQHYBZM",serviceWorkerRegistration:registration});
    if(!token) return console.warn("⚠️ Aucun token FCM obtenu.");
    if(currentUser) await setDoc(doc(db,"fcmTokens",currentUser.uid),{token,updatedAt:new Date()});
    onMessage(messaging,(payload)=>{
      if(Notification.permission==="granted"){
        new Notification(payload.notification?.title||"Notification",{body:payload.notification?.body||"",icon:"./images/icone-notif.jpg"});
      }else{alert(`${payload.notification?.title}\n${payload.notification?.body}`);}
    });
  }catch(err){console.error("❌ Erreur FCM:",err);}
}

// ===================== AuthState =====================
onAuthStateChanged(auth,async user=>{
  currentUser=user;
  if(user){
    await loadUserSettings();
    renderCalendar();
    await loadTasksFromFirestore();
    loginBg.style.display="none";
    await initFCM();
  }else{
    loginBg.style.display="flex";
    tasksByDate={};
    allTasks=[];
    renderCalendar();
  }
});

// ===================== Sélecteurs DOM =====================
const elMonthYear=document.getElementById("monthYear");
const elCalendar=document.getElementById("calendar");
const btnPrev=document.getElementById("prev-month-btn");
const btnNext=document.getElementById("next-month-btn");
const btnSettings=document.getElementById("settings-btn");
const modalBg=document.getElementById("modal-bg");
const taskForm=document.getElementById("taskForm");
const inputMatiere=document.getElementById("matiere");
const inputTitre=document.getElementById("titre");
const inputDate=document.getElementById("date");
const inputHeure=document.getElementById("heure");
const inputRappel=document.getElementById("rappel");
const btnCancel=document.getElementById("cancel-btn");
const btnDelete=document.getElementById("delete-btn");
const modalTitle=document.getElementById("modal-title");
const paramsBg=document.getElementById("params-bg");
const paramsForm=document.getElementById("paramsForm");
const inputUserId=document.getElementById("userId");
const inputUserPass=document.getElementById("userPass");
const inputDefaultReminder=document.getElementById("defaultReminder");
const inputDefaultHour=document.getElementById("defaultHour");
const btnParamsCancel=document.getElementById("params-cancel-btn");
const dayTasksBg=document.getElementById("dayTasks-bg");
const dayTasksTitle=document.getElementById("dayTasks-title");
const dayTasksList=document.getElementById("dayTasks-list");
const dayTasksAddBtn=document.getElementById("dayTasks-add-btn");
const dayTasksCloseBtn=document.getElementById("dayTasks-close-btn");
const loginBg=document.getElementById("login-bg");
const loginUser=document.getElementById("loginUser");
const loginPass=document.getElementById("loginPass");
const loginSubmit=document.getElementById("loginSubmit");
const loginGoogle=document.getElementById("loginGoogle");
const trash=document.getElementById("trash");

// ===================== Rendu calendrier =====================
function renderCalendar(){
  elCalendar.innerHTML="";
  const year=currentDate.getFullYear();
  const month=currentDate.getMonth();
  elMonthYear.textContent=currentDate.toLocaleString("fr-FR",{month:"long",year:"numeric"});
  const firstDay=new Date(year,month,1);
  const startDay=(firstDay.getDay()+6)%7;
  const daysInMonth=new Date(year,month+1,0).getDate();
  ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].forEach(label=>{const d=document.createElement("div");d.className="day-name";d.textContent=label;elCalendar.appendChild(d);});
  for(let i=0;i<startDay;i++){const empty=document.createElement("div");empty.className="empty";elCalendar.appendChild(empty);}

  const lastWeekStart=daysInMonth-((daysInMonth-startDay)%7);
  const extraDays=(lastWeekStart>=daysInMonth-7)?14:0;
  const totalDays=daysInMonth+extraDays;

  for(let day=1;day<=totalDays;day++){
    const isOverflow=day>daysInMonth;
    const displayNum=isOverflow?day-daysInMonth:day;
    const dateObj=new Date(year,month,day);
    const dateKey=toDateKey(dateObj);
    const cell=document.createElement("div");
    cell.className="date";if(isOverflow) cell.classList.add("continuous");cell.dataset.date=dateKey;
    const num=document.createElement("div");num.className="num";num.textContent=displayNum;cell.appendChild(num);
    if(isSameDay(dateObj,new Date())){
      cell.classList.add("today");
      const label=document.createElement("div");label.className="today-label";label.textContent="Aujourd'hui";cell.appendChild(label);
    }
    cell.addEventListener("click",()=>openDayTasks(dateObj));
    const tasksDiv=document.createElement("div");tasksDiv.className="tasks";cell.appendChild(tasksDiv);
    elCalendar.appendChild(cell);
  }
  injectTasksIntoCalendar();
}

function injectTasksIntoCalendar(){
  document.querySelectorAll(".date").forEach(cell=>{
    const date=cell.dataset.date;
    const tasksDiv=cell.querySelector(".tasks");
    tasksDiv.innerHTML="";
    (tasksByDate[date]||[]).forEach(task=>{
      const t=document.createElement("div");
      t.className="task"+(task.isReminder?" rappel":"");
      t.textContent=task.title;
      t.title=task.subject?`${task.subject} — ${task.title}`:task.title;
      t.draggable=true;
      t.addEventListener("click",e=>{e.stopPropagation();openTaskEditor(task);});
      t.addEventListener("dragstart",e=>{e.dataTransfer.setData("text/plain",task.id);t.classList.add("dragging");});
      t.addEventListener("dragend",()=>t.classList.remove("dragging"));
      tasksDiv.appendChild(t);
    });
  });
}

// ===================== Firestore =====================
async function loadTasksFromFirestore(){
  if(!currentUser) return;
  tasksByDate={};allTasks=[];
  const q=query(collection(db,"tasks"),where("uid","==",currentUser.uid),orderBy("date","asc"));
  const snap=await getDocs(q);
  snap.forEach(d=>{
    const data=d.data();const task={id:d.id,...data};
    allTasks.push(task);
    if(!tasksByDate[task.date]) tasksByDate[task.date]=[];
    tasksByDate[task.date].push(task);
  });
  injectTasksIntoCalendar();
}

async function saveTaskToFirestore(task){const ref=await addDoc(collection(db,"tasks"),{...task,uid:currentUser.uid,createdAt:serverTimestamp()});return ref.id;}
async function updateTaskInFirestore(id,changes){await updateDoc(doc(db,"tasks",id),changes);}
async function deleteTaskFromFirestore(id){await deleteDoc(doc(db,"tasks",id));}

// ===================== Rappels =====================
async function scheduleFCMReminderFC(reminder){await addDoc(collection(db,"reminders"),{uid:currentUser.uid,title:reminder.title,body:reminder.body||"",sendAt:reminder.sendAtISO,topic:reminder.topic||"allUsers",createdAt:serverTimestamp()});}
async function getReminderCountForDay(reminderDate){
  const local=(tasksByDate[reminderDate]||[]).filter(t=>t.isReminder).length;
  const q=query(collection(db,"tasks"),where("uid","==",currentUser?.uid||""),where("isReminder","==",true),where("reminderDate","==",reminderDate));
  const snap=await getDocs(q);return Math.max(local,snap.size);
}

// ===================== Task UI =====================
function openDayTasks(dateObj){selectedDate=dateObj;dayTasksTitle.textContent=`Devoirs du ${dateObj.toLocaleDateString("fr-FR")}`;renderDayTasksList(toDateKey(dateObj));dayTasksBg.style.display="flex";}
function renderDayTasksList(dateKey){dayTasksList.innerHTML="";const list=tasksByDate[dateKey]||[];if(list.length===0){const empty=document.createElement("div");empty.style.opacity="0.7";empty.textContent="Aucun devoir ou rappel pour ce jour.";dayTasksList.appendChild(empty);return;} list.forEach(task=>{const item=document.createElement("div");item.className="task-item"+(task.isReminder?" rappel":"");item.textContent=task.subject?`${task.subject} — ${task.title}`:task.title;item.addEventListener("click",()=>openTaskEditor(task));dayTasksList.appendChild(item);});}

function openTaskEditor(task=null){
  modalBg.style.display="flex";editingTaskId=task?task.id:null;modalTitle.textContent=task?"Modifier le devoir":"Ajouter un devoir";
  const baseDate=task?task.date:(!selectedDate?todayKey():toDateKey(selectedDate));
  inputMatiere.value=task?.subject||"";inputTitre.value=task?.title||"";inputDate.value=task?.date||baseDate;inputHeure.value=task?.time||userSettings.defaultHour||"18:00";inputRappel.checked=true;
  btnDelete.style.display=task?"inline-block":"none";
}

// ===================== Formulaire =====================
taskForm.addEventListener("submit",async e=>{
  e.preventDefault();
  if(!currentUser){alert("Connecte-toi pour enregistrer des devoirs.");return;}
  try{
    const subject=inputMatiere.value.trim();
    const title=inputTitre.value.trim();
    const dateStr=inputDate.value;
    const timeStr=inputHeure.value||"18:00";
    const wantsReminder=inputRappel.checked;
    if(!subject||!title||!dateStr) throw new Error("Tous les champs sont requis.");
    const now=new Date(); if(new Date(dateStr).getTime()<new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime()) throw new Error("Impossible d'ajouter un devoir avant aujourd'hui.");

    let reminderDate=dateStr; let reminderTime=timeStr;
    if(wantsReminder){
      const d=new Date(dateStr); d.setDate(d.getDate()-userSettings.defaultReminderDays); reminderDate=toDateKey(d); reminderTime=userSettings.defaultHour||timeStr;
      const clamped=clampReminderToFuture(reminderDate,reminderTime); reminderDate=clamped.date; reminderTime=clamped.time;
      if(await getReminderCountForDay(reminderDate)>=10) throw new Error("Limite de 10 rappels par jour atteinte.");
    }

    const payload={subject,title,date:dateStr,time:timeStr,isReminder:!!wantsReminder};
    if(wantsReminder){payload.reminderDate=reminderDate;payload.reminderTime=reminderTime;}

    if(editingTaskId){
      const original=allTasks.find(t=>t.id===editingTaskId);if(!original) throw new Error("Tâche introuvable.");
      const changes={subject,title,date:dateStr,time:timeStr};
      if(!wantsReminder&&original.isReminder){changes.isReminder=false;changes.reminderDate=null;changes.reminderTime=null;}
      else if(wantsReminder&&!original.isReminder){changes.isReminder=true;changes.reminderDate=reminderDate;changes.reminderTime=reminderTime;}
      await updateTaskInFirestore(editingTaskId,changes);
      if(wantsReminder&&!original.isReminder){await scheduleFCMReminderFC({title:`Rappel: ${title}`,body:subject?`Matière: ${subject}`:"",sendAtISO:`${reminderDate}T${reminderTime}`});}
    }else{
      const newId=await saveTaskToFirestore(payload);
      if(wantsReminder){await scheduleFCMReminderFC({title:`Rappel: ${title}`,body:subject?`Matière: ${subject}`:"",sendAtISO:`${reminderDate}T${reminderTime}`});}
    }

    modalBg.style.display="none";editingTaskId=null;
    await loadTasksFromFirestore();if(selectedDate) renderDayTasksList(toDateKey(selectedDate));
  }catch(err){alert(err.message||String(err));}
});
btnCancel.addEventListener("click",()=>{modalBg.style.display="none";editingTaskId=null;});
btnDelete.addEventListener("click",async()=>{if(!editingTaskId) return;await deleteTaskFromFirestore(editingTaskId);modalBg.style.display="none";editingTaskId=null;await loadTasksFromFirestore();});

// ===================== Paramètres =====================
async function loadUserSettings(){
  if(!currentUser) return;
  const docSnap=await getDoc(doc(db,"userSettings",currentUser.uid));
  if(docSnap.exists()){userSettings=docSnap.data();}
  inputUserId.value=currentUser.email||"";inputUserPass.value="";inputDefaultReminder.value=userSettings.defaultReminderDays||0;inputDefaultHour.value=userSettings.defaultHour||"18:00";
}
paramsForm.addEventListener("submit",async e=>{
  e.preventDefault();userSettings.defaultReminderDays=parseInt(inputDefaultReminder.value)||0;userSettings.defaultHour=inputDefaultHour.value||"18:00";
  await setDoc(doc(db,"userSettings",currentUser.uid),userSettings);paramsBg.style.display="none";
});
btnParamsCancel.addEventListener("click",()=>{paramsBg.style.display="none";});

// ===================== Navigation mois =====================
btnPrev.addEventListener("click",()=>{currentDate.setMonth(currentDate.getMonth()-1);renderCalendar();});
btnNext.addEventListener("click",()=>{currentDate.setMonth(currentDate.getMonth()+1);renderCalendar();});

// ===================== Drag & Drop =====================
trash.addEventListener("dragover",e=>{e.preventDefault();trash.classList.add("over");});
trash.addEventListener("dragleave",()=>{trash.classList.remove("over");});
trash.addEventListener("drop",async e=>{e.preventDefault();trash.classList.remove("over");const id=e.dataTransfer.getData("text/plain");if(id){await deleteTaskFromFirestore(id);await loadTasksFromFirestore();}});

elCalendar.addEventListener("dragover",e=>{e.preventDefault();});
elCalendar.addEventListener("drop",async e=>{
  const id=e.dataTransfer.getData("text/plain");if(!id) return;
  const targetCell=e.target.closest(".date");if(!targetCell) return;
  const newDate=targetCell.dataset.date;
  await updateTaskInFirestore(id,{date:newDate});
  await loadTasksFromFirestore();
});

// ===================== DayTasks Close =====================
dayTasksCloseBtn.addEventListener("click",()=>{dayTasksBg.style.display="none";});

// ===================== Login =====================
loginSubmit.addEventListener("click",async ()=>{
  try{
    const email=loginUser.value.trim();const pass=loginPass.value.trim();
    if(!email||!pass) throw new Error("Tous les champs requis");
    await signInWithEmailAndPassword(auth,email,pass);
  }catch(err){alert(err.message||String(err));}
});
loginGoogle.addEventListener("click",()=>{const provider=new GoogleAuthProvider();signInWithPopup(auth,provider).catch(err=>alert(err.message||String(err)));});

// ===================== Initial render =====================
renderCalendar();

// =============================
// Firebase Config & Init
// =============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";

// 🔹 Ta configuration Firebase (⚠️ remplace par ta vraie config console Firebase)
firebase.initializeApp({
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
});
// ✅ Initialisation de Firebase
const app = initializeApp(firebaseConfig);

// ✅ Exports pour les autres fichiers
export const auth = getAuth(app);
export const db = getFirestore(app);
export const messaging = getMessaging(app);

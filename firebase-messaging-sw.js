// ===================== firebase-messaging-sw.js =====================
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js');

// Config Firebase
firebase.initializeApp({
  apiKey: "AIzaSyDRftI6joKvqLYgJsvnr1e0iSwSZC3PSc8",
  authDomain: "app-calendrier-d1a1d.firebaseapp.com",
  projectId: "app-calendrier-d1a1d",
  storageBucket: "app-calendrier-d1a1d.appspot.com",
  messagingSenderId: "797885447360",
  appId: "1:797885447360:web:ecceee1f6af18526978125",
  measurementId: "G-VD7TTVLCY5"
});

const messaging = firebase.messaging();
// Dans firebase-messaging-sw.js
self.addEventListener('install', event => {
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  clients.claim();
});

// --- Mise en cache des fichiers essentiels ---
const CACHE_NAME = "calendrier-cache-v1";
const CACHE_FILES = [
  "/calendrier-app/index.html",
  "/calendrier-app/style.css",
  "/calendrier-app/main.js",
  "/calendrier-app/client.js",
  "/calendrier-app/image/icone-app-192.jpg",
  "/calendrier-app/image/icone-app-512.jpg"
];

self.addEventListener("install", (event) => {
  console.log("[SW] Installation et cache des fichiers...");
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CACHE_FILES))
      .catch((err) => console.warn("[SW] Erreur cache addAll:", err))
  );
});

// Interception des requêtes
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((resp) => resp || fetch(event.request))
  );
});

// Notifications en background
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Notification background:", payload);
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/calendrier-app/image/icone-notif.jpg"
  });
});

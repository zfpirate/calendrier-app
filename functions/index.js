// ------------------------------
// index.js - Firebase Functions
// ------------------------------

const { setGlobalOptions } = require("firebase-functions/v2/options");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

// ⚡ Init Firebase Admin avec ton JSON
const serviceAccount = require("./fcm-service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Limiter le nombre d’instances
setGlobalOptions({ maxInstances: 10 });

// ------------------------------
// Fonction test HTTP pour envoyer une notif
// ------------------------------
exports.sendTestNotification = onRequest(async (req, res) => {
  const message = {
    notification: {
      title: "Test Notification",
      body: "Salut bro, ça marche même si l'app est fermée !"
    },
    topic: "allUsers" // tous ceux abonnés au topic
  };

  try {
    const response = await admin.messaging().send(message);
    logger.info("Notification envoyée !", response);
    res.send("Notification envoyée !");
  } catch (error) {
    logger.error("Erreur notif :", error);
    res.status(500).send("Erreur lors de l'envoi de la notification");
  }
});

// ------------------------------
// Fonction pour abonner un token au topic allUsers
// ------------------------------
exports.subscribeToTopic = onRequest(async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).send("Token manquant");

    await admin.messaging().subscribeToTopic(token, "allUsers");
    logger.info(`Token ${token} abonné au topic allUsers`);
    res.send("Token abonné au topic !");
  } catch (error) {
    logger.error("Erreur subscription :", error);
    res.status(500).send("Erreur lors de l'abonnement au topic");
  }
});

// ==================== IMPORTS ====================
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

// ==================== INIT ====================
admin.initializeApp();
const db = admin.firestore();

// ==================== FONCTION PLANIFIÉE TOUTES LES 5 MINUTES ====================
exports.sendRemindersAtExactTime = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    try {
      const now = Date.now(); // timestamp actuel en ms
      const windowStart = now - 2 * 60 * 1000; // 2 minutes avant
      const windowEnd = now + 3 * 60 * 1000;   // 3 minutes après pour tolérance

      const tasksSnap = await db.collection("devoirs")
        .where("rappel", "==", true)
        .where("timestampRappel", ">=", windowStart)
        .where("timestampRappel", "<=", windowEnd)
        .get();

      const messages = [];

      tasksSnap.forEach((taskDoc) => {
        const task = taskDoc.data();
        if (!task.ownerUid) return;

        const userRef = db.collection("users").doc(task.ownerUid);
        messages.push(userRef.get().then((userSnap) => {
          if (!userSnap.exists) return null;
          const userData = userSnap.data();
          const fcmToken = userData?.fcmToken;
          if (!fcmToken) return null;

          return admin.messaging().send({
            token: fcmToken,
            notification: {
              title: `Rappel devoir: ${task.matiere}`,
              body: `${task.titre} pour le ${task.date} à ${task.heure || "??:??"}`,
            },
            data: {
              taskId: taskDoc.id,
              date: task.date,
            },
          });
        }));
      });

      await Promise.all(messages);
      console.log(`✅ Notifications envoyées pour ${messages.length} rappels`);
    } catch (error) {
      console.error("❌ Erreur lors de l'envoi des notifications:", error);
    }
  });

// ==================== FONCTION HTTP POUR SUBSCRIBE AU TOPIC ====================
exports.subscribeToTopic = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { token, topic } = req.body;
      if (!token || !topic) return res.status(400).send({ error: "Token et topic requis" });

      await admin.messaging().subscribeToTopic(token, topic);
      console.log(`✅ Token abonné au topic ${topic}`);
      res.status(200).send({ message: `Abonné au topic ${topic} !` });
    } catch (error) {
      console.error("❌ Erreur subscribeToTopic:", error);
      res.status(500).send({ error: error.message });
    }
  });
});

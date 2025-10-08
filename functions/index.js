// index.js
const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();
const db = admin.firestore();

// Fonction planifiée toutes les 5 minutes
exports.sendRemindersAtExactTime = onSchedule("every 5 minutes", async (event) => {
  try {
    const now = Date.now(); // timestamp actuel en ms
    const windowStart = now - 2 * 60 * 1000; // 2 minutes avant
    const windowEnd = now + 3 * 60 * 1000; // 3 minutes après pour tolérance

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



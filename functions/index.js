const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// Cette fonction tourne toutes les 5 minutes
exports.sendRemindersAtExactTime = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
  const db = admin.firestore();
  const now = Date.now(); // timestamp actuel en ms
  const windowStart = now - 2*60*1000; // 2 minutes avant
  const windowEnd = now + 3*60*1000;   // 3 minutes après pour tolérance

  const tasksSnap = await db.collection("devoirs")
    .where("rappel", "==", true)
    .where("timestampRappel", ">=", windowStart)
    .where("timestampRappel", "<=", windowEnd)
    .get();

  const messages = [];

  tasksSnap.forEach(taskDoc => {
    const task = taskDoc.data();
    if (!task.ownerUid) return;

    const userRef = db.collection("users").doc(task.ownerUid);
    messages.push(userRef.get().then(userSnap => {
      if (!userSnap.exists) return null;
      const fcmToken = userSnap.data()?.fcmToken;
      if (!fcmToken) return null;

      return admin.messaging().send({
        token: fcmToken,
        notification: {
          title: `Rappel devoir: ${task.matiere}`,
          body: `${task.titre} pour le ${task.date} à ${task.heure || "??:??"}`
        },
        data: {
          taskId: taskDoc.id,
          date: task.date
        }
      });
    }));
  });

  await Promise.all(messages);
  console.log(`✅ Notifications envoyées pour ${messages.length} rappels`);
});

// Clean functional version with multi-token support and tighter window
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions, logger } from "firebase-functions/v2";
import admin from "firebase-admin";

admin.initializeApp();
setGlobalOptions({ region: "europe-west1" });
const db = admin.firestore();

export const sendRemindersAtExactTimeV2 = onSchedule("every minute", async () => {
  try {
    const now = Date.now();
    const hour = Number(new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "numeric",
      hour12: false
    }).format(new Date()));
    if (!Number.isNaN(hour) && hour >= 1 && hour < 7) {
      logger.info(`Fenetre de repos (01h-07h Europe/Paris). Heure actuelle: ${hour}h, execution ignoree.`);
      return;
    } else if (Number.isNaN(hour)) {
      logger.warn("Impossible de determiner l'heure Europe/Paris, execution continue.");
    }
    const windowStart = now - 3 * 60 * 1000; // 3 minutes avant
    const windowEnd = now + 3 * 60 * 1000;   // 3 minutes apr??s

    logger.info("Verification des devoirs a notifier...");
    logger.info(`Fenetre: ${new Date(windowStart).toISOString()} -> ${new Date(windowEnd).toISOString()}`);

    const snapshot = await db
      .collection("devoirs")
      .where("rappel", "==", true)
      .where("timestampRappel", ">=", windowStart)
      .where("timestampRappel", "<=", windowEnd)
      .get();

    if (snapshot.empty) {
      logger.info("Aucun devoir a notifier dans la fenetre.");
      return;
    }

    logger.info(`${snapshot.size} devoir(s) a notifier.`);

    for (const d of snapshot.docs) {
      const task = d.data();
      if (task.notified) {
        logger.info("Deja notifie, on ignore:", d.id);
        continue;
      }
      if (!task.ownerUid) {
        logger.warn("Pas d'ownerUid, on ignore:", d.id);
        continue;
      }

      const userSnap = await db.collection("users").doc(task.ownerUid).get();
      if (!userSnap.exists) {
        logger.warn(`Utilisateur ${task.ownerUid} introuvable.`);
        continue;
      }

      const u = userSnap.data() || {};
      let tokens = Array.isArray(u.fcmTokens) ? [...u.fcmTokens] : [];
      if (u.fcmToken && !tokens.includes(u.fcmToken)) tokens.push(u.fcmToken);
      // D??duplication stricte
      tokens = Array.from(new Set(tokens.filter(t => !!t)));
      if (!tokens.length) {
        logger.warn(`Aucun token FCM pour ${task.ownerUid}.`);
        continue;
      }

      try {
        const payloadData = {
          title: `Rappel devoir : ${task.matiere || "Inconnu"}`,
          body: `${task.titre || "Sans titre"} pour le ${task.date || "???"} a ${task.heure || "??:??"}`,
          id: d.id,
          date: String(task.date || ""),
          matiere: String(task.matiere || ""),
          heure: String(task.heure || ""),
          icon: "/icone-notif-192.jpg",
          click_action: "/"
        };

        const resp = await admin.messaging().sendEachForMulticast({
          tokens,
          data: payloadData,
        });

        logger.info(`Envois: success=${resp.successCount}, failure=${resp.failureCount}`);

        // Nettoyage des tokens invalides
        if (resp.failureCount > 0) {
          const toRemove = [];
          resp.responses.forEach((r, idx) => {
            if (!r.success) {
              const code = r.error?.errorInfo?.code || r.error?.code || "";
              if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) {
                toRemove.push(tokens[idx]);
              }
            }
          });
          if (toRemove.length) {
            await db
              .collection("users")
              .doc(task.ownerUid)
              .update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...toRemove) })
              .catch(() => {});
          }
        }

        await db.collection("devoirs").doc(d.id).update({ notified: true });
      } catch (err) {
        logger.error(`Erreur envoi notif pour ${d.id}:`, err);
      }
    }
  } catch (err) {
    logger.error("Erreur globale:", err);
  }
});

export const subscribeToTopic = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    const { token, topic } = req.body || {};
    if (!token || !topic) {
      res.status(400).send({ error: "Token et topic requis" });
      return;
    }
    await admin.messaging().subscribeToTopic(token, topic);
    res.status(200).send({ success: true });
  } catch (e) {
    logger.error("Erreur subscribeToTopic:", e);
    res.status(500).send({ error: e.message });
  }
});




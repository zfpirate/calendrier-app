// Clean functional version with multi-token support and tighter window
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { setGlobalOptions, logger } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import admin from "firebase-admin";
import crypto from "node:crypto";

admin.initializeApp();
setGlobalOptions({ region: "europe-west1" });

const db = admin.firestore();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "pirson.maxence2009@gmail.com";
const GITHUB_WORKFLOW_TOKEN = defineSecret("GITHUB_WORKFLOW_TOKEN");
const GITHUB_WORKFLOW_REPO = defineSecret("GITHUB_WORKFLOW_REPO");
const GITHUB_WORKFLOW_ID = defineSecret("GITHUB_WORKFLOW_ID");
const GITHUB_WORKFLOW_REF = defineSecret("GITHUB_WORKFLOW_REF");
const CREDENTIAL_SECRET_B64 = defineSecret("CREDENTIAL_SECRET_B64");

const ENCRYPTION_VERSION = "v1";
const GCM_TAG_LENGTH = 16;

function deriveEncryptionKey(secretValue) {
  if (!secretValue) {
    throw new Error("CREDENTIAL_SECRET_B64 manquant");
  }
  let binary;
  try {
    binary = Buffer.from(secretValue, "base64");
  } catch (err) {
    binary = Buffer.from(secretValue, "utf8");
  }
  return crypto.createHash("sha256").update(binary).digest();
}

function encryptValue(plainText, aad, secretValue) {
  const key = deriveEncryptionKey(secretValue);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  if (aad) {
    cipher.setAAD(Buffer.from(aad, "utf8"));
  }
  const ciphertext = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([ciphertext, authTag]);
  return `${ENCRYPTION_VERSION}:${iv.toString("base64")}:${combined.toString("base64")}`;
}

function isEncryptedValue(value) {
  return typeof value === "string" && value.startsWith(`${ENCRYPTION_VERSION}:`);
}

function decryptValue(encrypted, aad, secretValue) {
  if (!isEncryptedValue(encrypted)) {
    return String(encrypted ?? "");
  }
  const key = deriveEncryptionKey(secretValue);
  const parts = encrypted.split(":");
  if (parts.length !== 3 || parts[0] !== ENCRYPTION_VERSION) {
    throw new Error("Format chiffré invalide");
  }
  const iv = Buffer.from(parts[1], "base64");
  const combined = Buffer.from(parts[2], "base64");
  if (combined.length < GCM_TAG_LENGTH) {
    throw new Error("Données chiffrées invalides");
  }
  const tag = combined.subarray(combined.length - GCM_TAG_LENGTH);
  const ciphertext = combined.subarray(0, combined.length - GCM_TAG_LENGTH);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  if (aad) {
    decipher.setAAD(Buffer.from(aad, "utf8"));
  }
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

function extractBearerToken(req) {
  const header = req.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function buildGitHubAuthHeader(token) {
  const value = String(token || "").trim();
  if (!value) {
    return null;
  }
  const lowered = value.toLowerCase();
  if (lowered.startsWith("ghp_") || lowered.startsWith("gho_")) {
    return `token ${value}`;
  }
  if (lowered.startsWith("github_pat_")) {
    return `Bearer ${value}`;
  }
  if (lowered.startsWith("ghs_") || lowered.startsWith("ghu_")) {
    return `Bearer ${value}`;
  }
  return `Bearer ${value}`;
}

function normalizeGitHubRepo(value) {
  if (!value) {
    return null;
  }
  let repo = String(value).trim();
  repo = repo.replace(/^https?:\/\/github\.com\//i, "");
  repo = repo.replace(/\.git$/i, "");
  repo = repo.replace(/^[\s/]+|[\s/]+$/g, "");
  if (!repo.includes("/")) {
    return null;
  }
  return repo;
}
// Fonction pour gérer les en-têtes CORS
function handleCors(req, res) {
  const allowedOrigins = [
    'https://app-calendrier-d1a1d.web.app',
    'http://localhost:5000',
    'http://127.0.0.1:5000'
  ];
  
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return false;
  }
  
  return true;
}

// Fonction pour importer les devoirs depuis l'ENT
// Cette fonction est appelée depuis le frontend
// Elle nécessite une authentification Firebase valide
// et des identifiants ENT valides
// Elle renvoie le nombre de devoirs importés
export const importDevoirs = onRequest({ cors: true }, async (req, res) => {
  // Gestion des CORS
  if (!handleCors(req, res)) return;
  
  try {
    // Vérifier la méthode HTTP
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Méthode non autorisée' });
      return;
    }
    
    // Vérifier l'authentification
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Non autorisé - Token manquant' });
      return;
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.error('Erreur de vérification du token:', error);
      res.status(401).json({ error: 'Token invalide' });
      return;
    }
    
    const { userId, password, userIdFirebase } = req.body || {};
    
    // Vérifier que l'utilisateur est bien celui qu'il prétend être
    if (decodedToken.uid !== userIdFirebase) {
      res.status(403).json({ error: 'Non autorisé - ID utilisateur invalide' });
      return;
    }
    
    // Vérifier si l'utilisateur est admin
    if (!decodedToken.admin) {
      res.status(403).json({ error: 'Accès admin requis pour importer des devoirs' });
      return;
    }
    
    // Vérifier les paramètres requis
    if (!userId || !password) {
      res.status(400).json({ error: 'Identifiants manquants' });
      return;
    }
    
    console.log(`Tentative d'import pour l'utilisateur: ${userIdFirebase}`);
    
    // Ici, vous devriez ajouter la logique pour récupérer les devoirs depuis l'ENT
    // Pour l'instant, on simule une réponse réussie avec 0 devoir importé
    
    const result = {
      success: true,
      count: 0,
      message: 'Fonctionnalité d\'import en cours de développement',
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json(result);
    
  } catch (error) {
    console.error('Erreur lors de l\'import des devoirs:', error);
    res.status(500).json({ 
      error: 'Erreur interne du serveur',
      details: error.message 
    });
  }
});

export const credentialCipher = onRequest({
  secrets: [CREDENTIAL_SECRET_B64]
}, async (req, res) => {
  const origin = req.get("Origin") || "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send({ error: "Method not allowed" });
    return;
  }

  let decoded;
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).send({ error: "Missing Authorization header" });
      return;
    }
    decoded = await admin.auth().verifyIdToken(token, true);
  } catch (err) {
    logger.warn("[credentialCipher] Token invalide", err);
    res.status(401).send({ error: "Unauthorized" });
    return;
  }

  const { action, fields } = req.body || {};
  if (!action || typeof fields !== "object" || Array.isArray(fields)) {
    res.status(400).send({ error: "Payload invalide" });
    return;
  }

  const secretValue = CREDENTIAL_SECRET_B64.value();
  const uid = String(decoded.uid || "");
  try {
    if (action === "encrypt") {
      const result = {};
      for (const [key, value] of Object.entries(fields)) {
        result[key] = encryptValue(value ?? "", uid, secretValue);
      }
      res.status(200).send({ data: result, uid });
      return;
    }
    if (action === "decrypt") {
      const result = {};
      for (const [key, value] of Object.entries(fields)) {
        if (isEncryptedValue(value)) {
          result[key] = decryptValue(value, uid, secretValue);
        } else {
          result[key] = String(value ?? "");
        }
      }
      res.status(200).send({ data: result, uid });
      return;
    }
    res.status(400).send({ error: "Action inconnue" });
  } catch (err) {
    logger.error("[credentialCipher] Erreur", err);
    res.status(500).send({ error: "Erreur interne" });
  }
});
function getParisHour(referenceDate) {
  const date = referenceDate ? new Date(referenceDate) : new Date();
  const year = date.getFullYear();
  const jan = new Date(year, 0, 1);
  const jul = new Date(year, 6, 1);
  const standardOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  const isDST = date.getTimezoneOffset() < standardOffset;
  const utcHour = date.getUTCHours();
  const offsetHours = isDST ? 2 : 1;
  return (utcHour + offsetHours + 24) % 24;
}

// Fonction pour supprimer automatiquement les rappels passés
async function cleanupPastReminders(now) {
  try {
    logger.info("[cleanupPastReminders] Début du nettoyage des rappels passés à 23h");
    
    // Supprimer uniquement les rappels de plus de 2 heures pour éviter de supprimer les rappels du jour
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;
    
    const pastRemindersSnapshot = await db
      .collection("devoirs")
      .where("rappel", "==", true)
      .where("timestampRappel", "<", twoHoursAgo)
      .get();

    if (pastRemindersSnapshot.empty) {
      logger.info("[cleanupPastReminders] Aucun rappel obsolète à supprimer");
      return;
    }

    const toDelete = [];
    pastRemindersSnapshot.forEach(doc => {
      toDelete.push(doc.id);
    });

    // Supprimer par lots de 450
    const batchSize = 450;
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = db.batch();
      const batchIds = toDelete.slice(i, i + batchSize);
      
      batchIds.forEach(id => {
        // Marquer avec autoDeleted avant suppression pour traçabilité
        const docRef = db.collection("devoirs").doc(id);
        batch.update(docRef, { autoDeleted: true, deletedAt: now });
        batch.delete(docRef);
      });
      
      await batch.commit();
      logger.info(`[cleanupPastReminders] Supprimé ${Math.min(batchSize, toDelete.length - i)} rappels obsolètes`);
    }

    logger.info(`[cleanupPastReminders] Nettoyage terminé: ${toDelete.length} rappels obsolètes supprimés`);
  } catch (err) {
    logger.error("[cleanupPastReminders] Erreur lors du nettoyage:", err);
  }
}

export const sendRemindersAtExactTimeV2 = onSchedule("every minute", async () => {
  try {
    const now = Date.now();
    const parisHour = getParisHour(new Date(now));

    logger.info(`Heure Europe/Paris detectee: ${parisHour}h (UTC=${new Date(now).getUTCHours()}h).`);
    if (parisHour >= 1 && parisHour < 7) {
      logger.info(`Fenetre de repos (01h-07h Europe/Paris). Heure actuelle: ${parisHour}h, execution ignoree.`);
      return;
    }

    // Nettoyer les rappels passés uniquement à 23h
    if (parisHour === 23) {
      await cleanupPastReminders(now);
    }

    const windowStart = now - 3 * 60 * 1000; // 3 minutes avant
    const windowEnd = now + 3 * 60 * 1000;   // 3 minutes apres

    logger.info("Verification des devoirs a notifier...");
    logger.info(`Fenetre: ${new Date(windowStart).toISOString()} -> ${new Date(windowEnd).toISOString()}`);

    // 1. Rappels existants
    const rappelsSnapshot = await db
      .collection("devoirs")
      .where("rappel", "==", true)
      .where("timestampRappel", ">=", windowStart)
      .where("timestampRappel", "<=", windowEnd)
      .get();

    // 2. Devoirs/évaluations sans rappel qui sont à notifier maintenant (heure exacte)
    const devoirsSnapshot = await db
      .collection("devoirs")
      .where("rappel", "==", false)
      .where("timestamp", ">=", windowStart)
      .where("timestamp", "<=", windowEnd)
      .where("notified", "==", false)
      .get();

    // Combiner les résultats
    const allDocs = [...rappelsSnapshot.docs, ...devoirsSnapshot.docs];

    if (allDocs.length === 0) {
      logger.info("Aucun devoir a notifier dans la fenetre.");
      return;
    }

    logger.info(`${allDocs.length} rappel(s)/devoir(s) trouves. Regroupement par utilisateur et minute...`);

    // Group by ownerUid and minute bucket
    const groups = new Map();
    for (const doc of allDocs) {
      const task = doc.data();
      if (!task || task.notified || !task.ownerUid) continue;
      
      // Utiliser timestampRappel pour les rappels, timestamp pour les devoirs/évals
      const timestamp = task.rappel ? task.timestampRappel : task.timestamp;
      const bucket = Math.floor(Number(timestamp || 0) / 60000);
      const key = `${task.ownerUid}::${bucket}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ id: doc.id, ...task });
    }

    logger.info(`Baskets calculees: ${groups.size}`);

    for (const [key, items] of groups.entries()) {
      const [ownerUid] = key.split("::");
      try {
        const userSnap = await db.collection("users").doc(ownerUid).get();
        if (!userSnap.exists) {
          logger.warn(`Utilisateur ${ownerUid} introuvable.`);
          continue;
        }
        const u = userSnap.data() || {};
        let tokens = [];
        
        // Prioriser les appareils mobiles
        const fcmDevices = u.fcmDevices || {};
        const mobileDevices = Object.entries(fcmDevices)
          .filter(([_, device]) => device.isMobile && device.priority === 'high')
          .map(([deviceId, device]) => device.token)
          .filter(token => token && token.trim());
        
        const preferredToken = typeof u.preferredFcmToken === "string" ? u.preferredFcmToken.trim() : "";
        
        // Utiliser les tokens mobiles en priorité
        if (mobileDevices.length > 0) {
          tokens = mobileDevices;
          logger.info(`Utilisation de ${mobileDevices.length} tokens mobiles pour ${ownerUid}`);
        } else if (preferredToken) {
          tokens = [preferredToken];
        } else {
          tokens = Array.isArray(u.fcmTokens) ? [...u.fcmTokens] : [];
          if (u.fcmToken && !tokens.includes(u.fcmToken)) tokens.push(u.fcmToken);
          tokens = Array.from(new Set(tokens.filter((t) => !!t)));
        }
        if (!tokens.length) {
          logger.warn(`Aucun token FCM pour ${ownerUid}.`);
          continue;
        }

        // Build combined notification
        const lines = items.map((it) => {
          const dueDateLabel = it.dueDate || it.date || it.rappelDate || "???";
          const mat = it.matiere || "Inconnu";
          const titre = it.titre || "Sans titre";
          const heure = it.heure || "??:??";
          const type = it.rappel ? "Rappel" : (it.type === "evaluation" ? "Évaluation" : "Devoir");
          return `• ${type} ${mat} — ${titre} (${dueDateLabel} ${heure})`;
        });
        
        const evalCount = items.filter(it => it.type === "evaluation" && !it.rappel).length;
        const devoirCount = items.filter(it => it.type !== "evaluation" && !it.rappel).length;
        const rappelCount = items.filter(it => it.rappel).length;
        
        let title;
        if (evalCount > 0 && devoirCount === 0 && rappelCount === 0) {
          title = evalCount > 1 ? `Tu as ${evalCount} évaluations aujourd'hui` : `Tu as une évaluation aujourd'hui`;
        } else if (devoirCount > 0 && evalCount === 0 && rappelCount === 0) {
          title = devoirCount > 1 ? `Tu as ${devoirCount} devoirs aujourd'hui` : `Tu as un devoir aujourd'hui`;
        } else if (rappelCount > 0 && evalCount === 0 && devoirCount === 0) {
          title = rappelCount > 1 ? `Tu as ${rappelCount} rappels` : `Tu as un rappel`;
        } else {
          const total = items.length;
          title = `Tu as ${total} chose${total > 1 ? 's' : ''} aujourd'hui`;
        }
        
        const body = lines.join("\n").slice(0, 900); // keep payload small

        const dataPayload = {
          title,
          body,
          count: String(items.length),
          icon: "/icone-notif-192.jpg",
          click_action: "/"
        };

        const resp = await admin.messaging().sendEachForMulticast({
          tokens,
          data: dataPayload,
          webpush: {
            headers: {
              Urgency: "high",
              TTL: "3600"
            }
          }
        });
        logger.info(`Notif groupee (${ownerUid}) -> success=${resp.successCount}, failure=${resp.failureCount}`);

        if (resp.failureCount > 0) {
          const toRemove = [];
          resp.responses.forEach((r, idx) => {
            if (!r.success) {
              const code = r.error?.errorInfo?.code || r.error?.code || "";
              logger.warn(`Echec envoi vers token ${tokens[idx]}: code=${code}`);
              if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) {
                toRemove.push(tokens[idx]);
              }
            }
          });
          if (toRemove.length) {
            // Nettoyer à la fois les tokens simples et les tokens dans fcmDevices
            const updateData = {
              fcmTokens: admin.firestore.FieldValue.arrayRemove(...toRemove)
            };
            
            // Nettoyer aussi dans fcmDevices
            toRemove.forEach(token => {
              Object.keys(fcmDevices).forEach(deviceId => {
                if (fcmDevices[deviceId].token === token) {
                  updateData[`fcmDevices.${deviceId}`] = admin.firestore.FieldValue.delete();
                }
              });
            });
            
            await db.collection("users").doc(ownerUid).update(updateData).catch(() => {});
            logger.info(`Nettoyage de ${toRemove.length} tokens invalides pour ${ownerUid}`);
          }
        }

        // Mark all items in this group as notified
        const batch = db.batch();
        items.forEach((it) => {
          batch.update(db.collection("devoirs").doc(it.id), { notified: true });
        });
        await batch.commit();
      } catch (err) {
        logger.error(`Erreur envoi notif groupee pour ${key}:`, err);
      }
    }

  } catch (err) {
    logger.error("Erreur globale:", err);
  }
});


function extractAdminFlag(data) {
  if (!data) return false;
  if (data.role && String(data.role).toLowerCase() === "admin") return true;
  if (Array.isArray(data.roles) && data.roles.some((r) => String(r).toLowerCase() === "admin")) {
    return true;
  }
  return Boolean(data.isAdmin || data.admin);
}

export const syncUserClaims = onDocumentWritten("users/{userId}", async (event) => {
  const beforeData = event.data?.before?.data();
  const afterSnap = event.data?.after;
  const afterData = afterSnap?.data();

  if (!afterData) {
    return;
  }

  const beforeAdmin = extractAdminFlag(beforeData);
  const afterAdmin = extractAdminFlag(afterData);

  if (beforeAdmin === afterAdmin) {
    return;
  }

  const uid = event.params.userId;

  try {
    const userRecord = await admin.auth().getUser(uid);
    const existingClaims = userRecord.customClaims || {};
    if ((existingClaims.admin ?? false) === afterAdmin) {
      return;
    }
    const newClaims = { ...existingClaims };
    if (afterAdmin) {
      newClaims.admin = true;
    } else {
      delete newClaims.admin;
    }
    await admin.auth().setCustomUserClaims(uid, newClaims);
    await afterSnap.ref.set(
      { customClaimsSyncedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    logger.info(`[syncUserClaims] Claims updated for ${uid}; admin=${afterAdmin}`);
  } catch (err) {
    logger.error(`[syncUserClaims] Failed to sync claims for ${uid}`, err);
  }
});

export const triggerBotRun = onRequest({ secrets: [
  GITHUB_WORKFLOW_TOKEN,
  GITHUB_WORKFLOW_REPO,
  GITHUB_WORKFLOW_ID,
  GITHUB_WORKFLOW_REF
] }, async (req, res) => {
  const origin = req.get("Origin") || "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send({ error: "Method not allowed" });
    return;
  }

  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).send({ error: "Missing Authorization header" });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(token, true);
    if (!decoded?.admin) {
      res.status(403).send({ error: "Admin privileges required" });
      return;
    }

    const email = String(decoded?.email || "").toLowerCase();
    if (email !== ADMIN_EMAIL.toLowerCase()) {
      res.status(403).send({ error: "Compte non autorisé" });
      return;
    }

    const workflowToken = GITHUB_WORKFLOW_TOKEN.value();
    const workflowRef = GITHUB_WORKFLOW_REF.value() || "main";
    const workflowId = GITHUB_WORKFLOW_ID.value() || "bot.yml";
    const workflowRepoRaw = GITHUB_WORKFLOW_REPO.value();
    const workflowRepo = normalizeGitHubRepo(workflowRepoRaw);

    if (!workflowToken || !workflowRepo) {
      logger.error(`[#triggerBotRun] Missing GitHub configuration (token or repo). repoRaw=${workflowRepoRaw}`);
      res.status(500).send({ error: "Configuration GitHub manquante" });
      return;
    }

    const workflowUrl = `https://api.github.com/repos/${workflowRepo}/actions/workflows/${workflowId}/dispatches`;
    const githubAuthHeader = buildGitHubAuthHeader(workflowToken);
    if (!githubAuthHeader) {
      logger.error("[triggerBotRun] Impossible de construire l'en-tête GitHub (token manquant ou invalide).");
      res.status(500).send({ error: "Configuration GitHub invalide" });
      return;
    }

    const runRef = await db.collection("botRuns").add({
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      requestedBy: decoded.uid,
      status: "queued",
      workflowUrl,
      workflowId,
      workflowRef
    });

    const payload = {
      ref: workflowRef,
      inputs: {
        forceRun: "true",
        triggerSource: "app"
      }
    };

    const response = await fetch(workflowUrl, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        Authorization: githubAuthHeader,
        "User-Agent": "calendrier-app-trigger",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorText;
      let parsed;
      try {
        parsed = await response.clone().json();
        errorText = JSON.stringify(parsed);
      } catch (err) {
        errorText = await response.text();
      }
      const truncated = (errorText || "").slice(0, 1000);
      logger.error(
        `[triggerBotRun] GitHub dispatch failed (run=${runRef.id}, status=${response.status}): ${truncated}`
      );
      await runRef.update({
        status: "dispatch_failed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        error: truncated,
        httpStatus: response.status
      });
      const clientError = parsed?.message || response.statusText || "Echec de l'ordonnancement GitHub";
      const hint = response.status === 404
        ? "Vérifiez le dépôt (owner/repo), le nom du workflow et les autorisations du token."
        : undefined;
      res.status(response.status === 404 ? 404 : 502).send({ error: clientError, hint });
      return;
    }

    await runRef.update({
      status: "dispatch_success",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info(`[triggerBotRun] Bot run dispatched by ${decoded.uid} (ref=${runRef.id})`);

    res.status(202).send({ success: true, runId: runRef.id, status: "dispatch_success" });
  } catch (err) {
    logger.error("[triggerBotRun] Failed to enqueue bot run:", err);
    res.status(500).send({ error: "Erreur interne" });
  }
});


// Daily cleanup of old tasks (>60 days) for all types (devoir, evaluation, rappel)
export const cleanupOldDevoirs = onSchedule("every 24 hours", async () => {
  try {
    const now = Date.now();
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000; // 60 jours en ms
    const cutoff = now - sixtyDaysMs;

    logger.info(`[cleanupOldDevoirs] Starting. Cutoff timestamp: ${cutoff} (${new Date(cutoff).toISOString()})`);

    // Helper to delete docs by ids in batches of 450 to account for cascading deletes
    async function deleteIds(ids) {
      const batchSize = 450;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = db.batch();
        const batchIds = ids.slice(i, i + batchSize);
        
        for (const id of batchIds) {
          const docRef = db.collection("devoirs").doc(id);
          // Marquer avec autoDeleted avant suppression
          batch.update(docRef, { autoDeleted: true, deletedAt: now });
          batch.delete(docRef);
        }
        
        await batch.commit();
        logger.info(`[cleanupOldDevoirs] Deleted batch ${Math.floor(i / batchSize) + 1}: ${batchIds.length} docs`);
      }
    }

    // Collect candidates
    const toDeleteIds = new Set();

    // 1) Rappels (timestampRappel)
    const rappelsSnap = await db
      .collection("devoirs")
      .where("rappel", "==", true)
      .where("timestampRappel", "<=", cutoff)
      .get();

    rappelsSnap.forEach((d) => toDeleteIds.add(d.id));

    // 2) Devoirs / Evaluations (timestamp)
    const tasksSnap = await db
      .collection("devoirs")
      .where("rappel", "==", false)
      .where("timestamp", "<=", cutoff)
      .get();

    tasksSnap.forEach((d) => toDeleteIds.add(d.id));

    logger.info(`[cleanupOldDevoirs] Found ${toDeleteIds.size} primary documents to delete.`);

    // Cascade by groupId: delete all docs sharing the same group if the primary is due/eval
    // Build groupIds from tasksSnap (non-rappel only)
    const groupIds = new Set();
    tasksSnap.forEach((d) => {
      const data = d.data() || {};
      if (data.groupId) groupIds.add(String(data.groupId));
    });

    // For each groupId, fetch linked docs and mark for deletion
    for (const gid of groupIds) {
      try {
        const groupSnap = await db
          .collection("devoirs")
          .where("groupId", "==", gid)
          .get();
        groupSnap.forEach((docSnap) => toDeleteIds.add(docSnap.id));
      } catch (e) {
        logger.warn(`[cleanupOldDevoirs] Failed to fetch group ${gid}:`, e);
      }
    }

    const allIds = Array.from(toDeleteIds);
    if (!allIds.length) {
      logger.info("[cleanupOldDevoirs] Nothing to delete.");
      return;
    }

    logger.info(`[cleanupOldDevoirs] Deleting ${allIds.length} document(s) from devoirs…`);
    await deleteIds(allIds);
    logger.info("[cleanupOldDevoirs] Cleanup completed.");
  } catch (err) {
    logger.error("[cleanupOldDevoirs] Error:", err);
  }
});

export const subscribeToTopic = onRequest(async (req, res) => {
  const origin = req.get("Origin") || "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Max-Age", "86400");

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

export const notifyCredentialIssues = onDocumentWritten("users/{userId}", async (event) => {
  const beforeData = event.data?.before?.data();
  const afterSnap = event.data?.after;
  const afterData = afterSnap?.data();

  if (!afterData) {
    return;
  }

  const beforeStatus = beforeData?.authStatus;
  const afterStatus = afterData.authStatus;

  if (afterStatus !== "error" || beforeStatus === "error") {
    return;
  }

  const displayName =
    afterData.displayName || afterData.prenom || afterData.nom || event.params.userId;
  const reason = afterData.authError || "Identifiant ou mot de passe incorrect.";

  let tokens = Array.isArray(afterData.fcmTokens) ? [...afterData.fcmTokens] : [];
  if (afterData.fcmToken && !tokens.includes(afterData.fcmToken)) {
    tokens.push(afterData.fcmToken);
  }
  tokens = Array.from(new Set(tokens.filter((t) => !!t)));

  if (!tokens.length) {
    logger.warn(
      `[notifyCredentialIssues] Aucun token FCM pour ${event.params.userId}; impossible d'envoyer une notification.`
    );
  } else {
    try {
      const message = {
        tokens,
        notification: {
          title: "Identifiants Ecole en Ligne a mettre a jour",
          body: `${displayName}, merci de verifier vos informations (${reason}).`,
        },
        data: {
          type: "credential_issue",
          reason,
          displayName,
          userId: event.params.userId,
        },
        webpush: {
          headers: {
            Urgency: "high",
            TTL: "300"
          },
          fcmOptions: {
            link: "/"
          }
        }
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      logger.info(
        `[notifyCredentialIssues] Notif cred: success=${response.successCount}, failure=${response.failureCount} (userId=${event.params.userId}).`
      );

      if (response.failureCount > 0) {
        const invalidTokens = [];
        response.responses.forEach((r, idx) => {
          if (!r.success) {
            const code = r.error?.errorInfo?.code || r.error?.code || "";
            logger.warn(
              `[notifyCredentialIssues] Echec notif vers token ${tokens[idx]}: ${code}`
            );
            if (
              code.includes("registration-token-not-registered") ||
              code.includes("invalid-registration-token")
            ) {
              invalidTokens.push(tokens[idx]);
            }
          }
        });
        if (invalidTokens.length) {
          try {
            await afterSnap.ref.update({
              fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
            });
            logger.info(
              `[notifyCredentialIssues] Tokens invalides retires pour ${event.params.userId}.`
            );
          } catch (tokenErr) {
            logger.error(
              `[notifyCredentialIssues] Impossible de retirer les tokens invalides pour ${event.params.userId}.`,
              tokenErr
            );
          }
        }
      }
    } catch (error) {
      logger.error(
        `[notifyCredentialIssues] Echec d'envoi FCM pour ${event.params.userId}.`,
        error
      );
    }
  }

  try {
    await afterSnap.ref.set(
      {
        lastCredentialAlertAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    logger.error(
      `[notifyCredentialIssues] Impossible d'enregistrer lastCredentialAlertAt pour ${event.params.userId}.`,
      error
    );
  }
});

// Fonction pour gérer les rôles admin
export const manageAdminRole = onRequest({ cors: true }, async (req, res) => {
  if (!handleCors(req, res)) return;
  
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Non autorisé' });
      return;
    }
    
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded.admin) {
      res.status(403).json({ error: 'Accès admin requis' });
      return;
    }
    
    const { targetUserId, action } = req.body;
    
    if (action === 'add') {
      await admin.auth().setCustomUserClaims(targetUserId, { admin: true });
      await db.collection('users').doc(targetUserId).update({ 
        role: 'admin',
        adminUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else if (action === 'remove') {
      await admin.auth().setCustomUserClaims(targetUserId, { admin: false });
      await db.collection('users').doc(targetUserId).update({ 
        role: null,
        adminUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fonction pour lister les utilisateurs avec leurs rôles
export const listUsersWithRoles = onRequest({ cors: true }, async (req, res) => {
  if (!handleCors(req, res)) return;
  
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Non autorisé' });
      return;
    }
    
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded.admin) {
      res.status(403).json({ error: 'Accès admin requis' });
      return;
    }
    
    const usersSnapshot = await db.collection('users').get();
    const users = [];
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      users.push({
        uid: doc.id,
        email: userData.email,
        displayName: userData.displayName || userData.prenom || 'Inconnu',
        role: userData.role || 'user',
        isAdmin: userData.role === 'admin',
        lastLogin: userData.lastLogin,
        createdAt: userData.createdAt
      });
    });
    
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});








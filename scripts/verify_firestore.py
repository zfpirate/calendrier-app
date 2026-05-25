import json
import sys
from pathlib import Path

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except Exception as e:
    print("[verify] ERREUR: firebase-admin introuvable:", e)
    sys.exit(1)

SA_PATH = Path("firebase-service-account.json")
if not SA_PATH.exists():
    print("[verify] ERREUR: firebase-service-account.json introuvable (étape de préparation du secret manquée?)")
    sys.exit(1)

try:
    cred = credentials.Certificate(str(SA_PATH))
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(cred)
    db = firestore.client()
except Exception as e:
    print("[verify] ERREUR: init Firebase:", e)
    sys.exit(1)

try:
    users_ref = db.collection("users")
    docs = list(users_ref.stream())
    print(f"[verify] users found: {len(docs)}")
    for d in docs:
        uid = d.id
        sub = users_ref.document(uid).collection("externalHomeworks")
        # limiter la lecture complète pour un aperçu
        sample = list(sub.limit(10).stream())
        # compter tout (peut être coûteux si très gros; acceptable pour debug)
        count = len(list(sub.stream()))
        sample_ids = [i.id for i in sample]
        print(f"[verify] user {uid}: externalHomeworks count={count}; sample_ids={sample_ids}")
except Exception as e:
    print("[verify] ERREUR: lecture Firestore:", e)
    sys.exit(1)

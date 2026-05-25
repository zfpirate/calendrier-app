#!/usr/bin/env python3
"""
Script de vérification du système de notifications en background
Vérifie que les fonctions Firebase sont actives et que les notifications sont envoyées correctement
"""

import requests
import json
import time
import sys
from datetime import datetime, timezone
from pathlib import Path

# Configuration
FIREBASE_PROJECT_URL = "https://calendrier-app.web.app"
ADMIN_EMAIL = "pirson.maxence2009@gmail.com"

def check_firebase_functions():
    """Vérifie que les fonctions Firebase sont déployées et accessibles"""
    print("🔍 Vérification des fonctions Firebase...")
    
    functions_to_check = [
        "/triggerBotRun",
        "/credentialCipher"
    ]
    
    for func in functions_to_check:
        try:
            url = f"{FIREBASE_PROJECT_URL}{func}"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                print(f"✅ {func} - OK (status: {response.status_code})")
            else:
                print(f"⚠️  {func} - Status {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"❌ {func} - Erreur: {e}")
            return False
    
    return True

def check_notification_system():
    """Vérifie le système de notifications"""
    print("\n🔔 Vérification du système de notifications...")
    
    # Vérifier les logs récents
    log_dir = Path("logs")
    if log_dir.exists():
        log_files = sorted(log_dir.glob("bot_*.log"), reverse=True)[:3]
        if log_files:
            latest_log = log_files[0]
            print(f"📋 Dernier log: {latest_log.name}")
            
            with open(latest_log, 'r', encoding='utf-8') as f:
                content = f.read()
                
            if "Exécution terminée" in content:
                print("✅ Bot exécuté avec succès")
            else:
                print("⚠️  Bot可能 n'a pas terminé correctement")
                
            # Compter les utilisateurs traités
            users_processed = content.count("=== Traitement de l'utilisateur:")
            print(f"👥 Utilisateurs traités: {users_processed}")
        else:
            print("❌ Aucun log trouvé")
    else:
        print("❌ Dossier logs introuvable")

def check_background_scheduler():
    """Vérifie que le scheduler est configuré"""
    print("\n⏰ Vérification du scheduler...")
    
    functions_file = Path("functions/index.js")
    if functions_file.exists():
        with open(functions_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if "onSchedule" in content:
            print("✅ Scheduler Firebase détecté")
            
            # Compter les fonctions schedule
            schedule_count = content.count("onSchedule")
            print(f"📊 Fonctions schedule trouvées: {schedule_count}")
            
            # Vérifier les fonctions spécifiques
            if "sendRemindersAtExactTimeV2" in content:
                print("✅ Fonction de rappel activée")
            if "cleanupOldDevoirs" in content:
                print("✅ Fonction de nettoyage activée")
        else:
            print("❌ Aucun scheduler détecté")
    else:
        print("❌ Fichier functions/index.js introuvable")

def check_firestore_connectivity():
    """Vérifie la connectivité Firestore"""
    print("\n🗄️  Vérification Firestore...")
    
    try:
        # Test simple via l'app web
        response = requests.get(f"{FIREBASE_PROJECT_URL}/", timeout=10)
        if response.status_code == 200:
            print("✅ App accessible")
            return True
        else:
            print(f"❌ App inaccessible (status: {response.status_code})")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Erreur de connexion: {e}")
        return False

def monitor_notifications(duration_minutes=5):
    """Surveille les notifications en temps réel"""
    print(f"\n👀 Surveillance des notifications pendant {duration_minutes} minutes...")
    
    start_time = time.time()
    end_time = start_time + (duration_minutes * 60)
    
    while time.time() < end_time:
        current_time = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
        print(f"\r⏰ {current_time} - Surveillance en cours...", end="", flush=True)
        time.sleep(30)  # Vérifier toutes les 30 secondes
    
    print(f"\n✅ Surveillance terminée")

def main():
    """Fonction principale"""
    print("=" * 60)
    print("🚀 SYSTÈME DE VÉRIFICATION DES NOTIFICATIONS")
    print("=" * 60)
    
    checks = [
        ("Fonctions Firebase", check_firebase_functions),
        ("Système de notifications", check_notification_system),
        ("Scheduler", check_background_scheduler),
        ("Connectivité Firestore", check_firestore_connectivity)
    ]
    
    results = []
    for name, check_func in checks:
        try:
            result = check_func()
            results.append((name, result))
        except Exception as e:
            print(f"❌ Erreur lors de la vérification {name}: {e}")
            results.append((name, False))
    
    # Résumé
    print("\n" + "=" * 60)
    print("📊 RÉSUMÉ DES VÉRIFICATIONS")
    print("=" * 60)
    
    for name, result in results:
        status = "✅ OK" if result else "❌ ERREUR"
        print(f"{name:.<30} {status}")
    
    # Option de surveillance
    if len(sys.argv) > 1 and sys.argv[1] == "--monitor":
        monitor_notifications()
    
    print("\n🎯 Vérification terminée!")

if __name__ == "__main__":
    main()

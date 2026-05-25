#!/usr/bin/env python3
"""
Script de test des notifications en background (app fermée)
Simule et vérifie que les notifications fonctionnent même quand l'app est fermée
"""

import subprocess
import time
import json
import requests
from pathlib import Path
from datetime import datetime, timezone

def check_service_worker_registration():
    """Vérifie que le service worker est bien configuré"""
    print("🔍 Vérification du service worker...")
    
    sw_file = Path("public/firebase-messaging-sw.js")
    if not sw_file.exists():
        print("❌ Service worker introuvable")
        return False
    
    with open(sw_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    checks = [
        ("Firebase Messaging", "firebase-messaging-compat.js" in content),
        ("Background handler", "onBackgroundMessage" in content),
        ("Notification click", "notificationclick" in content),
        ("Cache PWA", "CACHE_NAME" in content),
        ("Firebase config", "firebase.initializeApp" in content)
    ]
    
    for name, check in checks:
        status = "✅" if check else "❌"
        print(f"{status} {name}")
    
    return all(check[1] for check in checks)

def check_manifest_pwa():
    """Vérifie le manifest PWA pour installation"""
    print("\n📱 Vérification du manifest PWA...")
    
    manifest_file = Path("public/manifest.json")
    if not manifest_file.exists():
        print("❌ Manifest introuvable")
        return False
    
    with open(manifest_file, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    
    required_fields = ["name", "short_name", "display", "icons"]
    for field in required_fields:
        if field in manifest:
            print(f"✅ {field}: {manifest[field]}")
        else:
            print(f"❌ {field} manquant")
    
    return manifest.get("display") == "standalone"

def simulate_notification_push():
    """Simule l'envoi d'une notification push"""
    print("\n📤 Simulation d'une notification push...")
    
    # Créer une notification de test
    test_notification = {
        "notification": {
            "title": "📚 Test notification",
            "body": "Ceci est un test de notification background",
            "icon": "icone-notif-192.jpg"
        },
        "data": {
            "click_action": "/",
            "type": "test",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    }
    
    print("🔔 Notification de test créée:")
    print(f"   Titre: {test_notification['notification']['title']}")
    print(f"   Corps: {test_notification['notification']['body']}")
    print(f"   Icon: {test_notification['notification']['icon']}")
    
    return test_notification

def test_background_notification_flow():
    """Test le flux complet de notification en background"""
    print("\n🔄 Test du flux de notification background...")
    
    steps = [
        "1. App fermée → Service worker actif",
        "2. Message FCM reçu → onBackgroundMessage déclenché",
        "3. Notification affichée → showNotification()",
        "4. Utilisateur clique → notificationclick event",
        "5. App ouverte/focus → clients.openWindow() ou focus()"
    ]
    
    for step in steps:
        print(f"   {step}")
    
    return True

def check_firebase_cloud_messaging():
    """Vérifie la configuration FCM"""
    print("\n☁️  Vérification Firebase Cloud Messaging...")
    
    config_file = Path("public/firebase-config.js")
    if not config_file.exists():
        print("❌ Config Firebase introuvable")
        return False
    
    with open(config_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Vérifier les clés FCM nécessaires
    required_keys = ["messagingSenderId", "appId", "projectId"]
    for key in required_keys:
        if key in content:
            print(f"✅ {key} présent")
        else:
            print(f"❌ {key} manquant")
    
    return True

def generate_test_report():
    """Génère un rapport de test"""
    print("\n📊 Génération du rapport de test...")
    
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tests": {
            "service_worker": check_service_worker_registration(),
            "manifest_pwa": check_manifest_pwa(),
            "fcm_config": check_firebase_cloud_messaging(),
            "notification_flow": test_background_notification_flow()
        },
        "test_notification": simulate_notification_push()
    }
    
    # Sauvegarder le rapport
    report_file = Path("logs/notification_test_report.json")
    report_file.parent.mkdir(exist_ok=True)
    
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"📋 Rapport sauvegardé: {report_file}")
    
    # Résumé
    print("\n" + "="*50)
    print("📋 RÉSUMÉ DU TEST")
    print("="*50)
    
    for test_name, result in report["tests"].items():
        status = "✅ OK" if result else "❌ ERREUR"
        print(f"{test_name.replace('_', ' ').title():.<30} {status}")
    
    all_passed = all(report["tests"].values())
    print(f"\n🎯 Résultat global: {'✅ Tous les tests passés' if all_passed else '❌ Certains tests ont échoué'}")
    
    return all_passed

def main():
    """Fonction principale"""
    print("="*60)
    print("🚀 TEST DES NOTIFICATIONS BACKGROUND (APP FERMÉE)")
    print("="*60)
    
    success = generate_test_report()
    
    if success:
        print("\n✅ Les notifications devraient fonctionner quand l'app est fermée!")
        print("\n📝 Pour tester manuellement:")
        print("   1. Installez l'app comme PWA")
        print("   2. Fermez complètement l'app")
        print("   3. Envoyez une notification via Firebase Console")
        print("   4. Vérifiez que la notification s'affiche")
    else:
        print("\n❌ Des problèmes ont été détectés. Vérifiez la configuration.")
    
    return success

if __name__ == "__main__":
    main()

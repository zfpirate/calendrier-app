"""
Script de test pour le système de logging.
"""
import os
import sys
import time
from pathlib import Path
from logger import setup_logger, get_logger

def test_logging():
    """Teste le système de logging."""
    # Configuration du logger
    logger = setup_logger(
        name='test_logger',
        log_level='DEBUG',
        log_dir=os.path.join(os.path.expanduser('~'), 'Google Drive', 'CalendrierApp', 'logs')
    )
    
    # Test des différents niveaux de log
    logger.debug("Ceci est un message de débogage")
    logger.info("Ceci est un message d'information")
    logger.warning("Ceci est un avertissement")
    logger.error("Ceci est une erreur")
    
    # Test avec des données structurées
    try:
        # Génère intentionnellement une erreur
        1 / 0
    except Exception as e:
        logger.exception("Une erreur s'est produite")
    
    # Vérification du fichier de log
    log_file = Path.home() / 'Google Drive' / 'CalendrierApp' / 'logs' / 'test_logger.log'
    if log_file.exists():
        print(f"✅ Le fichier de log a été créé avec succès : {log_file}")
        try:
            with open(log_file, 'r', encoding='utf-8') as f:
                content = f.read()
                print("✅ Le fichier de log contient des données :", bool(content))
                print("\nContenu du fichier de log :")
                print("-" * 50)
                print(content)
                print("-" * 50)
        except Exception as e:
            print(f"❌ Impossible de lire le fichier de log : {e}")
    else:
        print(f"❌ Le fichier de log n'a pas été créé à l'emplacement attendu : {log_file}")
        
        # Essai avec un emplacement alternatif
        alt_log_file = Path('logs/test_logger.log')
        if alt_log_file.exists():
            print(f"ℹ️  Fichier de log trouvé à l'emplacement alternatif : {alt_log_file}")

if __name__ == "__main__":
    print("Début du test du système de logging...")
    test_logging()
    print("Test terminé.")

import os
import sys
import shutil
import time
import logging
from datetime import datetime
from pathlib import Path

def print_help():
    print("""
SYNCHRONISATEUR DE LOGS - Calendrier App
---------------------------------------
Synchronise les fichiers de logs vers un dossier de destination (par défaut Google Drive).

Utilisation :
  python sync_logs.py [options]

Options :
  --help, -h       Affiche ce message d'aide
  --path=PATH      Spécifie le chemin du dossier de destination
  --verbose, -v    Affiche plus de détails
    """)

def ensure_drive_dir(drive_dir):
    """Crée le dossier de destination s'il n'existe pas"""
    try:
        if not os.path.exists(drive_dir):
            os.makedirs(drive_dir)
            print(f"Dossier créé : {drive_dir}")
        return True
    except Exception as e:
        print(f"Erreur lors de la création du dossier {drive_dir} : {e}")
        return False

def sync_logs(destination_dir=None, verbose=False):
    try:
        # Configuration des chemins
        script_dir = os.path.dirname(os.path.abspath(__file__))
        source_dir = os.path.normpath(os.path.join(script_dir, '..', 'logs'))
        
        # Dossier de destination par défaut dans Google Drive
        if not destination_dir:
            drive_logs_dir = os.path.expanduser("~\\Google Drive\\Mon Drive\\CalendrierApp_Logs")
        else:
            drive_logs_dir = os.path.abspath(destination_dir)
        
        # S'assurer que le dossier de destination existe
        if not ensure_drive_dir(drive_logs_dir):
            return 1
            
        if verbose:
            print(f"[DEBUG] Dossier source : {source_dir}")
            print(f"[DEBUG] Dossier de destination : {drive_logs_dir}")
            
        # Vérification du dossier source
        if not os.path.exists(source_dir):
            print(f"ERREUR: Le dossier source n'existe pas : {source_dir}")
            return 1
            
        # Vérification des fichiers de log
        log_files = [f for f in os.listdir(source_dir) 
                    if f.endswith(('.log', '.log.clean')) and 
                    os.path.isfile(os.path.join(source_dir, f))]
        
        if not log_files:
            print("AUCUN FICHIER LOG TROUVÉ")
            print(f"Vérifiez que des fichiers .log existent dans : {source_dir}")
            return 1
            
        if verbose:
            print(f"[DEBUG] Fichiers trouvés : {', '.join(log_files)}")
        
        # Vérifier si le dossier de destination existe
        if not os.path.exists(drive_logs_dir):
            print(f"ERREUR: Le dossier de destination n'existe pas : {drive_logs_dir}")
            return 1
        
        # Nettoyage des logs avant la copie
        clean_script = os.path.join(script_dir, 'clean_logs.py')
        if os.path.exists(clean_script):
            print("Nettoyage des logs...")
            os.system(f'python "{clean_script}"')
            
        # Copie des fichiers
        success_count = 0
        for filename in log_files:
            src = os.path.join(source_dir, filename)
            
            # Gestion des fichiers nettoyés
            if filename.endswith('.clean'):
                dst_filename = filename.replace('.clean', '')
            else:
                dst_filename = filename
                
            dst = os.path.join(drive_logs_dir, dst_filename)
            
            try:
                if verbose:
                    print(f"[DEBUG] Copie de {src} vers {dst}")
                
                shutil.copy2(src, dst)
                success_count += 1
                print(f"✓ {filename} synchronisé")
                
                # Créer une archive datée pour les logs principaux
                if filename in ['bot_latest.log', 'bot_latest.log.clean']:
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    archive_name = f"bot_{timestamp}.log"
                    archive_path = os.path.join(drive_logs_dir, archive_name)
                    shutil.copy2(src, archive_path)
                    print(f"  → Archive créée : {archive_name}")
                
            except Exception as e:
                print(f"✗ Erreur avec {filename} : {str(e)}")
                logging.error(f"Erreur lors de la copie de {filename} : {e}")
        
        # Résumé
        print("\n" + "="*50)
        print(f"SYNCHRONISATION TERMINÉE - {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
        print("="*50)
        print(f"Fichiers synchronisés : {success_count}/{len(log_files)}")
        print(f"Dossier de destination : {drive_logs_dir}")
        print("="*50)
        
        return 0 if success_count > 0 else 1
        
    except Exception as e:
        print("\n" + "!"*50)
        print("ERREUR CRITIQUE")
        print("!"*50)
        print(f"Type d'erreur : {type(e).__name__}")
        print(f"Message d'erreur : {str(e)}")
        print("\nINFORMATIONS DE DÉBOGAGE :")
        print(f"Script : {os.path.abspath(__file__)}")
        print(f"Dossier source : {source_dir}" if 'source_dir' in locals() else "Dossier source : non défini")
        print("!"*50)
        return 1

def setup_logging():
    """Configure la journalisation"""
    log_format = '%(asctime)s - %(levelname)s - %(message)s'
    logging.basicConfig(
        level=logging.INFO,
        format=log_format,
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('sync_logs.log')
        ]
    )

if __name__ == "__main__":
    import argparse
    
    # Configuration du logging
    setup_logging()
    
    parser = argparse.ArgumentParser(description='Synchronise les logs vers un dossier de destination')
    parser.add_argument('--path', '-p', help='Chemin du dossier de destination')
    parser.add_argument('--verbose', '-v', action='store_true', help='Affiche plus de détails')
    args = parser.parse_args()
    
    try:
        print("\n" + "="*50)
        print(f"Début de la synchronisation des logs - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*50)
        
        result = sync_logs(args.path, args.verbose)
        
        print("\n" + "="*50)
        print("Synchronisation terminée avec succès!" if result == 0 else "La synchronisation a échoué!")
        print("="*50)
        
        sys.exit(result)
    except Exception as e:
        logging.error(f"Erreur lors de la synchronisation des logs : {e}", exc_info=True)
        sys.exit(1)
    
    # Suppression des lignes en double qui causaient une erreur

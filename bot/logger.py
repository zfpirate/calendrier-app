import logging
import logging.handlers
from pathlib import Path
import sys
from typing import Optional
from datetime import datetime, timedelta
import os
import glob

def clean_old_logs(log_dir: Path = None, days_to_keep: int = 7) -> None:
    """Supprime les fichiers de logs plus anciens que X jours."""
    if log_dir is None:
        log_dir = Path('logs')
    
    if not log_dir.exists():
        return
    
    cutoff_date = datetime.now() - timedelta(days=days_to_keep)
    
    # Parcourir tous les fichiers .log dans le dossier
    for log_file in log_dir.glob('*.log'):
        try:
            # Obtenir la date de modification du fichier
            file_mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
            
            # Supprimer si le fichier est plus ancien que la date limite
            if file_mtime < cutoff_date:
                log_file.unlink()
                print(f"Supprimé: {log_file.name}")
        except Exception as e:
            print(f"Erreur lors de la suppression de {log_file.name}: {e}")

# Configuration du logger
def setup_logger(name: str = 'bot', log_level: str = 'INFO', auto_clean: bool = True, days_to_keep: int = 7) -> logging.Logger:
    """Configure un logger simple avec sortie console et fichier."""
    # Création du répertoire de logs s'il n'existe pas
    log_dir = Path('logs')
    log_dir.mkdir(exist_ok=True)
    
    # Nettoyage automatique des anciens logs si activé
    if auto_clean:
        clean_old_logs(log_dir, days_to_keep)
    
    # Configuration du logger
    logger = logging.getLogger(name)
    logger.setLevel(log_level.upper())
    
    if logger.handlers:
        return logger
    
    # Format des logs
    formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Handler fichier avec timestamp
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_file = log_dir / f'bot_{timestamp}.log'
    
    try:
        file_handler = logging.FileHandler(
            log_file,
            mode='w',  # Crée un nouveau fichier à chaque lancement
            encoding='utf-8'
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except PermissionError:
        # Fallback sur le répertoire temporaire si permissions refusées
        import tempfile
        temp_dir = Path(tempfile.gettempdir()) / 'calendrier-app-logs'
        temp_dir.mkdir(exist_ok=True)
        log_file = temp_dir / f'bot_{timestamp}.log'
        file_handler = logging.FileHandler(
            log_file,
            mode='w',
            encoding='utf-8'
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        print(f"[LOGGER] Fallback vers répertoire temporaire: {log_file}")
    
    # Handler pour bot_latest.log (toujours le dernier)
    try:
        latest_handler = logging.FileHandler(
            log_dir / 'bot_latest.log',
            mode='w',  # Écrase le fichier à chaque lancement
            encoding='utf-8'
        )
        latest_handler.setFormatter(formatter)
        logger.addHandler(latest_handler)
    except PermissionError:
        # Fallback temporaire pour latest.log aussi
        import tempfile
        temp_dir = Path(tempfile.gettempdir()) / 'calendrier-app-logs'
        temp_dir.mkdir(exist_ok=True)
        latest_handler = logging.FileHandler(
            temp_dir / 'bot_latest.log',
            mode='w',
            encoding='utf-8'
        )
        latest_handler.setFormatter(formatter)
        logger.addHandler(latest_handler)
        print(f"[LOGGER] Fallback latest.log vers: {temp_dir / 'bot_latest.log'}")
    
    # Handler console
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    return logger

def get_logger(name: str = 'bot') -> logging.Logger:
    """Retourne un logger configuré."""
    return logging.getLogger(name)

# Initialisation du logger
logger = setup_logger()

# Alias pratiques
debug = logger.debug
info = logger.info
warning = logger.warning
error = logger.error
critical = logger.critical
exception = logger.exception

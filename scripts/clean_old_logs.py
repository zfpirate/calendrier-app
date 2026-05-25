#!/usr/bin/env python3
"""
Script de nettoyage des anciens logs
Supprime automatiquement les fichiers de logs plus anciens que X jours
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
import argparse

def clean_old_logs(log_dir: Path = None, days_to_keep: int = 7, dry_run: bool = False) -> int:
    """
    Supprime les fichiers de logs plus anciens que X jours.
    
    Args:
        log_dir: Dossier contenant les logs (défaut: 'logs')
        days_to_keep: Nombre de jours à conserver (défaut: 7)
        dry_run: Si True, affiche les fichiers qui seraient supprimés sans les supprimer
    
    Returns:
        Nombre de fichiers supprimés
    """
    if log_dir is None:
        script_dir = Path(__file__).parent
        log_dir = script_dir.parent / 'logs'
    
    if not log_dir.exists():
        print(f"Le dossier de logs n'existe pas: {log_dir}")
        return 0
    
    cutoff_date = datetime.now() - timedelta(days=days_to_keep)
    deleted_count = 0
    
    print(f"Nettoyage des logs dans: {log_dir}")
    print(f"Conservation des logs depuis: {cutoff_date.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Mode test: {'Oui' if dry_run else 'Non'}")
    print("-" * 50)
    
    # Parcourir tous les fichiers .log dans le dossier
    for log_file in log_dir.glob('*.log'):
        try:
            # Obtenir la date de modification du fichier
            file_mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
            
            # Vérifier si le fichier doit être supprimé
            if file_mtime < cutoff_date:
                file_size = log_file.stat().st_size
                if dry_run:
                    print(f"[TEST] Serait supprimé: {log_file.name} ({file_size} bytes, {file_mtime.strftime('%Y-%m-%d %H:%M:%S')})")
                else:
                    log_file.unlink()
                    print(f"Supprimé: {log_file.name} ({file_size} bytes, {file_mtime.strftime('%Y-%m-%d %H:%M:%S')})")
                    deleted_count += 1
            else:
                if dry_run:
                    print(f"[TEST] Conservé: {log_file.name} (trop récent)")
                    
        except Exception as e:
            print(f"Erreur lors du traitement de {log_file.name}: {e}")
    
    print("-" * 50)
    if dry_run:
        print(f"Mode test - {deleted_count} fichiers seraient supprimés")
    else:
        print(f"Nettoyage terminé - {deleted_count} fichiers supprimés")
    
    return deleted_count

def main():
    parser = argparse.ArgumentParser(description='Nettoie les anciens fichiers de logs')
    parser.add_argument('--days', '-d', type=int, default=7, 
                       help='Nombre de jours à conserver (défaut: 7)')
    parser.add_argument('--path', '-p', type=str, 
                       help='Chemin du dossier de logs (défaut: ../logs)')
    parser.add_argument('--dry-run', '-n', action='store_true',
                       help='Mode test - affiche les fichiers qui seraient supprimés sans les supprimer')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Affiche plus de détails')
    
    args = parser.parse_args()
    
    # Déterminer le dossier de logs
    if args.path:
        log_dir = Path(args.path)
    else:
        script_dir = Path(__file__).parent
        log_dir = script_dir.parent / 'logs'
    
    # Vérifier que le dossier existe
    if not log_dir.exists():
        print(f"ERREUR: Le dossier de logs n'existe pas: {log_dir}")
        sys.exit(1)
    
    # Lister les fichiers actuels si verbose
    if args.verbose:
        print(f"Fichiers de logs actuels dans {log_dir}:")
        for log_file in sorted(log_dir.glob('*.log')):
            size = log_file.stat().st_size
            mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
            print(f"  {log_file.name} ({size} bytes, {mtime.strftime('%Y-%m-%d %H:%M:%S')})")
        print()
    
    # Nettoyer les anciens logs
    deleted_count = clean_old_logs(log_dir, args.days, args.dry_run)
    
    if not args.dry_run and deleted_count > 0:
        print(f"\n✓ Nettoyage réussi: {deleted_count} fichiers supprimés")
    elif args.dry_run:
        print(f"\n? Mode test: {deleted_count} fichiers seraient supprimés")
    else:
        print("\n✓ Aucun fichier à supprimer")

if __name__ == "__main__":
    main()

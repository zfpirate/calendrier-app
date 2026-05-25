import re
import os
from pathlib import Path

def clean_log_file(input_path, output_path=None):
    """Nettoie un fichier de log en supprimant les séquences d'échappement et en formatant correctement les sauts de ligne."""
    if output_path is None:
        output_path = input_path + ".clean"
    
    # Expression régulière pour supprimer les séquences d'échappement ANSI
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    
    with open(input_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # Nettoyage du contenu
    cleaned_content = ansi_escape.sub('', content)
    
    # Écriture du contenu nettoyé
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(cleaned_content)
    
    return output_path

if __name__ == "__main__":
    log_dir = Path(__file__).parent.parent / "logs"
    input_file = log_dir / "bot_latest.log"
    output_file = log_dir / "bot_latest_clean.log"
    
    if input_file.exists():
        cleaned_file = clean_log_file(str(input_file), str(output_file))
        print(f"Fichier de log nettoyé créé : {cleaned_file}")
    else:
        print(f"Avertissement : Le fichier {input_file} n'existe pas.")
        
        # Créer un fichier de log vide s'il n'existe pas
        if not log_dir.exists():
            log_dir.mkdir(parents=True, exist_ok=True)
        
        with open(input_file, 'w') as f:
            f.write("Fichier de log initialisé.\n")
        print(f"Un nouveau fichier de log a été créé : {input_file}")

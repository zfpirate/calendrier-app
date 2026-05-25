@echo off
echo Lancement du bot ecole en ligne...
cd /d "C:\Users\maxence\calendrier-app"

REM Créer le répertoire de logs s'il n'existe pas
if not exist "logs" mkdir logs

REM Nom du fichier log avec timestamp unique
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YYYY=%dt:~0,4%"
set "MM=%dt:~4,2%"
set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%"
set "MIN=%dt:~10,2%"
set "SEC=%dt:~12,2%"
set "LOG_FILE=logs\bot_%YYYY%%MM%%DD%_%HH%%MIN%%SEC%.log"

REM Lancer le bot et rediriger la sortie vers le fichier log (écrasé à chaque fois)
echo ============================================ > %LOG_FILE%
echo Démarrage du bot - %date% %time% >> %LOG_FILE%
echo ============================================ >> %LOG_FILE%
echo. >> %LOG_FILE%
C:\Users\maxence\AppData\Local\Programs\Python\Python314\python.exe bot\login_bot.py >> %LOG_FILE% 2>&1
echo. >> %LOG_FILE%
echo ============================================ >> %LOG_FILE%
echo Fin du bot - %date% %time% >> %LOG_FILE%
echo ============================================ >> %LOG_FILE%

echo Bot termine. Log: %LOG_FILE%

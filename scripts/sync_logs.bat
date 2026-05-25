@echo off
setlocal enabledelayedexpansion

ntitle Synchronisation des logs Calendrier App

n:check_python
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERREUR: Python n'est pas installé ou n'est pas dans le PATH.
    echo Installez Python depuis https://www.python.org/downloads/
    timeout /t 10
    exit /b 1
)

:main
cls
echo ===========================================
echo  SYNCHRONISATION DES LOGS - Calendrier App
echo ===========================================
echo.
echo [1/3] Vérification de l'installation de Google Drive...
if not exist "%USERPROFILE%\Google Drive\Mon Drive" (
    echo ERREUR: Google Drive n'est pas installé ou le dossier par défaut n'existe pas.
    echo Installez Google Drive pour Bureau : https://www.google.com/drive/download/
    timeout /t 10
    exit /b 1
)

echo [2/3] Vérification des fichiers de logs...
if not exist "%~dp0..\logs\bot_latest.log" (
    echo ERREUR: Le fichier de log n'existe pas : %~dp0..\logs\bot_latest.log
    timeout /t 5
    exit /b 1
)

echo [3/3] Synchronisation en cours...
python "%~dp0sync_logs.py" --path="%USERPROFILE%\Google Drive\Mon Drive\CalendrierApp_Logs"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==================================
    echo  SYNCHRONISATION REUSSIE !
    echo ==================================
    echo.
    echo Les logs sont maintenant disponibles dans :
    echo Google Drive > Mon Drive > CalendrierApp_Logs
    echo.
    echo Pour les consulter sur votre téléphone :
    echo 1. Installez l'application Google Drive
    echo 2. Allez dans 'Mon Drive' puis 'CalendrierApp_Logs'
) else (
    echo.
    echo ==================================
    echo  ERREUR LORS DE LA SYNCHRONISATION
    echo ==================================
    echo.
    echo Solutions possibles :
    echo 1. Vérifiez votre connexion Internet
    echo 2. Assurez-vous que Google Drive est bien en cours d'exécution
    echo 3. Essayez de redémarrer Google Drive
)

echo.
timeout /t 10

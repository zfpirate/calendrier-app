@echo off
setlocal enabledelayedexpansion

:: Configuration
set "SCRIPT_DIR=%~dp0"
set "PYTHON=python"
set "SYNC_SCRIPT=%SCRIPT_DIR%sync_logs.py"
set "LOG_DIR=%SCRIPT_DIR%..\logs"
set "DRIVE_DIR=%USERPROFILE%\Google Drive\Mon Drive\CalendrierApp_Logs"

:: Créer le dossier de logs s'il n'existe pas
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: Vérifier si le dossier Google Drive existe
if not exist "%DRIVE_DIR%" (
    echo Erreur: Le dossier Google Drive n'existe pas: %DRIVE_DIR%
    pause
    exit /b 1
)

echo Configuration de la tâche planifiée pour la synchronisation des logs...

:: Créer une tâche planifiée qui s'exécute toutes les heures (sans mot de passe)
schtasks /create /tn "Synchronisation Logs CalendrierApp" ^
    /tr "\"%PYTHON%\" \"%SYNC_SCRIPT%\" --path \"%DRIVE_DIR%\"" ^
    /sc HOURLY ^
    /mo 1 ^
    /ru "%USERNAME%" ^
    /RL HIGHEST ^
    /F

if %ERRORLEVEL% EQU 0 (
    echo Tâche planifiée créée avec succès!
    echo La synchronisation des logs s'exécutera toutes les heures.
) else (
    echo Erreur lors de la création de la tâche planifiée.
    pause
    exit /b 1
)

:: Exécuter une première synchronisation immédiate
echo.
echo Exécution de la première synchronisation...
"%PYTHON%" "%SYNC_SCRIPT%" --path "%DRIVE_DIR%"

if %ERRORLEVEL% EQU 0 (
    echo Synchronisation initiale réussie!
) else (
    echo Erreur lors de la synchronisation initiale.
    pause
    exit /b 1
)

echo.
echo Configuration terminée avec succès!
pause

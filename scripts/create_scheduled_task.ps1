# Création de l'action
try {
    $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"cd /d C:\Users\maxence\calendrier-app && call run_bot_with_logs.bat`""
    
    # Création des déclencheurs
    $trigger1 = New-ScheduledTaskTrigger -Daily -At "23:00"
    $trigger2 = New-ScheduledTaskTrigger -Daily -At "13:45"
    
    # Configuration des paramètres
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RunOnlyIfNetworkAvailable
    
    # Configuration du principal
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest
    
    # Enregistrement de la tâche
    $task = Register-ScheduledTask -Action $action -Trigger @($trigger1, $trigger2) -TaskName "Execution Bot Calendrier App" -Description "Exécute le bot principal avec logs structurés" -Settings $settings -Principal $principal -Force
    
    Write-Host "Tâche planifiée créée avec succès !" -ForegroundColor Green
    Write-Host "Prochaine exécution prévue à : " -NoNewline
    Write-Host $task.NextRunTime -ForegroundColor Cyan
}
catch {
    Write-Host "Erreur lors de la création de la tâche :" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Attendre que l'utilisateur appuie sur une touche
Write-Host "`nAppuyez sur une touche pour continuer..."
[Console]::ReadKey($true) | Out-Null

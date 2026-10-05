# setup-edital-monitor-task.ps1
# Rodar UMA VEZ como Administrador para registrar a tarefa no Task Scheduler
# Verifica edital CBSC todos os dias às 08:00

$TaskName  = "HubPessoal-EditalMonitor-Daily"
$ScriptPath = "C:\Users\Bernardo\Documents\Finance App\scripts\schedule\run-edital-monitor.ps1"

$Action  = New-ScheduledTaskAction -Execute "powershell.exe" `
             -Argument "-NonInteractive -WindowStyle Hidden -File `"$ScriptPath`""

$Trigger = New-ScheduledTaskTrigger -Daily -At "08:00"

$Settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
  -StartWhenAvailable

Register-ScheduledTask `
  -TaskName  $TaskName `
  -Action    $Action `
  -Trigger   $Trigger `
  -Settings  $Settings `
  -RunLevel  Highest `
  -Force

Write-Host "Tarefa '$TaskName' registrada com sucesso." -ForegroundColor Green
Write-Host "Executa diariamente às 08:00. Para testar agora: Start-ScheduledTask -TaskName '$TaskName'"

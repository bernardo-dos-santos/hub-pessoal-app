# setup-task-scheduler.ps1
# Execute UMA VEZ como Administrador para registrar a tarefa agendada.
# Depois disso o sync roda automaticamente todo dia às 19h (acorda o PC se estiver em suspensão).
#
# Como executar:
#   1. Abra o PowerShell como Administrador
#   2. Execute: powershell -ExecutionPolicy Bypass -File "C:\Users\Bernardo\Documents\Finance App\scripts\schedule\setup-task-scheduler.ps1"

$taskName   = "HubPessoal-SigaaSync"
$scriptPath = "C:\Users\Bernardo\Documents\Finance App\scripts\schedule\run-sync.ps1"
$user       = $env:USERNAME

Write-Host "Registrando tarefa agendada: $taskName" -ForegroundColor Cyan

# Remove tarefa existente se houver
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# Ação: rodar o script PowerShell
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`""

# Gatilho: todo dia às 19:00
$trigger = New-ScheduledTaskTrigger -Daily -At "19:00"

# Configurações: acorda o PC do sleep, tempo máximo de 15 minutos
$settings = New-ScheduledTaskSettingsSet `
    -WakeToRun `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew

# Principal: usuário atual na sessão interativa (funciona com sleep/wake)
$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$user" `
    -LogonType Interactive `
    -RunLevel Limited

try {
    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Force -ErrorAction Stop | Out-Null

    Write-Host "Tarefa registrada com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "Erro ao registrar: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""
Write-Host "  Nome:    $taskName"
Write-Host "  Horario: Todo dia as 19:00"
Write-Host "  Acorda:  Sim (WakeToRun habilitado)"
Write-Host "  Log:     C:\Users\Bernardo\Documents\Finance App\logs\sigaa-sync.log"
Write-Host ""
Write-Host "Para verificar: Get-ScheduledTask -TaskName '$taskName'" -ForegroundColor DarkGray
Write-Host "Para remover:   Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false" -ForegroundColor DarkGray

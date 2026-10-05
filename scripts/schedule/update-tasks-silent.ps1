# update-tasks-silent.ps1
# Execute como ADMINISTRADOR para atualizar as tarefas do Task Scheduler
# para rodar completamente em segundo plano (sem janela de terminal).
#
# Como rodar: clique direito em "Windows PowerShell" > "Executar como administrador"
# Depois: cd "C:\Users\Bernardo\Documents\Finance App"; .\scripts\schedule\update-tasks-silent.ps1

$projectDir = "C:\Users\Bernardo\Documents\Finance App"
$vbs        = "$projectDir\scripts\schedule\run-silent.vbs"

Write-Host "Atualizando tarefas para execução silenciosa..." -ForegroundColor Cyan

$action = New-ScheduledTaskAction `
    -Execute "wscript.exe" `
    -Argument "`"$vbs`" run-nubank-sync.ps1" `
    -WorkingDirectory $projectDir

# Tarefa diária
try {
    Set-ScheduledTask -TaskName "HubPessoal-NubankSync-Daily" -Action $action | Out-Null
    Write-Host "[OK] HubPessoal-NubankSync-Daily atualizada." -ForegroundColor Green
} catch {
    Write-Host "[ERRO] Daily: $_" -ForegroundColor Red
}

# Tarefa de 15 em 15 minutos
try {
    Set-ScheduledTask -TaskName "HubPessoal-NubankSync-15min" -Action $action | Out-Null
    Write-Host "[OK] HubPessoal-NubankSync-15min atualizada." -ForegroundColor Green
} catch {
    Write-Host "[ERRO] 15min: $_" -ForegroundColor Red
}

Write-Host "`nPronto! As tarefas agora rodam sem janela de terminal." -ForegroundColor Cyan

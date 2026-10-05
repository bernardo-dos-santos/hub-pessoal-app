# scripts/setup-autodeploy-task.ps1 — registra a tarefa de auto-deploy no PC dedicado.
# Rodar UMA VEZ, no próprio PC dedicado:
#   powershell -File scripts\setup-autodeploy-task.ps1
#
# Cria/atualiza a tarefa HubPessoal-AutoDeploy: dispara watch-and-deploy.ps1 a
# cada 5 minutos, indefinidamente, mesmo sem sessão de usuário logada.

$repoRoot = Split-Path $PSScriptRoot -Parent
$scriptPath = Join-Path $PSScriptRoot 'watch-and-deploy.ps1'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" `
  -WorkingDirectory $repoRoot

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Minutes 5) `
  -RepetitionDuration (New-TimeSpan -Days 3650)

# ExecutionTimeLimit evita que um deploy travado (ex.: git esperando input) fique
# preso pra sempre e bloqueie as execuções seguintes.
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

# S4U (não Interactive): roda mesmo sem ninguém logado na máquina — o PC dedicado
# fica 24/7 sem sessão aberta. Interactive fazia a tarefa falhar com 0x800710E0.
# UserId vem da identidade real do Windows (MÁQUINA\Usuário): $env:USERDOMAIN
# devolve "WORKGROUP" em PC fora de domínio, que não resolve pra conta nenhuma.
$account = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $account `
  -LogonType S4U -RunLevel Highest

# -ErrorAction Stop: sem isso o erro é não-terminante e o script seguia imprimindo
# "registrada" mesmo quando o registro tinha falhado.
Register-ScheduledTask -TaskName 'HubPessoal-AutoDeploy' `
  -Action $action -Trigger $trigger -Settings $settings `
  -Principal $principal -Force -ErrorAction Stop | Out-Null

Write-Output 'Tarefa HubPessoal-AutoDeploy registrada - roda a cada 5 min.'

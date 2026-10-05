# setup-all-tasks.ps1
# Registra TODAS as tarefas agendadas do Hub Pessoal de uma vez.
# Execute UMA VEZ como Administrador.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File "C:\...\scripts\schedule\setup-all-tasks.ps1"
#
# Node roda dentro do WSL (Ubuntu) -- todas as tarefas usam wsl.exe.
# Projeto: /home/bernardo_dos_santos/Hub-Pessoal
#
# Tarefas registradas:
#   HubPessoal-Briefing              - generate-briefing.js      - todo dia 06:00
#   HubPessoal-DailyPush             - send-daily-push.js        - todo dia 07:00
#   HubPessoal-CalendarSync          - calendar-sync.js          - toda segunda 07:00
#   HubPessoal-AbinPhase             - abin-phase-monitor.js     - todo dia 08:00
#   HubPessoal-EditalMonitor-Daily   - edital-monitor.js         - todo dia 08:00
#   HubPessoal-SigaaSync             - sigaa-sync.js             - todo dia 19:00
#   HubPessoal-CollegeCalendar       - college-calendar-sync.js  - todo dia 19:45
#   HubPessoal-GdriveMaterials       - gdrive-materials-sync.js  - todo dia 19:30
#   HubPessoal-DailyPush-Evening     - send-daily-push.js        - todo dia 20:00
#   HubPessoal-WeeklyPlan            - generate-weekly-plan.js   - todo domingo 21:00
#   HubPessoal-NubankInvoice-Monthly - nubank-invoice-gmail-sync - dia 5 de cada mes 23:59
#   HubPessoal-GdriveBackup          - gdrive-backup.js          - todo dia 02:00
#
# Nao agendado (ferramenta manual):
#   nubank-invoice-parser.js

$ProjectWSL = "/home/bernardo_dos_santos/Hub-Pessoal"
$Distro     = "Ubuntu"
$NodeExe    = "/usr/bin/node"
$LogDir     = "$ProjectWSL/logs"

$User = $env:USERNAME
$Principal = New-ScheduledTaskPrincipal `
    -UserId    "$env:USERDOMAIN\$User" `
    -LogonType Interactive `
    -RunLevel  Limited

$SettingsDefault = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit       (New-TimeSpan -Minutes 15) `
    -StartWhenAvailable `
    -MultipleInstances        IgnoreNew

$SettingsWake = New-ScheduledTaskSettingsSet `
    -WakeToRun `
    -ExecutionTimeLimit       (New-TimeSpan -Minutes 15) `
    -StartWhenAvailable `
    -MultipleInstances        IgnoreNew

# Registra uma tarefa que roda um script node dentro do WSL
function Register-WslNodeTask {
    param(
        [string]$TaskName,
        [string]$Script,
        [string]$ExtraArgs = "",
        $Trigger,
        $Settings,
        [string]$Log
    )
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

    $cmd = "cd '$ProjectWSL' && $NodeExe --env-file=.env $Script $ExtraArgs >> $Log 2>&1"
    $action = New-ScheduledTaskAction `
        -Execute  "wsl.exe" `
        -Argument "-d $Distro bash -c `"$cmd`""

    Register-ScheduledTask `
        -TaskName  $TaskName `
        -Action    $action `
        -Trigger   $Trigger `
        -Settings  $Settings `
        -Principal $Principal `
        -Force | Out-Null

    Write-Host "  OK $TaskName"
}

Write-Host ""
Write-Host "Registrando tarefas do Hub Pessoal (via WSL)..." -ForegroundColor Cyan
Write-Host ""

# 1. Briefing diario - 06:00
Register-WslNodeTask `
    -TaskName  "HubPessoal-Briefing" `
    -Script    "scripts/schedule/generate-briefing.js" `
    -Trigger   (New-ScheduledTaskTrigger -Daily -At "06:00") `
    -Settings  $SettingsDefault `
    -Log       "$LogDir/briefing.log"

# 2. Push matinal - 07:00
Register-WslNodeTask `
    -TaskName  "HubPessoal-DailyPush" `
    -Script    "scripts/schedule/send-daily-push.js" `
    -Trigger   (New-ScheduledTaskTrigger -Daily -At "07:00") `
    -Settings  $SettingsDefault `
    -Log       "$LogDir/daily-push.log"

# 3. Calendar sync - toda segunda 07:00
Register-WslNodeTask `
    -TaskName  "HubPessoal-CalendarSync" `
    -Script    "scripts/sync/calendar-sync.js" `
    -Trigger   (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At "07:00") `
    -Settings  $SettingsDefault `
    -Log       "$LogDir/calendar-sync.log"

# 3b. College calendar sync - todo dia 19:45, logo apos o SIGAA sync (19:00) e o
#     gdrive-materials (19:30), pra exportar ja com as provas/entregas do dia.
Register-WslNodeTask `
    -TaskName  "HubPessoal-CollegeCalendar" `
    -Script    "scripts/sync/college-calendar-sync.js" `
    -Trigger   (New-ScheduledTaskTrigger -Daily -At "19:45") `
    -Settings  $SettingsDefault `
    -Log       "$LogDir/college-calendar-sync.log"

# 4. ABIN phase monitor - 08:00 (usa GEMINI_API_KEY via --env-file)
Register-WslNodeTask `
    -TaskName  "HubPessoal-AbinPhase" `
    -Script    "scripts/sync/abin-phase-monitor.js" `
    -Trigger   (New-ScheduledTaskTrigger -Daily -At "08:00") `
    -Settings  $SettingsDefault `
    -Log       "$LogDir/abin-phase.log"

# 5. Monitor de editais - 08:00
Register-WslNodeTask `
    -TaskName  "HubPessoal-EditalMonitor-Daily" `
    -Script    "scripts/sync/edital-monitor.js" `
    -Trigger   (New-ScheduledTaskTrigger -Daily -At "08:00") `
    -Settings  $SettingsDefault `
    -Log       "$LogDir/edital-monitor.log"

# 6. SIGAA sync - 19:00 (acorda PC)
Register-WslNodeTask `
    -TaskName  "HubPessoal-SigaaSync" `
    -Script    "scripts/sync/sigaa-sync.js" `
    -ExtraArgs "--headless" `
    -Trigger   (New-ScheduledTaskTrigger -Daily -At "19:00") `
    -Settings  $SettingsWake `
    -Log       "$LogDir/sigaa-sync.log"

# 7. Google Drive materiais - 19:30 (apos SIGAA)
Register-WslNodeTask `
    -TaskName  "HubPessoal-GdriveMaterials" `
    -Script    "scripts/sync/gdrive-materials-sync.js" `
    -Trigger   (New-ScheduledTaskTrigger -Daily -At "19:30") `
    -Settings  $SettingsDefault `
    -Log       "$LogDir/gdrive-materials.log"

# 8. Push noturno (sessao nao registrada) - 20:00
Register-WslNodeTask `
    -TaskName  "HubPessoal-DailyPush-Evening" `
    -Script    "scripts/schedule/send-daily-push.js" `
    -Trigger   (New-ScheduledTaskTrigger -Daily -At "20:00") `
    -Settings  $SettingsDefault `
    -Log       "$LogDir/daily-push-evening.log"

# 9. Plano semanal - todo domingo 21:00
Register-WslNodeTask `
    -TaskName  "HubPessoal-WeeklyPlan" `
    -Script    "scripts/schedule/generate-weekly-plan.js" `
    -Trigger   (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At "21:00") `
    -Settings  $SettingsDefault `
    -Log       "$LogDir/weekly-plan.log"

# O sync bancario via Gmail (HubPessoal-NubankSync-Daily e -15min, gmail-sync.js)
# foi aposentado: a importacao de transacoes passou para a Pluggy (Open Finance),
# que cobre Nubank conta/cartao e C6 Empresa. As duas tarefas sao desregistradas
# abaixo para que uma maquina que ja rodou este script antes nao continue
# executando um caminho morto de 15 em 15 minutos.
Unregister-ScheduledTask -TaskName "HubPessoal-NubankSync-Daily" -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "HubPessoal-NubankSync-15min" -Confirm:$false -ErrorAction SilentlyContinue

# 10. Fatura Nubank - dia 5 de cada mes 23:59 (XML para trigger mensal, usa PS1 runner)
$Ps1InvPath = "\\wsl.localhost\Ubuntu\home\bernardo_dos_santos\Hub-Pessoal\scripts\schedule\run-nubank-invoice-sync.ps1"
$InvoiceXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Hub Pessoal - baixa fatura PDF Nubank via Gmail no dia 5 de cada mes</Description>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2026-07-05T23:59:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByMonth>
        <DaysOfMonth><Day>5</Day></DaysOfMonth>
        <Months>
          <January/><February/><March/><April/><May/><June/>
          <July/><August/><September/><October/><November/><December/>
        </Months>
      </ScheduleByMonth>
    </CalendarTrigger>
  </Triggers>
  <Settings>
    <WakeToRun>true</WakeToRun>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT10M</ExecutionTimeLimit>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$Ps1InvPath"</Arguments>
    </Exec>
  </Actions>
  <Principals>
    <Principal id="Author"><RunLevel>HighestAvailable</RunLevel></Principal>
  </Principals>
</Task>
"@
$TmpXml = "$env:TEMP\hub-invoice-task.xml"
$InvoiceXml | Out-File -FilePath $TmpXml -Encoding unicode
Unregister-ScheduledTask -TaskName "HubPessoal-NubankInvoice-Monthly" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "HubPessoal-NubankInvoice-Monthly" -Xml (Get-Content $TmpXml -Raw) -Force | Out-Null
Remove-Item $TmpXml -ErrorAction SilentlyContinue
Write-Host "  OK HubPessoal-NubankInvoice-Monthly"

# 11. Google Drive backup - 02:00 (baixo impacto)
Register-WslNodeTask `
    -TaskName  "HubPessoal-GdriveBackup" `
    -Script    "scripts/sync/gdrive-backup.js" `
    -Trigger   (New-ScheduledTaskTrigger -Daily -At "02:00") `
    -Settings  $SettingsDefault `
    -Log       "$LogDir/gdrive-backup.log"

# 12. Servidor Express via PM2 - ao logar no Windows
# Faz pm2 resurrect dentro do WSL para religar o hub-pessoal (porta 3001).
# Pré-requisito: rodar "pm2 save" dentro do WSL após iniciar o servidor pela primeira vez.
Unregister-ScheduledTask -TaskName "HubPessoal-Server" -Confirm:$false -ErrorAction SilentlyContinue
$serverAction = New-ScheduledTaskAction `
    -Execute  "wsl.exe" `
    -Argument "-d $Distro bash -c `"pm2 resurrect >> $LogDir/pm2-startup.log 2>&1`""
$serverTrigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$User"
$serverSettings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew
Register-ScheduledTask `
    -TaskName  "HubPessoal-Server" `
    -Action    $serverAction `
    -Trigger   $serverTrigger `
    -Settings  $serverSettings `
    -Principal $Principal `
    -Force | Out-Null
Write-Host "  OK HubPessoal-Server (pm2 resurrect ao logar)"

# Resumo
Write-Host ""
Write-Host "Todas as tarefas registradas!" -ForegroundColor Green
Write-Host ""

Get-ScheduledTask | Where-Object { $_.TaskName -like "HubPessoal*" } |
    Select-Object TaskName, State |
    Sort-Object TaskName |
    Format-Table -AutoSize

Write-Host "Horarios:" -ForegroundColor Yellow
Write-Host "  Login  Server (pm2 resurrect)"
Write-Host "  02:00  GdriveBackup"
Write-Host "  06:00  Briefing"
Write-Host "  07:00  DailyPush  |  CalendarSync (seg)"
Write-Host "  08:00  AbinPhase  |  EditalMonitor"
Write-Host "  19:00  SigaaSync"
Write-Host "  19:30  GdriveMaterials"
Write-Host "  20:00  DailyPush-Evening"
Write-Host "  21:00  WeeklyPlan (dom)"
Write-Host "  23:59  NubankInvoice (dia 5)"

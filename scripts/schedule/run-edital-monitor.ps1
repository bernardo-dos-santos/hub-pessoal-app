# run-edital-monitor.ps1
# Chamado pelo Task Scheduler para monitorar editais

$ProjectWSL = "/home/bernardo_dos_santos/Hub-Pessoal"
$LogFile    = "$ProjectWSL/logs/edital-monitor.log"
$Distro     = "Ubuntu"

$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
wsl.exe -d $Distro bash -c "echo '[$Timestamp] Iniciando edital-monitor...' >> '$LogFile'"

wsl.exe -d $Distro bash -c "cd '$ProjectWSL' && /usr/bin/node --env-file=.env scripts/sync/edital-monitor.js >> '$LogFile' 2>&1"

$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
wsl.exe -d $Distro bash -c "echo '[$Timestamp] Concluido.' >> '$LogFile'"

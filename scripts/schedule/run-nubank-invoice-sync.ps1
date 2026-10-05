# run-nubank-invoice-sync.ps1
# Chamado pelo Task Scheduler no dia 5 de cada mes as 23:59

$ProjectWSL = "/home/bernardo_dos_santos/Hub-Pessoal"
$LogFile    = "$ProjectWSL/logs/nubank-invoice-sync.log"
$Distro     = "Ubuntu"

$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
wsl.exe -d $Distro bash -c "echo '[$Timestamp] Iniciando nubank-invoice-sync...' >> '$LogFile'"

wsl.exe -d $Distro bash -c "cd '$ProjectWSL' && /usr/bin/node --env-file=.env scripts/sync/nubank-invoice-gmail-sync.js --headless >> '$LogFile' 2>&1"

$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
wsl.exe -d $Distro bash -c "echo '[$Timestamp] Concluido.' >> '$LogFile'"

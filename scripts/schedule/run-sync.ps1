# run-sync.ps1 — executado pelo Task Scheduler todo dia as 19h
# Roda o sigaa-sync.js via WSL e salva o log

$ProjectWSL = "/home/bernardo_dos_santos/Hub-Pessoal"
$LogFile    = "$ProjectWSL/logs/sigaa-sync.log"
$Distro     = "Ubuntu"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
wsl.exe -d $Distro bash -c "echo '' >> '$LogFile' && echo '=== Sync iniciado em $timestamp ===' >> '$LogFile'"

wsl.exe -d $Distro bash -c "cd '$ProjectWSL' && /usr/bin/node --env-file=.env scripts/sync/sigaa-sync.js --headless >> '$LogFile' 2>&1"

$exitCode  = $LASTEXITCODE
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
wsl.exe -d $Distro bash -c "echo '=== Sync encerrado em $timestamp (exit $exitCode) ===' >> '$LogFile'"

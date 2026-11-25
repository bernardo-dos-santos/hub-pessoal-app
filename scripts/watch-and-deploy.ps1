# scripts/watch-and-deploy.ps1 — auto-deploy do PC dedicado.
# Roda a cada 5 min via Task Scheduler (tarefa HubPessoal-AutoDeploy). Verifica
# se há commits novos em origin/master; se houver, atualiza, rebuilda e
# reinicia a tarefa HubServer. Silencioso quando não há nada novo.
#
# Configurar a tarefa (rodar uma vez, no próprio PC dedicado):
#   powershell -File scripts\setup-autodeploy-task.ps1

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

# BatchMode: numa execução agendada não há ninguém pra responder prompt de senha
# ou de host key desconhecido — sem isso o git fica pendurado pra sempre e deixa
# processos ssh órfãos segurando arquivos (aconteceu com o known_hosts).
$env:GIT_SSH_COMMAND = 'ssh -o BatchMode=yes'

$logDir = Join-Path $repoRoot 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir 'auto-deploy.log'

# Mensagens de log em ASCII puro de proposito: o PowerShell 5.1 le arquivos .ps1
# sem BOM como ANSI, entao acento no fonte ja chega corrompido aqui e vai
# duplamente codificado pro arquivo. Mesma razao do setup-dedicado.ps1.
function Write-Log([string]$msg) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
  Add-Content -Path $logFile -Value $line -Encoding UTF8
}

# $ErrorActionPreference não captura falha de executável nativo (git/npm/pm2) no
# PowerShell 5.1 — só $LASTEXITCODE denuncia. Sem esta checagem um `git fetch`
# quebrado passava batido e o script terminava "com sucesso" sem fazer nada.
#
# Só isso não bastava: com $ErrorActionPreference = 'Stop' (linha abaixo), o
# PowerShell 5.1 promove QUALQUER escrita de um comando nativo em stderr a erro
# terminante — mesmo quando o comando termina com exit 0. `git pull` escreve
# avisos inofensivos em stderr (ex.: "LF will be replaced by CRLF"), e isso já
# derrubou um deploy que na real tinha funcionado. Por isso o bloco baixa a
# preferência pra 'Continue' só durante a chamada nativa; quem decide sucesso/
# falha continua sendo exclusivamente o $LASTEXITCODE.
function Invoke-Step([string]$label, [scriptblock]$block) {
  $prevPref = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $block
  } finally {
    $ErrorActionPreference = $prevPref
  }
  if ($LASTEXITCODE -ne 0) { throw "$label falhou (exit $LASTEXITCODE)" }
}

# Mesmo PM2_HOME que a tarefa de boot (HubServer, roda no logon da máquina) usa
# — sem isso, esta tarefa (que roda como usuário via S4U) fala com um daemon
# PM2 diferente do que está de pé de verdade, e "pm2 restart" nunca acha o
# processo (falha sempre, mesmo com o servidor rodando).
$env:PM2_HOME = 'C:\ProgramData\pm2'

# Restarts the whole HubServer task (pm2-runtime + the app), never
# "pm2 restart". On Windows, PM2 7 gets the old process's exit only after the
# new one is up, takes it for a crash and starts a second one: on 2026-11-16 an
# orphan kept serving the port while the one PM2 tracked sat "online" and dead.
# Stopping the task doesn't take its node children with it, hence the kill.
function Restart-HubServer {
  $hubNodes = {
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
      Where-Object { $_.CommandLine -like '*pm2-runtime*' -or $_.CommandLine -like '*ProcessContainerFork*' }
  }
  Stop-ScheduledTask -TaskName 'HubServer'
  Start-Sleep -Seconds 2
  & $hubNodes | Where-Object { $_.CommandLine -like '*pm2-runtime*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 700
  & $hubNodes | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
  Start-ScheduledTask -TaskName 'HubServer'

  $deadline = (Get-Date).AddMinutes(10)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 5
    try {
      if ((Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3001/api/health' -TimeoutSec 5).StatusCode -eq 200) { return }
    } catch {}
  }
  throw 'servidor nao respondeu em 10 min depois do reinicio'
}

try {
  Invoke-Step 'git fetch' { git fetch origin master --quiet }
  $local = git rev-parse HEAD
  $remote = git rev-parse origin/master

  if ($local -eq $remote) { exit 0 }

  Write-Log "Atualizacao detectada: $local -> $remote"

  Invoke-Step 'git pull' { git pull origin master --no-edit }
  Invoke-Step 'npm install' { npm install }
  Invoke-Step 'npm run build' { npm run build }
  Restart-HubServer

  Write-Log "Deploy concluido: $remote"
} catch {
  Write-Log "ERRO: $_"
}

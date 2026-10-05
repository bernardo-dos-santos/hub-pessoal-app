# scripts/hub-autostart.ps1 — abre o Hub sozinho quando o Windows liga.
#
# Roda numa máquina CLIENTE (notebook). Não sobe servidor nenhum: o Hub inteiro
# vive no PC dedicado. O que ele faz aqui:
#   1. sobe o hub-agent local (as "mãos" do Jarvis — única peça local por design);
#   2. espera o Hub do dedicado responder (Tailscale demora alguns segundos no
#      boot; abrir antes disso mostraria tela de erro);
#   3. abre a janela do app (Chrome em modo --app, sem UI de navegador).
#
# Instalado via atalho .vbs na pasta Startup (ver scripts/set-app-url.ps1).

param(
  [string]$Url = $env:HUB_BACKEND,
  [int]$TimeoutSeconds = 120
)

if (-not $Url) {
  Write-Error 'Informe -Url ou defina a variavel de ambiente HUB_BACKEND (ex.: https://<maquina>.<tailnet>.ts.net).'
  exit 1
}

# 1. Mãos do Jarvis — sobe se a porta do agente não estiver atendendo.
#    (checagem por socket, não por `pm2 jlist`: o JSON do PM2 tem chaves
#    duplicadas 'username'/'USERNAME' e o ConvertFrom-Json do PS 5.1 recusa.)
$agentUp = $false
try {
  $tcp = New-Object Net.Sockets.TcpClient
  $tcp.Connect('127.0.0.1', 3010)
  $agentUp = $tcp.Connected
  $tcp.Close()
} catch { }

$pm2 = "$env:APPDATA\npm\pm2.cmd"
if (-not $agentUp -and (Test-Path $pm2)) { & $pm2 resurrect 2>$null | Out-Null }

# 2. Espera o Hub do dedicado ficar acessível
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$online = $false
while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -UseBasicParsing
    if ($r.StatusCode -eq 200) { $online = $true; break }
  } catch { Start-Sleep -Seconds 3 }
}

# 3. Abre a janela do app (mesmo se o wait estourar — melhor mostrar erro do
#    navegador do que não abrir nada e o usuário achar que quebrou)
if (-not $online) { Start-Sleep -Seconds 5 }
Start-Process 'chrome.exe' -ArgumentList "--app=$Url"

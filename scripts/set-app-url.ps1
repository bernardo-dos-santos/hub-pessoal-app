# scripts/set-app-url.ps1 — (re)cria os atalhos do app desktop numa máquina cliente.
#
# Cria/atualiza três coisas apontando para a MESMA url:
#   - Área de Trabalho\Hub Pessoal.lnk        (abrir na mão)
#   - Menu Iniciar\Hub Pessoal.lnk            (busca do Windows)
#   - Startup\hub-autostart.vbs               (abre sozinho no boot, via hub-autostart.ps1)
#
# Trocar de URL depois (ex.: quando o `tailscale serve` estiver ativo no dedicado
# e o HTTPS liberar o microfone remoto) é só rodar de novo:
#   powershell -File scripts\set-app-url.ps1 -Url https://<maquina>.<tailnet>.ts.net

param(
  [string]$Url = $env:HUB_BACKEND,
  [switch]$NoAutostart
)

if (-not $Url) {
  Write-Error 'Informe -Url ou defina a variavel de ambiente HUB_BACKEND (ex.: https://<maquina>.<tailnet>.ts.net).'
  exit 1
}

$repo    = Split-Path $PSScriptRoot -Parent
$icon    = Join-Path $repo 'public\hub.ico'
$chrome  = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$startup = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$ws      = New-Object -ComObject WScript.Shell

foreach ($dir in @([Environment]::GetFolderPath('Desktop'), "$env:APPDATA\Microsoft\Windows\Start Menu\Programs")) {
  $lnk = $ws.CreateShortcut((Join-Path $dir 'Hub Pessoal.lnk'))
  $lnk.TargetPath   = $chrome
  $lnk.Arguments    = "--app=$Url"
  $lnk.IconLocation = "$icon,0"
  $lnk.Description  = 'Hub Pessoal'
  $lnk.Save()
  Write-Output "atalho: $dir\Hub Pessoal.lnk -> $Url"
}

$vbsPath = Join-Path $startup 'hub-autostart.vbs'
if ($NoAutostart) {
  if (Test-Path $vbsPath) { Remove-Item $vbsPath -Force; Write-Output "autostart removido" }
} else {
  # VBS só existe pra rodar o PowerShell sem piscar janela preta no logon.
  $ps1 = Join-Path $repo 'scripts\hub-autostart.ps1'
  $cmd = "powershell -NoProfile -ExecutionPolicy Bypass -File ""$ps1"" -Url ""$Url"""
  # Em VBScript aspa dentro de string se escreve dobrada. $cmd já tem aspas (path e
  # URL), então sem dobrar elas a string fecha no meio e o logon abre um erro de
  # compilação em vez do Hub.
  $cmdVbs = $cmd -replace '"', '""'
  Set-Content -Path $vbsPath -Encoding ascii -Value "CreateObject(""WScript.Shell"").Run ""$cmdVbs"", 0, False"
  Write-Output "autostart: $vbsPath -> $Url"
}

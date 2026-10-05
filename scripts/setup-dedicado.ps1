# scripts/setup-dedicado.ps1 — configura o PC dedicado como cérebro único do Hub.
# Rodar UMA VEZ, no próprio PC dedicado (via SSH ou sessão local):
#   powershell -File scripts\setup-dedicado.ps1 -AgentToken <valor de AGENT_TOKEN do .env do notebook>
#
# O que faz: atualiza o código, rebuilda o frontend, aponta o Jarvis pro agente
# do notebook, zera o histórico de chat pré-persona, reinicia o PM2 e publica
# o app com HTTPS válido no tailnet via `tailscale serve` (HTTPS = contexto
# seguro = microfone funciona em qualquer máquina do tailnet).

param([Parameter(Mandatory = $true)][string]$AgentToken)

# Raiz do repo = pasta pai de scripts\ — funciona em qualquer máquina, independente
# do nome de usuário/caminho (o caminho varia entre notebook e PC dedicado).
Set-Location (Split-Path $PSScriptRoot -Parent)

git pull
if (-not $?) { Write-Error 'git pull falhou'; exit 1 }

npm install
if (-not $?) { Write-Error 'npm install falhou'; exit 1 }

npm run build
if (-not $?) { Write-Error 'build falhou'; exit 1 }

# O agente CONECTA no Hub (long-poll), entao o servidor nao precisa saber o
# endereco de maquina nenhuma — AGENT_URL nao existe mais. So o token
# compartilhado, que o agente apresenta para buscar comando.
if (-not (Select-String -Path .env -Pattern '^AGENT_TOKEN=' -Quiet)) {
  Add-Content .env "AGENT_TOKEN=$AgentToken"
}

# Histórico pré-persona ancora o modelo no estilo antigo — começa limpo.
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('hub.db');db.prepare(`"INSERT INTO kv_store (key,value) VALUES ('jarvis.chatHistory','[]') ON CONFLICT(key) DO UPDATE SET value=excluded.value`").run();console.log('chat history limpo');"

pm2 restart hub-server

# HTTPS no tailnet (exige MagicDNS + HTTPS habilitados no admin do Tailscale;
# se der erro, habilite em https://login.tailscale.com/admin/dns e rode de novo).
tailscale serve --bg 3001

Write-Output ''
Write-Output 'Pronto. Teste no navegador de qualquer maquina do tailnet:'
Write-Output '  https://<nome-da-maquina>.<seu-tailnet>.ts.net  (veja com: tailscale status)'

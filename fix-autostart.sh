#!/bin/bash
# Corrige o script de auto-start do WSL no Windows Startup
STARTUP="/mnt/c/Users/bernardo_dos_santos/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/start-wsl.bat"

cat > "$STARTUP" << 'EOF'
wsl -d Ubuntu -e bash -c "sudo service ssh start && /usr/bin/pm2 resurrect"
EOF

echo "Auto-start corrigido!"

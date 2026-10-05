# enable-wake-timers.ps1
# Habilita wake timers no plano de energia ativo (necessário para o PC acordar do sleep).
# Execute UMA VEZ como Administrador junto com o setup-task-scheduler.ps1.

Write-Host "Habilitando wake timers no plano de energia ativo..." -ForegroundColor Cyan

# AC (tomada)
powercfg /setacvalueindex SCHEME_CURRENT SUB_SLEEP RTCWAKE 1
# DC (bateria)
powercfg /setdcvalueindex SCHEME_CURRENT SUB_SLEEP RTCWAKE 1
# Aplica
powercfg /setactive SCHEME_CURRENT

Write-Host "Wake timers habilitados!" -ForegroundColor Green

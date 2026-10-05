' run-silent.vbs
' Wrapper que executa um script PowerShell SEM janela visível.
' Uso: wscript.exe run-silent.vbs <nome-do-script.ps1>
' Exemplo: wscript.exe run-silent.vbs run-nubank-sync.ps1

Dim scriptArg, projectDir, psCmd, shell

scriptArg  = WScript.Arguments(0)
projectDir = "C:\Users\Bernardo\Documents\Finance App"

psCmd = "powershell.exe -NonInteractive -NoProfile -WindowStyle Hidden" & _
        " -ExecutionPolicy Bypass" & _
        " -File """ & projectDir & "\scripts\schedule\" & scriptArg & """"

Set shell = CreateObject("WScript.Shell")
' Terceiro argumento = 0 → janela oculta; False → não espera terminar (async)
shell.Run psCmd, 0, False

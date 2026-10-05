# setup-invoice-task.ps1
# Rodar UMA VEZ como Administrador para registrar a tarefa no Task Scheduler
# Baixa a fatura PDF do Nubank via Gmail no dia 5 de cada mes as 23:59

$TaskName   = "HubPessoal-NubankInvoice-Monthly"
$ScriptPath = "C:\Users\Bernardo\Documents\Finance App\scripts\schedule\run-nubank-invoice-sync.ps1"

# XML da tarefa — mais confiavel que schtasks com caminhos com espacos
$TaskXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Hub Pessoal — baixa fatura PDF Nubank via Gmail no dia 5 de cada mes</Description>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2026-06-05T23:59:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByMonth>
        <DaysOfMonth>
          <Day>5</Day>
        </DaysOfMonth>
        <Months>
          <January/><February/><March/><April/><May/><June/>
          <July/><August/><September/><October/><November/><December/>
        </Months>
      </ScheduleByMonth>
    </CalendarTrigger>
  </Triggers>
  <Settings>
    <WakeToRun>true</WakeToRun>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT10M</ExecutionTimeLimit>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>-NonInteractive -WindowStyle Hidden -File "$ScriptPath"</Arguments>
    </Exec>
  </Actions>
  <Principals>
    <Principal id="Author">
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
</Task>
"@

# Salva XML temporario
$TmpXml = "$env:TEMP\hub-invoice-task.xml"
$TaskXml | Out-File -FilePath $TmpXml -Encoding unicode

# Remove tarefa anterior se existir
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Registra via XML
Register-ScheduledTask -TaskName $TaskName -Xml (Get-Content $TmpXml -Raw) -Force | Out-Null

# Limpa XML temporario
Remove-Item $TmpXml -ErrorAction SilentlyContinue

# Confirma
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    Write-Host ""
    Write-Host "Tarefa '$TaskName' registrada com sucesso!" -ForegroundColor Green
    Write-Host "Executa no dia 5 de cada mes as 23:59 e acorda o PC." -ForegroundColor Green
    Write-Host ""
    Write-Host "Para testar agora (sem esperar o dia 5):" -ForegroundColor Yellow
    Write-Host "  Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Cyan
} else {
    Write-Host "ERRO: Nao foi possivel registrar a tarefa." -ForegroundColor Red
}

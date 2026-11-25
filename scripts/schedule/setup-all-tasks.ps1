# setup-all-tasks.ps1 — registers the Hub's scheduled jobs on the dedicated server
# (Windows, native Node — no WSL). The task list below is the source of truth for
# what runs when; `JOBS` in server/systemHealth.js mirrors the cadences.
#
# Run in an elevated PowerShell on the server (ssh as the admin user is elevated):
#   powershell -ExecutionPolicy Bypass -File scripts\schedule\setup-all-tasks.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\schedule\setup-all-tasks.ps1 -Only SigaaSync,CollegeCalendar
#   powershell -ExecutionPolicy Bypass -File scripts\schedule\setup-all-tasks.ps1 -WhatIf
#
# Every task runs `node --env-file=.env <script>` from the repo root and appends its
# output to logs\<name>.log. Re-running is safe: each task is replaced as a whole.
# HubPessoal-AutoDeploy is not here — scripts\setup-autodeploy-task.ps1 owns it.

param(
  [string[]]$Only = @(),
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
# With -File, `-Only A,B` arrives as the single string "A,B".
$Only = @($Only | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node) { $Node = 'C:\Program Files\nodejs\node.exe' }
# The real account name (MACHINE\user) - $env:USERDOMAIN is wrong inside an ssh session.
$CurrentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

# Principal: 'System' for jobs that only talk to files/APIs; 'User' when the job
# needs the user's desktop session (the SIGAA sync drives a real browser window).
$Tasks = @(
  @{ Name = 'Briefing';           Script = 'scripts\schedule\generate-briefing.js';                Log = 'briefing.log';           Principal = 'System'; Trigger = @{ Daily = '06:00' } },
  @{ Name = 'DailyPush';          Script = 'scripts\schedule\send-daily-push.js';                  Log = 'daily-push.log';         Principal = 'System'; Trigger = @{ Daily = '07:00' } },
  @{ Name = 'DailyPush-Evening';  Script = 'scripts\schedule\send-daily-push.js';                  Log = 'daily-push-evening.log'; Principal = 'System'; Trigger = @{ Daily = '20:00' } },
  @{ Name = 'GdriveBackup';       Script = 'scripts\sync\gdrive-backup.js';                        Log = 'gdrive-backup.log';      Principal = 'System'; Trigger = @{ Daily = '02:00' } },
  @{ Name = 'GdriveMaterials';    Script = 'scripts\sync\gdrive-materials-sync.js';                Log = 'gdrive-materials.log';   Principal = 'System'; Trigger = @{ Daily = '19:30' } },
  @{ Name = 'CollegeCalendar';    Script = 'scripts\sync\college-calendar-sync.js';                Log = 'college-calendar.log';   Principal = 'System'; Trigger = @{ Daily = '19:45' } },
  @{ Name = 'CalendarSync';       Script = 'scripts\sync\calendar-sync.js';                        Log = 'calendar-sync.log';      Principal = 'System'; Trigger = @{ Weekly = 'Monday'; At = '07:00' } },
  @{ Name = 'WeeklyPlan';         Script = 'scripts\schedule\generate-weekly-plan.js';             Log = 'weekly-plan.log';        Principal = 'System'; Trigger = @{ Weekly = 'Sunday'; At = '21:00' } },
  @{ Name = 'NubankInvoice';      Script = 'scripts\sync\nubank-invoice-gmail-sync.js';            Log = 'nubank-invoice.log';     Principal = 'System'; Trigger = @{ Monthly = 5; At = '23:59' } },
  @{ Name = 'MonthlySummary';     Script = 'scripts\schedule\generate-monthly-finance-summary.js'; Log = 'monthly-summary.log';    Principal = 'System'; Trigger = @{ Monthly = 6; At = '00:30' } },
  # Per user, one after the other: up to 12 min each + 3 min between logins.
  @{ Name = 'SigaaSync';          Script = 'scripts\sync\sigaa-sync.js';  Args = '--headless'; Log = 'sigaa-sync.log'; Principal = 'User'; Highest = $true; Wake = $true; Limit = 'PT2H'; Trigger = @{ Daily = '19:00' } }
)

function Esc([string]$s) { [System.Security.SecurityElement]::Escape($s) }

function Start-Boundary([string]$at) { '2026-01-01T' + $at + ':00' }

function Trigger-Xml($t) {
  if ($t.Daily) {
    return "<CalendarTrigger><StartBoundary>$(Start-Boundary $t.Daily)</StartBoundary><Enabled>true</Enabled><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>"
  }
  if ($t.Weekly) {
    return "<CalendarTrigger><StartBoundary>$(Start-Boundary $t.At)</StartBoundary><Enabled>true</Enabled><ScheduleByWeek><DaysOfWeek><$($t.Weekly) /></DaysOfWeek><WeeksInterval>1</WeeksInterval></ScheduleByWeek></CalendarTrigger>"
  }
  if ($t.Monthly) {
    $months = 'January','February','March','April','May','June','July','August','September','October','November','December' | ForEach-Object { "<$_ />" }
    return "<CalendarTrigger><StartBoundary>$(Start-Boundary $t.At)</StartBoundary><Enabled>true</Enabled><ScheduleByMonth><DaysOfMonth><Day>$($t.Monthly)</Day></DaysOfMonth><Months>$($months -join '')</Months></ScheduleByMonth></CalendarTrigger>"
  }
  if ($t.EveryHours) {
    return "<TimeTrigger><StartBoundary>$(Start-Boundary $t.At)</StartBoundary><Enabled>true</Enabled><Repetition><Interval>PT$($t.EveryHours)H</Interval><StopAtDurationEnd>false</StopAtDurationEnd></Repetition></TimeTrigger>"
  }
  throw "Trigger desconhecido: $($t | Out-String)"
}

function Task-Xml($task) {
  $limit = if ($task.Limit) { $task.Limit } else { 'PT15M' }
  $wake = if ($task.Wake) { 'true' } else { 'false' }
  $command = "/c `"`"$Node`" --env-file=.env $($task.Script) $($task.Args) >> `"logs\$($task.Log)`" 2>&1`""
  if ($task.Principal -eq 'System') {
    $principal = '<UserId>S-1-5-18</UserId><RunLevel>HighestAvailable</RunLevel>'
  } else {
    $level = if ($task.Highest) { 'HighestAvailable' } else { 'LeastPrivilege' }
    $principal = "<UserId>$(Esc $CurrentUser)</UserId><LogonType>InteractiveToken</LogonType><RunLevel>$level</RunLevel>"
  }
  @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Hub Pessoal: $(Esc $task.Script) (scripts\schedule\setup-all-tasks.ps1)</Description></RegistrationInfo>
  <Triggers>$(Trigger-Xml $task.Trigger)</Triggers>
  <Principals><Principal id="Author">$principal</Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <WakeToRun>$wake</WakeToRun>
    <ExecutionTimeLimit>$limit</ExecutionTimeLimit>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec><Command>cmd.exe</Command><Arguments>$(Esc $command)</Arguments><WorkingDirectory>$(Esc $Root)</WorkingDirectory></Exec>
  </Actions>
</Task>
"@
}

$unknown = $Only | Where-Object { $_ -notin $Tasks.Name }
if ($unknown) { throw "Tarefa(s) desconhecida(s): $($unknown -join ', '). Existem: $($Tasks.Name -join ', ')" }

foreach ($task in $Tasks) {
  if ($Only.Count -gt 0 -and $task.Name -notin $Only) { continue }
  $name = "HubPessoal-$($task.Name)"
  $xml = Task-Xml $task
  if ($WhatIf) { Write-Output "--- $name"; Write-Output $xml; continue }
  Register-ScheduledTask -TaskName $name -Xml $xml -Force | Out-Null
  $next = (Get-ScheduledTaskInfo -TaskName $name).NextRunTime
  Write-Output ("OK {0,-28} next: {1:yyyy-MM-dd HH:mm}" -f $name, $next)
}

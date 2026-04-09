$ErrorActionPreference = 'Stop'

$taskName = 'Scaner Auto Start'
$scriptPath = Join-Path $PSScriptRoot 'start-scaner.ps1'

if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "Script de inicializacao nao encontrado: $scriptPath"
}

$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$quotedScriptPath = '"' + $scriptPath + '"'
$taskAction = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File $quotedScriptPath"
$taskTrigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$taskSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable
$taskPrincipal = New-ScheduledTaskPrincipal `
    -UserId $currentUser `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $taskAction `
    -Trigger $taskTrigger `
    -Settings $taskSettings `
    -Principal $taskPrincipal `
    -Description 'Inicializacao automatica da aplicacao Scaner no logon do Windows 11.' `
    -Force | Out-Null

Write-Host "Tarefa '$taskName' registrada para o usuario $currentUser."
Write-Host "A aplicacao sera iniciada automaticamente no proximo logon."
Write-Host "Para testar agora, execute: Start-ScheduledTask -TaskName '$taskName'"

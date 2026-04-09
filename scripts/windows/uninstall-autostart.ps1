$ErrorActionPreference = 'Stop'

$taskName = 'Scaner Auto Start'

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if (-not $task) {
    Write-Host "A tarefa '$taskName' nao existe."
    exit 0
}

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host "Tarefa '$taskName' removida."

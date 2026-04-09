$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
$logDir = Join-Path $projectRoot 'data\logs'
$stdoutLog = Join-Path $logDir 'scaner-autostart.out.log'
$stderrLog = Join-Path $logDir 'scaner-autostart.err.log'

if (-not (Test-Path -LiteralPath $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

Set-Location -LiteralPath $projectRoot

$npmCmd = (Get-Command npm.cmd -ErrorAction Stop).Source

Start-Process `
    -FilePath $npmCmd `
    -ArgumentList 'start' `
    -WorkingDirectory $projectRoot `
    -NoNewWindow `
    -Wait `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog

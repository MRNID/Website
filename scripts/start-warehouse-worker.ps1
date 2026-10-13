param([Parameter(Mandatory = $true)][string]$WorkerEnvFile)
$ErrorActionPreference = 'Stop'
$workerEnvPath = (Resolve-Path -LiteralPath $WorkerEnvFile).Path
if (-not (Test-Path -LiteralPath $workerEnvPath -PathType Leaf)) { throw 'Worker env must be a file.' }
$repoPath = Split-Path -Parent $PSScriptRoot
$workerEntry = Join-Path $repoPath 'apps/video-worker/dist/index.js'
if (-not (Test-Path -LiteralPath $workerEntry -PathType Leaf)) { throw 'Run corepack pnpm -r build first.' }
$env:WORKER_ENV_FILE = $workerEnvPath
Set-Location -LiteralPath $repoPath
& node $workerEntry
exit $LASTEXITCODE

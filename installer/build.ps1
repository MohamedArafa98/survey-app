# Build pipeline: frontend -> copy static -> embeddable Python -> Electron MSI
#
# Prerequisites:
#   - Node.js 20+ / npm 10+
#   - PowerShell 7 (pwsh)
#   - Internet access (first run downloads Python embeddable + pip deps)
#
# Usage:   pwsh .\installer\build.ps1

$ErrorActionPreference = 'Stop'
$ROOT = Split-Path -Parent $PSScriptRoot
Write-Host "== Survey App build ==" -ForegroundColor Cyan
Write-Host "Root: $ROOT"

# 1. Frontend build
Write-Host "`n[1/4] Building frontend..." -ForegroundColor Yellow
Push-Location "$ROOT\frontend"
if (-not (Test-Path node_modules)) { npm install }
npm run build
Pop-Location

# 2. Copy React build into backend static dir (served by FastAPI).
Write-Host "`n[2/4] Copying frontend build to backend/app/static..." -ForegroundColor Yellow
$static = "$ROOT\backend\app\static"
if (Test-Path $static) { Remove-Item -Recurse -Force $static }
New-Item -ItemType Directory -Path $static | Out-Null
Copy-Item -Recurse "$ROOT\frontend\dist\*" $static

# 3. Prepare embeddable Python runtime (idempotent).
Write-Host "`n[3/4] Preparing embeddable Python runtime..." -ForegroundColor Yellow
pwsh "$ROOT\desktop\scripts\fetch-python.ps1"

# 4. Package with electron-builder.
Write-Host "`n[4/4] Packaging Electron app + MSI..." -ForegroundColor Yellow
Push-Location "$ROOT\desktop"
if (-not (Test-Path node_modules)) { npm install }
npm run dist
Pop-Location

# Promote the artifact to a stable path for downstream consumers.
$built = Get-ChildItem "$ROOT\desktop\release\*.msi" | Select-Object -First 1
if (-not $built) { Write-Error "electron-builder produced no MSI in desktop\release" }
$target = "$ROOT\installer\SurveyApp.msi"
Copy-Item -Force $built.FullName $target
Write-Host "`nBuild complete: $target" -ForegroundColor Green

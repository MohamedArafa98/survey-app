# Manual Build Pipeline: frontend -> copy static -> embeddable Python -> Manual Electron Folder Assembly
#
# This avoids electron-builder's winCodeSign issues by manually assembling the distribution folder.

$ErrorActionPreference = "Stop"
$ROOT = Get-Location

Write-Host "== Survey App Manual Build ==" -ForegroundColor Cyan
Write-Host "Root: $ROOT`n"

# 1. Build React frontend
Write-Host "[1/4] Building frontend..." -ForegroundColor Yellow
Push-Location "$ROOT\frontend"
if (-not (Test-Path node_modules)) { npm install }
npm run build
Pop-Location

# 2. Copy static files to backend
Write-Host "`n[2/4] Copying frontend build to backend\app\static..." -ForegroundColor Yellow
$StaticDir = "$ROOT\backend\app\static"
if (Test-Path $StaticDir) { Remove-Item -Recurse -Force $StaticDir }
New-Item -ItemType Directory -Path $StaticDir | Out-Null
Copy-Item -Recurse -Force "$ROOT\frontend\dist\*" $StaticDir

# 3. Prepare embeddable Python runtime
Write-Host "`n[3/4] Preparing embeddable Python runtime..." -ForegroundColor Yellow
powershell.exe "$ROOT\desktop\scripts\fetch-python.ps1"

# 4. Manually assemble the application folder
Write-Host "`n[4/4] Assembling application folder..." -ForegroundColor Yellow
$target = "$ROOT\installer\SurveyApp"
if (Test-Path $target) { Remove-Item -Recurse -Force $target }
New-Item -ItemType Directory -Path $target | Out-Null

# Copy Electron binaries (pre-installed in desktop/node_modules/electron/dist)
$electronDist = "$ROOT\desktop\node_modules\electron\dist"
if (-not (Test-Path $electronDist)) {
    Write-Host "Installing electron dependencies..."
    Push-Location "$ROOT\desktop"
    npm install
    Pop-Location
}
Copy-Item -Recurse -Force "$electronDist\*" $target

# Rename electron.exe to "Survey App.exe"
Rename-Item "$target\electron.exe" "Survey App.exe"

# Prepare resources folder
$resTarget = "$target\resources"
# Copy our app files into resources/app (unpacked format)
$appTarget = "$resTarget\app"
New-Item -ItemType Directory -Path $appTarget | Out-Null
Copy-Item "$ROOT\desktop\main.js" $appTarget
Copy-Item "$ROOT\desktop\preload.js" $appTarget
Copy-Item "$ROOT\desktop\package.json" $appTarget
Copy-Item -Recurse -Force "$ROOT\desktop\node_modules" $appTarget

# Copy extra resources (backend and python-runtime)
Copy-Item -Recurse -Force "$ROOT\backend" "$resTarget\backend"
# Remove virtual environment from the copy to save space
if (Test-Path "$resTarget\backend\.venv") { Remove-Item -Recurse -Force "$resTarget\backend\.venv" }
# Remove pycache
Get-ChildItem -Path "$resTarget\backend" -Include "__pycache__" -Recurse | Remove-Item -Recurse -Force

Copy-Item -Recurse -Force "$ROOT\desktop\python-runtime" "$resTarget\python-runtime"

Write-Host "`nBuild complete: $target" -ForegroundColor Green

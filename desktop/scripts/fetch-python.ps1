# Download and prepare the embeddable Python runtime shipped inside the
# Electron app. Idempotent: skips the download/install when the runtime
# already has fastapi, pandas, openpyxl, and bcrypt importable.
#
# Layout produced:
#   desktop/python-runtime/
#     python.exe
#     python313.dll
#     python313._pth        (patched to enable site-packages + parent dir)
#     Lib/site-packages/    (pip + all backend requirements)
#
# Usage:
#   pwsh .\desktop\scripts\fetch-python.ps1

$ErrorActionPreference = 'Stop'
$PythonVersion = '3.13.1'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopDir = Split-Path -Parent $ScriptDir
$RootDir = Split-Path -Parent $DesktopDir
$RuntimeDir = Join-Path $DesktopDir 'python-runtime'
$Requirements = Join-Path $RootDir 'backend\requirements.txt'

function Test-RuntimeReady {
    if (-not (Test-Path (Join-Path $RuntimeDir 'python.exe'))) { return $false }
    $py = Join-Path $RuntimeDir 'python.exe'
    & $py -c "import fastapi, pandas, openpyxl, bcrypt, uvicorn" 2>$null
    return ($LASTEXITCODE -eq 0)
}

if (Test-RuntimeReady) {
    Write-Host "Python runtime already prepared at $RuntimeDir" -ForegroundColor Green
    exit 0
}

Write-Host "== Preparing embeddable Python $PythonVersion ==" -ForegroundColor Cyan

if (Test-Path $RuntimeDir) {
    Write-Host "Removing existing runtime directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $RuntimeDir
}
New-Item -ItemType Directory -Path $RuntimeDir | Out-Null

$zipUrl = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip"
$zipPath = Join-Path $env:TEMP "python-$PythonVersion-embed-amd64.zip"

Write-Host "Downloading $zipUrl"
Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing

Write-Host "Extracting to $RuntimeDir"
Expand-Archive -Path $zipPath -DestinationPath $RuntimeDir -Force
Remove-Item $zipPath

# Patch the ._pth file so site-packages is discovered and the embeddable
# Python can resolve the backend directory via PYTHONPATH.
$pthFile = Get-ChildItem -Path $RuntimeDir -Filter 'python*._pth' | Select-Object -First 1
if (-not $pthFile) { throw "python*._pth not found in $RuntimeDir" }
$pthContent = Get-Content $pthFile.FullName
$pthContent = $pthContent -replace '^#import site', 'import site'
$pthContent += 'Lib\site-packages'
Set-Content -Path $pthFile.FullName -Value $pthContent

# Bootstrap pip into the embeddable distro.
$getPip = Join-Path $env:TEMP 'get-pip.py'
Write-Host "Downloading get-pip.py"
Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile $getPip -UseBasicParsing

$python = Join-Path $RuntimeDir 'python.exe'
& $python $getPip --no-warn-script-location
if ($LASTEXITCODE -ne 0) { throw "get-pip.py failed" }
Remove-Item $getPip

Write-Host "Installing backend requirements into runtime..."
& $python -m pip install --no-warn-script-location -r $Requirements
if ($LASTEXITCODE -ne 0) { throw "pip install -r requirements.txt failed" }

Write-Host "Verifying imports..."
& $python -c "import fastapi, pandas, openpyxl, bcrypt, uvicorn; print('OK')"
if ($LASTEXITCODE -ne 0) { throw "Runtime import check failed" }

Write-Host "Runtime ready at $RuntimeDir" -ForegroundColor Green

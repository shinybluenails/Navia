$ErrorActionPreference = 'Stop'
$dest = Join-Path $PSScriptRoot '..\resources\win32'
New-Item -ItemType Directory -Force $dest | Out-Null

Write-Host "Downloading Ollama for Windows..."
$zip = Join-Path $env:TEMP 'ollama-windows.zip'
$ProgressPreference = 'SilentlyContinue'
Invoke-WebRequest -Uri 'https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip' -OutFile $zip

Write-Host "Extracting..."
$extract = Join-Path $env:TEMP 'ollama-win-extract'
Expand-Archive -Path $zip -DestinationPath $extract -Force
Copy-Item "$extract\ollama.exe" "$dest\ollama.exe" -Force

Write-Host "Done. Ollama placed at resources/win32/ollama.exe"

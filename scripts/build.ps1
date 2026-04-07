<#
.SYNOPSIS
    Build tool for Navia.

.DESCRIPTION
    Wraps common pnpm scripts with colored output and error handling.

.PARAMETER Task
    The task to run. Defaults to 'help'.
    Valid values: dev, build, build-win, build-unpack, start, typecheck, lint, format, setup-ollama, help

.EXAMPLE
    .\scripts\build.ps1 dev
    .\scripts\build.ps1 build-win
    .\scripts\build.ps1 setup-ollama
#>

param(
    [Parameter(Position = 0)]
    [ValidateSet('dev', 'build', 'build-win', 'build-unpack', 'start', 'typecheck', 'lint', 'format', 'setup-ollama', 'help')]
    [string]$Task = 'help'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent

function Write-Header([string]$Text) {
    Write-Host ""
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "  $('─' * $Text.Length)" -ForegroundColor DarkGray
}

function Write-Success([string]$Text) {
    Write-Host "  ✓ $Text" -ForegroundColor Green
}

function Write-Fail([string]$Text) {
    Write-Host "  ✗ $Text" -ForegroundColor Red
}

function Invoke-PnpmTask([string]$Script, [string]$Label) {
    Write-Header $Label
    Push-Location $Root
    try {
        pnpm run $Script
        if ($LASTEXITCODE -ne 0) { throw "pnpm run $Script exited with code $LASTEXITCODE" }
        Write-Success "Done"
    } finally {
        Pop-Location
    }
}

function Show-Help {
    Write-Host ""
    Write-Host "  Navia Build Tool" -ForegroundColor Cyan
    Write-Host "  ───────────────────" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  Usage:  .\scripts\build.ps1 <task>" -ForegroundColor White
    Write-Host ""
    Write-Host "  Tasks:" -ForegroundColor Yellow
    Write-Host "    dev            Start development server with hot reload"
    Write-Host "    build          Typecheck + build for production"
    Write-Host "    build-win      Typecheck + build + package Windows installer"
    Write-Host "    build-unpack   Typecheck + build + unpack (no installer, for testing)"
    Write-Host "    start          Preview the last production build"
    Write-Host "    typecheck      Run TypeScript type checking"
    Write-Host "    lint           Run ESLint (auto-fix)"
    Write-Host "    format         Run Prettier (auto-format)"
    Write-Host "    setup-ollama   Download and set up Ollama for Windows"
    Write-Host "    help           Show this help message"
    Write-Host ""
}

switch ($Task) {
    'dev'          { Invoke-PnpmTask 'dev'          'Starting dev server' }
    'build'        { Invoke-PnpmTask 'build'        'Building for production' }
    'build-win'    { Invoke-PnpmTask 'build:win'    'Building Windows installer' }
    'build-unpack' { Invoke-PnpmTask 'build:unpack' 'Building (unpacked)' }
    'start'        { Invoke-PnpmTask 'start'        'Starting preview' }
    'typecheck'    { Invoke-PnpmTask 'typecheck'    'Running type checks' }
    'lint'         { Invoke-PnpmTask 'lint'         'Running linter' }
    'format'       { Invoke-PnpmTask 'format'       'Formatting code' }
    'setup-ollama' { Invoke-PnpmTask 'setup:ollama:win' 'Setting up Ollama' }
    'help'         { Show-Help }
}

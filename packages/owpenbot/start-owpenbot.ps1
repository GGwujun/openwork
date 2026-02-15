# OpenWork Owpenbot Startup Script
# For China network environment (auto proxy config)
# Usage: .\start-owpenbot.ps1 [project-path]
# Example: .\start-owpenbot.ps1 C:\Users\Lenovo\Projects\my-project

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectPath = $(Get-Location)
)

# Display config
Write-Host "Starting Owpenbot..." -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Gray

# 1. Set proxy (required for Telegram API)
# Change port if using different proxy software:
# - Clash: 7890
# - v2rayN: 10809
$ProxyUrl = "http://127.0.0.1:7890"

$env:HTTP_PROXY = $ProxyUrl
$env:HTTPS_PROXY = $ProxyUrl
$env:NO_PROXY = "localhost,127.0.0.1,::1"

Write-Host "Proxy: $ProxyUrl" -ForegroundColor Cyan

# 2. Set OpenCode connection
$env:OPENCODE_URL = "http://127.0.0.1:8080"
$env:OPENCODE_DIRECTORY = $ProjectPath

Write-Host "OpenCode: $($env:OPENCODE_URL)" -ForegroundColor Cyan
Write-Host "Project: $ProjectPath" -ForegroundColor Cyan

# 3. Telegram Bot Token
# Security: Token exposed, please regenerate via @BotFather
if (-not $env:TELEGRAM_BOT_TOKEN) {
    $env:TELEGRAM_BOT_TOKEN = "8106652712:AAHbv2yQpX9fBXmMJc02avJRmqLJHAQFPNI"
    Write-Host "WARNING: Using current token (please regenerate!)" -ForegroundColor Yellow
} else {
    Write-Host "Using token from environment variable" -ForegroundColor Green
}

# Verify Bot
Write-Host ""
Write-Host "Verifying Telegram Bot..."
try {
    $response = Invoke-RestMethod -Uri "https://api.telegram.org/bot$($env:TELEGRAM_BOT_TOKEN)/getMe" -Method GET -Proxy $ProxyUrl
    if ($response.ok) {
        Write-Host "Bot verified: @$($response.result.username)" -ForegroundColor Green
    }
} catch {
    Write-Host "Bot verification failed: $_" -ForegroundColor Red
    exit 1
}

# 4. Verify OpenCode
Write-Host ""
Write-Host "Verifying OpenCode..."
try {
    $health = Invoke-RestMethod -Uri "$($env:OPENCODE_URL)/health" -Method GET -TimeoutSec 5
    Write-Host "OpenCode connected (version: $($health.version))" -ForegroundColor Green
} catch {
    Write-Host "OpenCode connection failed: $_" -ForegroundColor Yellow
    Write-Host "Make sure OpenCode is running: opencode serve --port 8080" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y") {
        exit 1
    }
}

# 5. Start Owpenbot
Write-Host ""
Write-Host "=================================" -ForegroundColor Gray
Write-Host "Starting Owpenbot..." -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Gray
Write-Host ""

# Start
try {
    Set-Location $ProjectPath
    pnpm dev
} catch {
    Write-Host "Failed to start: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Install owpenbot: npm install -g owpenwork" -ForegroundColor Gray
    Write-Host "  2. Check Node.js version: node --version" -ForegroundColor Gray
    Write-Host "  3. Verify proxy is working" -ForegroundColor Gray
    exit 1
}

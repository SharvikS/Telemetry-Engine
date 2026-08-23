# ============================================================
# Telemetry Engine - Unified Launch Script
# Starts all four pipeline stages in separate terminal windows
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  ◆ TELEMETRY ENGINE - Launch Sequence" -ForegroundColor Green
Write-Host "  ======================================" -ForegroundColor DarkGray
Write-Host ""

# 1. Start Node Relay
Write-Host "  [1/4] Starting Node Relay (Port 4000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\relay'; Write-Host '=== NODE RELAY ===' -ForegroundColor Cyan; node index.js" -WindowStyle Normal

# 2. Start React Dashboard
Write-Host "  [2/4] Starting React Dashboard (Vite)..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\dashboard'; Write-Host '=== REACT DASHBOARD ===' -ForegroundColor Blue; npm run dev" -WindowStyle Normal

# Wait for Node/React to spin up
Write-Host "  [..] Waiting 3 seconds for services to initialize..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3

# 3. Start Python Inference
Write-Host "  [3/4] Starting Python Inference Engine..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\inference'; Write-Host '=== PYTHON INFERENCE ===' -ForegroundColor Yellow; python main.py" -WindowStyle Normal

# 4. Start Rust Capture
Write-Host "  [4/4] Starting Rust Capture Module..." -ForegroundColor Red
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\capture'; Write-Host '=== RUST CAPTURE ===' -ForegroundColor Red; cargo run --release" -WindowStyle Normal

Write-Host ""
Write-Host "  ✓ All systems launched! Four terminal windows should be active." -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard:  http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Relay:      http://localhost:4000" -ForegroundColor Cyan
Write-Host "  Health API: http://localhost:4000/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press Ctrl+C in each window to stop individual services." -ForegroundColor DarkGray
Write-Host ""

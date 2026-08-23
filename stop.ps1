# ============================================================
# Telemetry Engine - Shutdown Script
# Gracefully stops all running pipeline services
# ============================================================

$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "  ◆ TELEMETRY ENGINE - Shutdown Sequence" -ForegroundColor Red
Write-Host "  ========================================" -ForegroundColor DarkGray
Write-Host ""

Get-WmiObject Win32_Process -Filter "name='python.exe' and CommandLine like '%main.py%'" | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

Get-WmiObject Win32_Process -Filter "name='python.exe' and CommandLine like '%mock_inference.py%'" | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# Stop Node processes
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "  [1/3] Stopping Node.js processes..." -ForegroundColor Cyan
    $nodeProcesses | Stop-Process -Force
    Write-Host "        ✓ Node processes terminated" -ForegroundColor Green
} else {
    Write-Host "  [1/3] No Node.js processes found" -ForegroundColor DarkGray
}

# Stop Python processes
$pythonProcesses = Get-Process -Name "python" -ErrorAction SilentlyContinue
if ($pythonProcesses) {
    Write-Host "  [2/3] Stopping Python processes..." -ForegroundColor Yellow
    $pythonProcesses | Stop-Process -Force
    Write-Host "        ✓ Python processes terminated" -ForegroundColor Green
} else {
    Write-Host "  [2/3] No Python processes found" -ForegroundColor DarkGray
}

# Stop Rust capture
$captureProcesses = Get-Process -Name "capture" -ErrorAction SilentlyContinue
if ($captureProcesses) {
    Write-Host "  [3/3] Stopping Rust Capture..." -ForegroundColor Red
    $captureProcesses | Stop-Process -Force
    Write-Host "        ✓ Capture process terminated" -ForegroundColor Green
} else {
    Write-Host "  [3/3] No Capture process found" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "  ✓ All services stopped." -ForegroundColor Green
Write-Host ""

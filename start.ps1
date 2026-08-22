# Telemetry Engine Unified Launch Script
Write-Host "Starting Telemetry Engine..." -ForegroundColor Cyan

# Start Node Relay
Write-Host "Starting Node Relay (Port 4000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd relay; node index.js" -WindowStyle Normal

# Start React Dashboard
Write-Host "Starting React Dashboard..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd dashboard; npm run dev" -WindowStyle Normal

# Wait 2 seconds for Node/React to initialize
Start-Sleep -Seconds 2

# Start Python Inference
Write-Host "Starting Python Inference..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd inference; python main.py" -WindowStyle Normal

# Start Rust Capture
Write-Host "Starting Rust Capture..." -ForegroundColor Red
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd capture; cargo run --release" -WindowStyle Normal

Write-Host "All systems GO! Four terminal windows should be active." -ForegroundColor Cyan

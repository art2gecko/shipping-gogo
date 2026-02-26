#!/usr/bin/env pwsh
# ShipGo - Start both backend and frontend in one command
# Usage: .\start.ps1

Write-Host "Starting ShipGo..." -ForegroundColor Cyan

# Start backend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev"

# Start frontend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; npm run dev"

Start-Sleep -Seconds 3
Write-Host ""
Write-Host "Both servers starting!" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:3000" -ForegroundColor Gray
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Login:    admin / admin123" -ForegroundColor Cyan
Write-Host ""

# Open browser
Start-Process "http://localhost:5173"

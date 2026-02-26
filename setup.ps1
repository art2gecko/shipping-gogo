#!/usr/bin/env pwsh
# ShipGo - One-command setup script for Windows
# Usage: .\setup.ps1

$ErrorActionPreference = "Stop"

Write-Host "`n=== ShipGo Setup ===" -ForegroundColor Cyan

# 1. Check Node.js
Write-Host "`n[1/7] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# 2. Install backend dependencies
Write-Host "`n[2/7] Installing backend dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  npm install failed" -ForegroundColor Red; exit 1 }

# 3. Check for .env
if (-not (Test-Path ".env")) {
    Write-Host "`n[3/7] Creating .env file..." -ForegroundColor Yellow
    @"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shipping_gogo?schema=public"
PORT=3000
NODE_ENV=development
SHIPMENT_ROOT="./Shipments"
ADMIN_PASSWORD="admin123"
WAREHOUSE_PASSWORD="warehouse123"
"@ | Out-File -Encoding utf8 ".env"
    Write-Host "  .env created" -ForegroundColor Green
} else {
    Write-Host "`n[3/7] .env already exists" -ForegroundColor Green
}

# 4. Start PostgreSQL via Docker
Write-Host "`n[4/7] Starting PostgreSQL..." -ForegroundColor Yellow
try {
    docker --version | Out-Null
    Write-Host "  Docker found, starting PostgreSQL container..." -ForegroundColor Green
    docker compose up -d db 2>&1 | Out-Null
    Start-Sleep -Seconds 3
    Write-Host "  PostgreSQL running on port 5432" -ForegroundColor Green
} catch {
    Write-Host "  Docker not found. Make sure PostgreSQL is running manually on port 5432." -ForegroundColor Yellow
    Write-Host "  If you have PostgreSQL installed, start the service and create the database:" -ForegroundColor Yellow
    Write-Host '    psql -U postgres -c "CREATE DATABASE shipping_gogo;"' -ForegroundColor Gray
}

# 5. Run Prisma setup
Write-Host "`n[5/7] Setting up database..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Host "  prisma generate failed" -ForegroundColor Red; exit 1 }

npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { Write-Host "  prisma migrate failed - is PostgreSQL running?" -ForegroundColor Red; exit 1 }

npx prisma db seed
if ($LASTEXITCODE -ne 0) { Write-Host "  prisma seed failed" -ForegroundColor Red; exit 1 }
Write-Host "  Database ready with demo data" -ForegroundColor Green

# 6. Install frontend dependencies
Write-Host "`n[6/7] Installing frontend dependencies..." -ForegroundColor Yellow
Push-Location frontend
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  frontend npm install failed" -ForegroundColor Red; Pop-Location; exit 1 }
Pop-Location

# 7. Done
Write-Host "`n[7/7] Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "=== To start the app, open TWO terminals ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Terminal 1 (backend):" -ForegroundColor White
Write-Host "    npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  Terminal 2 (frontend):" -ForegroundColor White
Write-Host "    cd frontend && npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  Then open: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Login:     admin / admin123" -ForegroundColor Cyan
Write-Host ""

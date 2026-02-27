@echo off
setlocal enabledelayedexpansion
echo ============================================
echo   ShipGo - One-Click Setup and Launch
echo ============================================
echo.

echo [1/5] Installing backend dependencies...
call npm install --silent
if errorlevel 1 (
    echo ERROR: Backend install failed
    pause
    exit /b 1
)

echo [2/5] Installing frontend dependencies...
cd frontend
call npm install --silent
if errorlevel 1 (
    echo ERROR: Frontend install failed
    pause
    exit /b 1
)
cd ..

echo [3/5] Checking PostgreSQL...

REM Check if port 5432 is already in use (local PostgreSQL)
set "PORT_IN_USE=0"
netstat -an 2>nul | findstr "LISTENING" | findstr ":5432 " >nul 2>nul
if not errorlevel 1 set "PORT_IN_USE=1"

if "!PORT_IN_USE!"=="1" (
    echo Found PostgreSQL already running on port 5432.
    echo Skipping Docker, using existing PostgreSQL...
    REM Try to create database using psql if available
    set "PGPASSWORD=postgres"
    where psql >nul 2>nul
    if not errorlevel 1 (
        psql -U postgres -h localhost -tc "SELECT 1 FROM pg_database WHERE datname='shipping_gogo'" 2>nul | findstr "1" >nul
        if errorlevel 1 (
            psql -U postgres -h localhost -c "CREATE DATABASE shipping_gogo;" 2>nul
            if errorlevel 1 (
                echo WARNING: Could not create database via psql, Prisma will try directly...
            ) else (
                echo Database created.
            )
        ) else (
            echo Database already exists.
        )
    )
) else (
    REM Port 5432 is free, try Docker
    docker compose up -d db 2>nul
    if errorlevel 1 (
        echo.
        echo ERROR: Port 5432 is not in use and Docker is not available.
        echo.
        echo Install ONE of these:
        echo   1. PostgreSQL for Windows: https://www.postgresql.org/download/windows/
        echo      - Set superuser password to: postgres
        echo      - Keep default port: 5432
        echo   2. Docker Desktop: https://www.docker.com/products/docker-desktop
        echo.
        pause
        exit /b 1
    )
    echo PostgreSQL started via Docker.
    echo Waiting for PostgreSQL to be ready...
    timeout /t 5 /nobreak >nul
    docker compose exec -T db pg_isready -U postgres >nul 2>nul
    if errorlevel 1 (
        echo Still waiting...
        timeout /t 5 /nobreak >nul
    )
)

REM Set DATABASE_URL explicitly so Prisma always finds it
set "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/shipping_gogo?schema=public"

echo [4/5] Running database setup (migrations + seed)...
call npx prisma generate --no-hints
if errorlevel 1 (
    echo ERROR: Prisma generate failed
    pause
    exit /b 1
)
call npx prisma db push --accept-data-loss
if errorlevel 1 (
    echo.
    echo ERROR: Database schema push failed.
    echo.
    echo If you see "Authentication failed", run:
    echo   docker compose down -v
    echo Then re-run start.bat to recreate the database with correct credentials.
    echo.
    pause
    exit /b 1
)
call npx prisma db seed --no-hints
if errorlevel 1 (
    echo WARNING: Seed may have already run, continuing...
)

echo.
echo [5/5] Starting servers...
echo.
echo ============================================
echo   Backend API:  http://localhost:3000
echo   Frontend UI:  http://localhost:5173
echo.
echo   Login with:
echo     Username: admin
echo     Password: admin123
echo ============================================
echo.

REM Start backend in a separate window
start "ShipGo Backend" cmd /c "npx ts-node src/index.ts"
timeout /t 2 /nobreak >nul

REM Open browser
start http://localhost:5173

REM Start frontend (keeps this window open)
cd frontend
call npx vite --host
pause

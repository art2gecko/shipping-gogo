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
REM Try Docker first, fall back to local PostgreSQL
docker compose up -d db 2>nul
if errorlevel 1 (
    echo Docker not available, checking for local PostgreSQL...
    where pg_isready >nul 2>nul
    if errorlevel 1 (
        REM pg_isready not on PATH, try common install locations
        set "PGBIN="
        if exist "C:\Program Files\PostgreSQL\17\bin\pg_isready.exe" set "PGBIN=C:\Program Files\PostgreSQL\17\bin"
        if exist "C:\Program Files\PostgreSQL\16\bin\pg_isready.exe" set "PGBIN=C:\Program Files\PostgreSQL\16\bin"
        if exist "C:\Program Files\PostgreSQL\15\bin\pg_isready.exe" set "PGBIN=C:\Program Files\PostgreSQL\15\bin"
        if defined PGBIN (
            echo Found PostgreSQL at !PGBIN!
        ) else (
            echo.
            echo ERROR: PostgreSQL is not installed.
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
    )
    REM Create the database if it doesn't exist
    echo Creating database if needed...
    set PGPASSWORD=postgres
    psql -U postgres -h localhost -tc "SELECT 1 FROM pg_database WHERE datname='shipping_gogo'" 2>nul | findstr "1" >nul
    if errorlevel 1 (
        psql -U postgres -h localhost -c "CREATE DATABASE shipping_gogo;" 2>nul
        if errorlevel 1 (
            echo.
            echo ERROR: Cannot connect to PostgreSQL.
            echo Make sure PostgreSQL is running and password for user "postgres" is "postgres".
            echo.
            pause
            exit /b 1
        )
        echo Database created.
    ) else (
        echo Database already exists.
    )
) else (
    echo PostgreSQL started via Docker.
    echo Waiting for PostgreSQL to be ready...
    timeout /t 3 /nobreak >nul
)

echo [4/5] Running database setup (migrations + seed)...
call npx prisma generate --no-hints
if errorlevel 1 (
    echo ERROR: Prisma generate failed
    pause
    exit /b 1
)
call npx prisma db push --accept-data-loss --skip-generate
if errorlevel 1 (
    echo ERROR: Database schema push failed
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

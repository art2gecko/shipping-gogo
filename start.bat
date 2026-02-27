@echo off
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

echo [3/5] Starting PostgreSQL via Docker...
docker compose up -d db
if errorlevel 1 (
    echo.
    echo ERROR: Could not start PostgreSQL.
    echo Make sure Docker Desktop is installed and running.
    echo Download from: https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)

echo Waiting for PostgreSQL to be ready...
timeout /t 3 /nobreak >nul

echo [4/5] Running database setup (migrations + seed)...
call npx prisma generate --no-hints
if errorlevel 1 (
    echo ERROR: Prisma generate failed
    pause
    exit /b 1
)
call npx prisma migrate deploy --no-hints
if errorlevel 1 (
    echo ERROR: Database migration failed
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

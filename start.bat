@echo off
echo ============================================
echo   ShipGo - One-Click Setup and Launch
echo ============================================
echo.

echo [1/3] Installing backend dependencies...
call npm install --silent
if errorlevel 1 (
    echo ERROR: Backend install failed
    pause
    exit /b 1
)

echo [2/3] Installing frontend dependencies...
cd frontend
call npm install --silent
if errorlevel 1 (
    echo ERROR: Frontend install failed
    pause
    exit /b 1
)

echo [3/3] Starting frontend dev server...
echo.
echo ============================================
echo   Opening http://localhost:5173 in browser
echo ============================================
echo.
start http://localhost:5173
call npx vite --host
pause

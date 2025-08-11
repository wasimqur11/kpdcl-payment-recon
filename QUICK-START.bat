@echo off
echo.
echo ===============================================
echo   KPDCL Payment Reconciliation Dashboard
echo   Quick Start
echo ===============================================
echo.
echo Starting the dashboard server...
echo.

REM Kill any existing process on port 3001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
    echo Stopping existing server on port 3001...
    taskkill //PID %%a //F >nul 2>&1
)

echo Starting KPDCL Dashboard...
echo.
echo URLs:
echo 📊 Dashboard: http://localhost:3001
echo 🔧 API Health: http://localhost:3001/api/health
echo 🗄️  Database Test: http://localhost:3001/api/test-db
echo.
echo Press Ctrl+C to stop the server
echo.

cd /d "%~dp0"
npm start
@echo off
echo ===============================================
echo   KPDCL Payment Reconciliation Dashboard
echo ===============================================
echo.
echo Setting up the application...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✓ Node.js is installed

REM Install dependencies
echo.
echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install backend dependencies
    pause
    exit /b 1
)

echo ✓ Backend dependencies installed

REM Install client dependencies
echo.
echo Installing client dependencies...
cd client
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install frontend dependencies
    pause
    exit /b 1
)

echo ✓ Frontend dependencies installed
cd..

REM Check if .env file exists
if not exist .env (
    echo.
    echo WARNING: .env file not found!
    echo Copying .env.example to .env...
    copy .env.example .env
    echo.
    echo IMPORTANT: Please edit .env file with your database credentials
    echo Press any key to continue...
    pause >nul
)

REM Create logs directory
if not exist logs mkdir logs

echo.
echo ===============================================
echo   Starting KPDCL Dashboard...
echo ===============================================
echo.
echo 🚀 Dashboard will be available at: http://localhost:3001
echo 🔧 API endpoints at: http://localhost:3001/api
echo 🏥 Health check: http://localhost:3001/api/health
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start the server
call npm start
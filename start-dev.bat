@echo off
echo ===============================================
echo   KPDCL Dashboard - Development Mode
echo ===============================================
echo.
echo Starting in development mode with hot reload...
echo.
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000 (React dev server)
echo.

REM Check if dependencies are installed
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

if not exist client\node_modules (
    echo Installing client dependencies...
    cd client
    call npm install
    cd..
)

REM Start both servers concurrently
start "KPDCL Backend" cmd /k "npm run dev"
timeout /t 3
start "KPDCL Frontend" cmd /k "npm run client"

echo.
echo Both servers are starting...
echo Backend API: http://localhost:3001/api
echo Frontend UI: http://localhost:3000
echo.
pause
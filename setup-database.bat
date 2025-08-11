@echo off
echo ===============================================
echo   KPDCL Database Setup Helper
echo ===============================================
echo.
echo This script will help you set up the database for the KPDCL Dashboard
echo.

REM Check if .env exists
if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env
    echo.
    echo IMPORTANT: Please edit the .env file with your Oracle database credentials
    echo.
    echo Example configuration:
    echo CORPORTAL_DB_HOST=your-corportal-server
    echo CORPORTAL_DB_PORT=1521
    echo CORPORTAL_DB_SERVICE=your-service-name
    echo CORPORTAL_DB_USER=your-username
    echo CORPORTAL_DB_PASSWORD=your-password
    echo.
    echo CCB_DB_HOST=your-ccb-server
    echo CCB_DB_PORT=1521
    echo CCB_DB_SERVICE=your-service-name
    echo CCB_DB_USER=your-username
    echo CCB_DB_PASSWORD=your-password
    echo.
    echo Press any key after updating the .env file...
    pause >nul
)

echo.
echo Testing database connectivity...
call npm run init-db

if %errorlevel% equ 0 (
    echo.
    echo ✓ Database connectivity test completed successfully!
    echo.
    echo The script has provided you with:
    echo 1. Sample DDL scripts to create required tables
    echo 2. Sample data for testing
    echo 3. Performance monitoring queries
    echo.
    echo Please execute the DDL scripts in your Oracle databases:
    echo - CORPORTAL_PAYMENTS table in CORPORTAL database
    echo - CCB_PAYMENTS table in CCB database
    echo.
) else (
    echo.
    echo ❌ Database connectivity test failed!
    echo.
    echo Please check:
    echo 1. Database server is running and accessible
    echo 2. Credentials in .env file are correct
    echo 3. Network connectivity to database servers
    echo 4. Oracle client libraries are installed
    echo.
)

echo.
echo Press any key to continue...
pause >nul
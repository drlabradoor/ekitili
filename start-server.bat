@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title EkiTili Server Manager

:MAIN_MENU
cls
echo ========================================
echo   EkiTili Server Manager
echo ========================================
echo.
echo   [1] Start Servers
echo   [2] Restart Servers
echo   [3] Stop All Servers
echo   [4] Check Server Status
echo   [5] Exit
echo.
echo ========================================
set /p choice="Select option (1-5): "

if "%choice%"=="1" goto START_SERVERS
if "%choice%"=="2" goto RESTART_SERVERS
if "%choice%"=="3" goto STOP_SERVERS
if "%choice%"=="4" goto CHECK_STATUS
if "%choice%"=="5" goto EXIT
goto MAIN_MENU

:START_SERVERS
cls
echo ========================================
echo   Starting Servers...
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found!
    echo Install Node.js from https://nodejs.org/
    echo.
    pause
    goto MAIN_MENU
)

REM Check if package.json exists
if not exist "package.json" (
    echo [ERROR] package.json file not found!
    pause
    goto MAIN_MENU
)

REM Install dependencies if needed
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        pause
        goto MAIN_MENU
    )
    echo.
)

REM Check if servers are already running
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000"') do (
    echo [WARNING] Port 3000 is already in use. Backend may already be running.
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000"') do (
    echo [WARNING] Port 8000 is already in use. Frontend may already be running.
)

REM Check Oracle Instant Client (optional)
echo [INFO] Checking Oracle Instant Client...
where sqlplus >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Oracle Instant Client found
) else (
    echo [WARNING] Oracle Instant Client not found
    echo Install Oracle Instant Client to work with database
    echo Download: https://www.oracle.com/database/technologies/instant-client/downloads.html
)
echo.

REM Start backend server
echo [INFO] Starting backend API server (port 3000)...
cd /d "%~dp0"
set "SCRIPT_DIR=%~dp0"
start "EkiTili Backend API" cmd /k "cd /d %SCRIPT_DIR% && node server.js"

REM Wait for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend server
echo [INFO] Starting web server (port 8000)...
cd /d "%~dp0"
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start "EkiTili Frontend Server" cmd /k "cd /d %SCRIPT_DIR% && python -m http.server 8000"
) else (
    echo [INFO] Python not found. Using Node.js http-server...
    start "EkiTili Frontend Server" cmd /k "cd /d %SCRIPT_DIR% && npx http-server -p 8000 -c-1"
)

timeout /t 1 /nobreak >nul

echo.
echo ========================================
echo   Servers Started!
echo ========================================
echo   Frontend: http://localhost:8000
echo   Backend API: http://localhost:3000/api
echo.
echo   Servers are running in separate windows.
echo   Use this menu to manage servers.
echo ========================================
echo.
timeout /t 2 /nobreak >nul
goto MAIN_MENU

:RESTART_SERVERS
cls
echo ========================================
echo   Restarting Servers...
echo ========================================
echo.
echo [INFO] Stopping all servers...
call :STOP_SERVERS_INTERNAL
timeout /t 2 /nobreak >nul
echo [INFO] Starting servers...
goto START_SERVERS

:STOP_SERVERS
cls
echo ========================================
echo   Stopping All Servers...
echo ========================================
echo.
call :STOP_SERVERS_INTERNAL
echo.
echo [OK] All servers stopped.
echo.
pause
goto MAIN_MENU

:STOP_SERVERS_INTERNAL
set "stopped=0"

REM Close server windows by title
taskkill /FI "WINDOWTITLE eq EkiTili Backend API*" /F >nul 2>nul
if not errorlevel 1 (
    echo [OK] Stopped backend server window
    set "stopped=1"
)

taskkill /FI "WINDOWTITLE eq EkiTili Frontend Server*" /F >nul 2>nul
if not errorlevel 1 (
    echo [OK] Stopped frontend server window
    set "stopped=1"
)

REM Stop processes on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>nul
    if not errorlevel 1 (
        echo [OK] Stopped process on port 3000 (PID: %%a)
        set "stopped=1"
    )
)

REM Stop processes on port 8000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>nul
    if not errorlevel 1 (
        echo [OK] Stopped process on port 8000 (PID: %%a)
        set "stopped=1"
    )
)

REM Stop Node.js processes running server.js
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST 2^>nul ^| findstr "PID"') do (
    set "pid=%%a"
    set "pid=!pid:PID:=!"
    for /f "delims=" %%b in ('wmic process where "ProcessId=!pid!" get CommandLine /format:list 2^>nul ^| findstr "server.js"') do (
        taskkill /PID !pid! /F >nul 2>nul
        if not errorlevel 1 (
            echo [OK] Stopped backend server (PID: !pid!)
            set "stopped=1"
        )
    )
)

REM Stop Python HTTP server processes
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO LIST 2^>nul ^| findstr "PID"') do (
    set "pid=%%a"
    set "pid=!pid:PID:=!"
    for /f "delims=" %%b in ('wmic process where "ProcessId=!pid!" get CommandLine /format:list 2^>nul ^| findstr "http.server"') do (
        taskkill /PID !pid! /F >nul 2>nul
        if not errorlevel 1 (
            echo [OK] Stopped frontend server (PID: !pid!)
            set "stopped=1"
        )
    )
)

REM Stop http-server processes (Node.js alternative)
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST 2^>nul ^| findstr "PID"') do (
    set "pid=%%a"
    set "pid=!pid:PID:=!"
    for /f "delims=" %%b in ('wmic process where "ProcessId=!pid!" get CommandLine /format:list 2^>nul ^| findstr "http-server"') do (
        taskkill /PID !pid! /F >nul 2>nul
        if not errorlevel 1 (
            echo [OK] Stopped http-server (PID: !pid!)
            set "stopped=1"
        )
    )
)

if "%stopped%"=="0" (
    echo [INFO] No running servers found.
)
exit /b

:CHECK_STATUS
cls
echo ========================================
echo   Server Status
echo ========================================
echo.

REM Check port 3000
netstat -ano | findstr ":3000" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Backend API (port 3000): RUNNING
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000"') do (
        echo       PID: %%a
    )
) else (
    echo [OFF] Backend API (port 3000): STOPPED
)

REM Check port 8000
netstat -ano | findstr ":8000" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Frontend Server (port 8000): RUNNING
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000"') do (
        echo       PID: %%a
    )
) else (
    echo [OFF] Frontend Server (port 8000): STOPPED
)

echo.
echo ========================================
echo.
pause
goto MAIN_MENU

:EXIT
cls
echo.
echo [INFO] Exiting Server Manager...
echo.
timeout /t 1 /nobreak >nul
exit /b 0

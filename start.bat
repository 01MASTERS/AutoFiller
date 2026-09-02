@echo off
setlocal enabledelayedexpansion
title AutoFiller — Startup Script

echo ===================================================
echo ⚡ AutoFiller — Chrome Extension ^& LLM Backend
echo ===================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js v18+ from https://nodejs.org/
    pause
    exit /b 1
)

:: Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed or not in PATH!
    pause
    exit /b 1
)

:: Install dependencies if node_modules is missing
if not exist "node_modules" (
    echo [1/4] Installing project dependencies...
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
) else (
    echo [1/4] Dependencies verified - node_modules present.
)

:: Setup backend env file if missing
if not exist "backend\.env" (
    echo [2/4] Creating backend\.env from template...
    copy "backend\.env.example" "backend\.env" >nul
) else (
    echo [2/4] Backend environment file verified - backend\.env present.
)

:: Setup backend profile file if missing
if not exist "backend\profile.json" (
    echo [3/4] Creating backend\profile.json from template...
    copy "backend\profile.example.json" "backend\profile.json" >nul
) else (
    echo [3/4] User profile verified - backend\profile.json present.
)

:: Build shared types package
echo [4/5] Building shared package types...
call npm run build -w shared
if %errorlevel% neq 0 (
    echo [ERROR] Shared package build failed!
    pause
    exit /b 1
)

:: Build extension bundle upfront so dist/manifest.json is ready immediately
echo [5/5] Building Chrome extension bundle (extension/dist)...
call npm run build -w extension
if %errorlevel% neq 0 (
    echo [ERROR] Extension build failed!
    pause
    exit /b 1
)

echo.
echo ===================================================
echo 🚀 Starting AutoFiller Development Server
echo ---------------------------------------------------
echo  • Backend API:        http://localhost:3456
echo  • Debug Log Dashboard: http://localhost:3456/logs-ui
echo  • QA Test Form:       http://localhost:3456/test-form
echo  • Extension Build:    extension/dist/ (Load in chrome://extensions)
echo ===================================================
echo.

:: Launch browser dashboard after 3 seconds in background
start /b cmd /c "timeout /t 3 >nul && start http://localhost:3456/logs-ui"

:: Run dev server (extension watcher + backend tsx watch)
call npm run dev

pause

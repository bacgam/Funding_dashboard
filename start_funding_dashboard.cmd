@echo off
setlocal
title PERPDEX - Funding Desk
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. Install it from https://nodejs.org
  pause
  exit /b 1
)
if not defined PORT set PORT=4180
node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/funding',{signal:AbortSignal.timeout(1500)}).then(r=>r.json()).then(d=>process.exit(Array.isArray(d.rows) && d.sources?.nado ? 0 : 1)).catch(()=>process.exit(1))" >nul 2>nul
if not errorlevel 1 (
  if not "%PORTFOLIO_LAUNCH%"=="1" start "" http://127.0.0.1:%PORT%
  exit /b 0
)
if not "%PORTFOLIO_LAUNCH%"=="1" start "" http://127.0.0.1:%PORT%
node server.mjs
if errorlevel 1 pause

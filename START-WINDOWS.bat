@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 or later, then run this file again.
  pause
  exit /b 1
)
echo Starting Campus Lost ^& Found...
echo Open http://localhost:3000 in your browser after the server starts.
node scripts/demo.mjs
pause

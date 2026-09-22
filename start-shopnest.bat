@echo off
setlocal
cd /d "%~dp0"

echo Starting Shopnest...
start "" "%~dp0index.html"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo Frontend opened successfully.
  echo Node.js is not installed, so the backend was not started.
  echo Install Node.js LTS from https://nodejs.org/ and run this file again.
  pause
  exit /b 0
)

if not exist "backend\.env" copy "backend\.env.example" "backend\.env" >nul
if not exist "backend\node_modules" (
  echo Installing backend packages for the first run...
  pushd backend
  call npm install
  popd
)
start "Shopnest API" cmd /k "cd /d "%~dp0backend" && npm start"
echo Frontend opened. Backend is starting at http://localhost:4000
endlocal

@echo off
cd /d "%~dp0"
echo Lucky Draw: http://localhost:8080
echo Cards: data\cards.json
echo Video: public\draw.mp4
echo Close this window to stop.
start "" /b cmd /c "ping -n 2 127.0.0.1 >nul & start http://localhost:8080"
py -3 -m http.server 8080
if errorlevel 1 python -m http.server 8080
if errorlevel 1 (
  echo Install Python from https://www.python.org/downloads/
  pause
)

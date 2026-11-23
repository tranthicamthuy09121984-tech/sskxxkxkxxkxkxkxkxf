@echo off
title NguyezCodex Launcher
color 0B

echo ================================
echo       NGUYEZCODEX LAUNCHER
echo ================================
echo.

cd /d "%~dp0"

echo [1/3] Kiem tra Node.js...
node -v
if errorlevel 1 goto ERROR

echo.
echo [2/3] Cai dat thu vien...
call npm install
if errorlevel 1 goto ERROR

echo.
echo [2.5] Cai dat thu vien requirements.txt
pip install requirements.txt
if  errorlevel 1 goto ERROR

echo.
echo [3/3] Khoi dong NguyezCodex...
call npm run dev

pause
exit

:ERROR
echo.
echo Co loi xay ra. Hay kiem tra Node.js va package.json.
pause

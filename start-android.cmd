@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
node "%~dp0scripts\android\start-studio.mjs" %*
set "launcher_result=%errorlevel%"
if not "%launcher_result%"=="0" pause
exit /b %launcher_result%

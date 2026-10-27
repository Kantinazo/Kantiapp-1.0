@echo off
chcp 65001 >nul
title Kantinazo - Crear instalador
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Falta Node.js. Instalalo desde https://nodejs.org y volve a abrir este archivo.
  pause & exit /b 1
)
echo Preparando Kantinazo. Puede tardar unos minutos...
call npm install || (echo Fallo la instalacion de dependencias. & pause & exit /b 1)
call npm run dist || (echo Fallo la creacion del instalador. & pause & exit /b 1)
echo.
echo Listo. El instalador esta en la carpeta "dist".
start "" "%~dp0dist"
pause

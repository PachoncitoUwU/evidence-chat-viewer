@echo off
chcp 65001 >nul
title Visor de Evidencia WhatsApp - Iniciador Automático
color 0A
echo ===================================================================
echo   INICIANDO VISOR DE EVIDENCIAS Y PERITAJE DE CHATS DE WHATSAPP
echo ===================================================================
echo.

cd /d "%~dp0"

echo [1/3] Verificando entorno Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no está instalado en este equipo.
    echo Por favor instala Node.js desde https://nodejs.org/ e intenta de nuevo.
    pause
    exit /b 1
)

echo [2/3] Verificando dependencias npm...
if not exist "node_modules" (
    echo Instalando dependencias del proyecto, por favor espera...
    call npm install
)

echo [3/3] Iniciando servidor y abriendo navegador web...
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

echo.
echo ===================================================================
echo   Servidor iniciando en http://localhost:3000
echo   Se abrirá automáticamente el navegador en unos segundos.
echo   Puedes usar el sistema en tu navegador. Presiona Ctrl+C para cerrar.
echo ===================================================================
echo.

call npm run dev
pause

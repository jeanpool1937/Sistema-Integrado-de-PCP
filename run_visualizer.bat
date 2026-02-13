@echo off
echo ===================================================
echo   Iniciando Visualizador SCM - A+I Planning
echo ===================================================
echo.
echo 1. Navegando al directorio del proyecto...
cd frontend_extracted

echo.
echo 2. Instalando dependencias (esto puede tardar unos minutos la primera vez)...
call npm install

echo.
echo 3. Iniciando servidor de desarrollo...
echo    El navegador deberia abrirse o veras un link como http://localhost:5173
echo.
call npm run dev

pause

@echo off
set /p commit_msg="Ingrese el mensaje del commit: "
if "%commit_msg%"=="" (
    echo El mensaje del commit no puede estar vacio.
    pause
    exit /b
)

echo.
echo === Agregando cambios... ===
git add .

echo.
echo === Realizando commit... ===
git commit -m "%commit_msg%"

echo.
echo === Subiendo cambios a GitHub... ===
git push origin main

echo.
echo === Desplegando en GitHub Pages... ===
call npm run deploy

echo.
echo === Proceso finalizado exitosamente ===
pause

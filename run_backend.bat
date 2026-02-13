@echo off
echo ===================================================
echo   Iniciando Backend SCM - Antigravity API
echo ===================================================
echo.
echo 1. Navegando al directorio del backend...
cd backend

echo.
echo 2. Iniciando entorno y dependencias...
echo    Instalando librerias necesarias (esto puede tardar)...
pip install -r requirements.txt

echo.
echo 3. Iniciando servidor FastAPI...
echo    El API estara disponible en http://localhost:8001
echo.
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001

pause

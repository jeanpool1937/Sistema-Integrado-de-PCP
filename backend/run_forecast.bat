@echo off
echo ============================================
echo   Motor de Pronosticos Hibrido - PCP
echo ============================================
cd /d "%~dp0"

echo [1/2] Limpiando datos historicos con IA...
py -3 agents/ai_data_cleaner.py
if %errorlevel% neq 0 (
    echo Error durante la limpieza de datos. Cancelando pronostico.
    pause
    exit /b %errorlevel%
)
echo.

echo [2/2] Generando pronosticos...
py -3 agents/forecast_engine.py
echo.
echo === Ejecucion completada ===
pause

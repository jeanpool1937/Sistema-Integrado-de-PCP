@echo off
echo ============================================================
echo   SYNC MENSUAL - Demanda Proyectada (PO Historico)
echo   Programado para ejecutarse el dia 15 de cada mes
echo ============================================================
cd /d "D:\Base de datos"
py monthly_sync_demanda.py
pause

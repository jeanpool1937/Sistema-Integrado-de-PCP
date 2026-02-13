
import os
from sync_utils import (
    sync_file, 
    sync_production_file, 
    sync_master_data,
    clean_articulos_column_name,
    clean_procesos_column_name,
    clean_centro_column_name,
    clean_almacenes_column_name
)

# Absolute path to the Excel files (in OneDrive)
CONSUMO_FILE_PATH = r"d:/OneDrive - CORPORACIÓN ACEROS AREQUIPA SA/PCP - General/2. CONTROL/ESTADISTICA ANUAL - HISTORICO/Reporte de seguimiento y coberturas/Movimientos/Consumo 2020-2025.xlsx"
PRODUCCION_FILE_PATH = r"d:/OneDrive - CORPORACIÓN ACEROS AREQUIPA SA/PCP - General/2. CONTROL/ESTADISTICA ANUAL - HISTORICO/Reporte de seguimiento y coberturas/Produccion/Reporte de Producción 2020-2025.xlsx"
MAESTRO_FILE_PATH = r"d:/OneDrive - CORPORACIÓN ACEROS AREQUIPA SA/PCP - General/2. CONTROL/COBERTURAS/Maestro de Articulos.xlsx"

if __name__ == "__main__":
    print("--- Syncing Consumo Mensual ---")
    sync_file(CONSUMO_FILE_PATH, is_historical=True)
    
    print("\n--- Syncing Produccion Mensual ---")
    sync_production_file(PRODUCCION_FILE_PATH)

    print("\n--- Syncing Maestro Articulos ---")
    sync_master_data(
        MAESTRO_FILE_PATH, 
        sheet_name='Articulos', 
        table_name='sap_maestro_articulos',
        clean_col_func=clean_articulos_column_name,
        pk_col='codigo'
    )

    print("\n--- Syncing Clase Proceso ---")
    sync_master_data(
        MAESTRO_FILE_PATH, 
        sheet_name='Procesos', 
        table_name='sap_clase_proceso',
        clean_col_func=clean_procesos_column_name,
        pk_col='clase_proceso'
    )

    print("\n--- Syncing Centro Pais ---")
    sync_master_data(
        MAESTRO_FILE_PATH, 
        sheet_name='Centro', 
        table_name='sap_centro_pais',
        clean_col_func=clean_centro_column_name,
        pk_col='centro_id',
        usecols='A:C'
    )

    print("\n--- Syncing Almacenes Comerciales ---")
    sync_master_data(
        MAESTRO_FILE_PATH, 
        sheet_name='Centro', 
        table_name='sap_almacenes_comerciales',
        clean_col_func=clean_almacenes_column_name,
        pk_col='centro',
        usecols='E:H'
    )

import logging
import sys
from sync_utils import (
    sync_master_data,
    clean_articulos_column_name,
    clean_procesos_column_name,
    clean_centro_column_name
)

# Force reset of logging handlers
root = logging.getLogger()
if root.handlers:
    for handler in root.handlers:
        root.removeHandler(handler)

# Configure logging to stdout and file
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s', 
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("verify_log.txt", mode='w')
    ]
)

MAESTRO_FILE_PATH = r"d:/OneDrive - CORPORACIÓN ACEROS AREQUIPA SA/PCP - General/2. CONTROL/COBERTURAS/Maestro de Articulos.xlsx"


if __name__ == "__main__":
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
        pk_col='centro_id'
    )

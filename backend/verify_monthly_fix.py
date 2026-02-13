
from sync_utils import sync_file
import logging
import os

# Setup logging to console
logging.basicConfig(level=logging.INFO)

file_path = r"d:\OneDrive - CORPORACIÓN ACEROS AREQUIPA SA\PCP - General\2. CONTROL\ESTADISTICA ANUAL - HISTORICO\Reporte de seguimiento y coberturas\Movimientos\Consumo 2020-2025.xlsx"

if __name__ == "__main__":
    print("Starting verification (DRY RUN)...")
    sync_file(file_path, is_historical=True, dry_run=True)
    print("Verification complete.")

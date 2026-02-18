import pandas as pd
import os

BASE_PATH = r"D:\OneDrive - CORPORACIÓN ACEROS AREQUIPA SA\PCP - General"
CONSUMO_FILE_PATH = os.path.join(BASE_PATH, r"2. CONTROL\ESTADISTICA ANUAL - HISTORICO\Reporte de seguimiento y coberturas\Movimientos\ConsumoMes.xlsx")
PRODUCCION_FILE_PATH = os.path.join(BASE_PATH, r"2. CONTROL\ESTADISTICA ANUAL - HISTORICO\Reporte de seguimiento y coberturas\Produccion\ProduccionMes.xlsx")

def inspect(file_path):
    print(f"--- Inspecting {os.path.basename(file_path)} ---")
    if not os.path.exists(file_path):
        print("File not found.")
        return
    try:
        df = pd.read_excel(file_path, header=None, nrows=10)
        print("First 10 rows:")
        print(df.to_string())
    except Exception as e:
        print(f"Error reading file: {e}")

if __name__ == "__main__":
    inspect(CONSUMO_FILE_PATH)
    inspect(PRODUCCION_FILE_PATH)

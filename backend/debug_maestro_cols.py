
import pandas as pd
import os

MAESTRO_FILE_PATH = r"d:/OneDrive - CORPORACIÓN ACEROS AREQUIPA SA/PCP - General/2. CONTROL/COBERTURAS/Maestro de Articulos.xlsx"

if os.path.exists(MAESTRO_FILE_PATH):
    try:
        df = pd.read_excel(MAESTRO_FILE_PATH, sheet_name='Articulos', nrows=5)
        print("Columnas encontradas en la hoja 'Articulos':")
        print(df.columns.tolist())
        print("\nPrimeras filas:")
        print(df.head())
    except Exception as e:
        print(f"Error: {e}")
else:
    print("Archivo no encontrado.")

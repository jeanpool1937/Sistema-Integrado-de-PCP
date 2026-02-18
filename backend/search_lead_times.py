
import pandas as pd
import os

MAESTRO_FILE_PATH = r"d:/OneDrive - CORPORACIÓN ACEROS AREQUIPA SA/PCP - General/2. CONTROL/COBERTURAS/Maestro de Articulos.xlsx"

if os.path.exists(MAESTRO_FILE_PATH):
    try:
        df = pd.read_excel(MAESTRO_FILE_PATH, sheet_name='Articulos')
        # Buscar SKUs donde Lead Time sea > 0 o no sea nulo
        llenos = df[df['Lead Time'].notna() & (df['Lead Time'] > 0)]
        print(f"Total de filas con Lead Time > 0: {len(llenos)}")
        if len(llenos) > 0:
            print("\nEjemplos de SKUs con Lead Time:")
            print(llenos[['Cdigo', 'Lead Time']].head(10))
        else:
            print("\nADVERTENCIA: No se encontraron filas con Lead Time > 0 en el Excel.")
    except Exception as e:
        print(f"Error: {e}")
else:
    print("Archivo no encontrado.")

import pandas as pd
import os

FILE_PATH = r"D:/Base de datos/Maestro_Temp.xlsx"

def analyze_master_data():
    if not os.path.exists(FILE_PATH):
        print(f"File not found: {FILE_PATH}")
        return

    # 1. Articulos
    print("--- Tab: Articulos ---")
    try:
        df_art = pd.read_excel(FILE_PATH, sheet_name='Articulos', nrows=5)
        print("Columns:", list(df_art.columns))
        print("Types:\n", df_art.dtypes)
        print("Sample:\n", df_art.iloc[0].to_dict() if not df_art.empty else "Empty")
    except Exception as e:
        print(f"Error reading Articulos: {e}")

    # 2. Procesos
    print("\n--- Tab: Procesos ---")
    try:
        # Looking for header, might be row 2 (index 1) based on image? Image shows row 1 with filters.
        # Let's read a bit more and detect.
        df_proc = pd.read_excel(FILE_PATH, sheet_name='Procesos', nrows=10)
        print("First 5 rows raw:")
        print(df_proc.head(5))
    except Exception as e:
        print(f"Error reading Procesos: {e}")

    # 3. Centro
    print("\n--- Tab: Centro ---")
    try:
        df_cen = pd.read_excel(FILE_PATH, sheet_name='Centro', usecols="A:C", nrows=5)
        print("Columns:", list(df_cen.columns))
        print("Types:\n", df_cen.dtypes)
        print("Sample:\n", df_cen.iloc[0].to_dict() if not df_cen.empty else "Empty")
    except Exception as e:
        print(f"Error reading Centro: {e}")

if __name__ == "__main__":
    analyze_master_data()

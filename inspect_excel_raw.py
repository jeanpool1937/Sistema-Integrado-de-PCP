import pandas as pd
import os

file_path = os.path.join(os.getcwd(), 'Planes Produccion.xlsx')
print(f"Inspecting file: {file_path}")

try:
    with pd.ExcelFile(file_path) as xl:
        print(f"Sheets: {xl.sheet_names}")
        # Try different sheets or the first one
        df = pd.read_excel(file_path, header=None)
        print("\n--- First 10 rows RAW ---")
        print(df.head(10).to_string())
        
        # Check if there is a column that looks like a date
        print("\n--- Columns ---")
        print(df.iloc[0].tolist())
except Exception as e:
    print(f"Error: {e}")

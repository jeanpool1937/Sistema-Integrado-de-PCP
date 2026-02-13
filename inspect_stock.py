import pandas as pd

file_path = r"c:\Users\Avargas\OneDrive - OVERALL\Documentos\Antigravity\Stock Actual_MB52.xlsx"

try:
    df = pd.read_excel(file_path, nrows=5)
    print("Columns found:")
    for col in df.columns:
        print(f"- {col}")
except Exception as e:
    print(f"Error reading file: {e}")

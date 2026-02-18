
import pandas as pd
import os

BASE_PATH = r"D:\OneDrive - CORPORACIÓN ACEROS AREQUIPA SA\PCP - General"
MB52_FILE_PATH = os.path.join(BASE_PATH, r"2. CONTROL\COBERTURAS\MB52.XLSX")

if os.path.exists(MB52_FILE_PATH):
    xls = pd.ExcelFile(MB52_FILE_PATH)
    print(f"Sheets in {MB52_FILE_PATH}: {xls.sheet_names}")
else:
    print("File not found.")

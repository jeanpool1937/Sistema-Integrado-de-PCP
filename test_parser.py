import pandas as pd
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from services.file_parser import parse_stock

# Create a mock Excel file
df_mock = pd.DataFrame({
    'Material': ['400029'],
    'Texto breve de material': ['SKU TEST'],
    'Centro': ['2100'],
    'Almacén': ['2111'],
    'Tipo material': ['FERT'],
    'Unidad medida base': ['KG'],
    'Libre utilización': [451.24],
    'Stock total tons': [451.24],
    'Almacen Valido': ['OK']
})

test_file = "test_stock.xlsx"
df_mock.to_excel(test_file, index=False)

try:
    df_parsed, warnings = parse_stock(test_file)
    print("Parsed columns:", list(df_parsed.columns))
    print("First row data:")
    print(df_parsed.iloc[0].to_dict())
finally:
    if os.path.exists(test_file):
        os.remove(test_file)

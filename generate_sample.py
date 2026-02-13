import pandas as pd
import os

# Define the columns as requested
columns = [
    "Material",
    "Texto breve de material",
    "Centro",
    "Almacén",
    "Tipo material",
    "Unidad medida base",
    "Libre utilización",
    "Trans./Trasl.",
    "Inspecc.de calidad",
    "Stock no libre",
    "Bloqueado",
    "Grupo de artículos",
    "Stock en tránsito",
    "Stock Final Tons",
    "Almacén Válido"
]

# Create some dummy data
data = [
    [
        "300000", "ALAM CORRUG A615 G60 8.00MM X RO", "1000", "AL01", "ROH", "KG", 
        1000, 0, 0, 0, 0, "ACEROS", 0, 15.5, "SI"
    ],
    [
        "300004", "ALAM CORRUG A615 G60 6.00MM X RO", "1000", "AL01", "ROH", "KG", 
        500, 0, 0, 0, 10, "ACEROS", 0, 8.2, "SI"
    ],
    [
        "302313", "BACO A615-G60 1\" X 14M", "1000", "AL02", "FERT", "UND", 
        200, 0, 0, 0, 0, "BARRAS", 0, 25.0, "SI"
    ]
]

# Create DataFrame
df = pd.DataFrame(data, columns=columns)

# Define output path
output_path = r"c:\Users\Avargas\OneDrive - OVERALL\Documentos\Antigravity\Stock_MB52_Ejemplo.xlsx"

# Write to Excel
try:
    df.to_excel(output_path, index=False)
    print(f"File created successfully at: {output_path}")
except Exception as e:
    print(f"Error creating file: {e}")

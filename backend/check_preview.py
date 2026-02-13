from fastapi.testclient import TestClient
from main import app
import os
import io

client = TestClient(app)

file_path = '../DATOS BO DÍA_Antigravity.xlsx'
if not os.path.exists(file_path):
    print("File not found")
    exit(1)

print(f"Testing with file: {file_path}")

try:
    with open(file_path, 'rb') as f:
        # Leemos el archivo en memoria para pasar a TestClient
        file_content = f.read()
        
    response = client.post(
        "/api/preview/movimientos", 
        files={"file": ("filename.xlsx", file_content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    )

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Filename: {data['filename']}")
        print(f"Total Records: {data['total_records']}")
        print(f"Warnings ({len(data['warnings'])}):")
        for w in data['warnings']:
            print(f" - {w}")
        
        if data['data']:
            print(f"Sample Row 1: {data['data'][0]}")
            
            # Verificar tipos de movimiento únicos en la data retornada
            tipos = set(row['tipo_movimiento'] for row in data['data'] if 'tipo_movimiento' in row)
            print(f"Tipos de Movimiento encontrados: {sorted(list(tipos))}")
            if 'TRASPASO' in tipos:
                print("FAIL: TRASPASO encontrado en resultados")
            else:
                print("SUCCESS: TRASPASO correctamente filtrado")
        else:
            print("No data returned")
            
    else:
        print(f"Error Response: {response.text}")

except Exception as e:
    print(f"Exception: {e}")

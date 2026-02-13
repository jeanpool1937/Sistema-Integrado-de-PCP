import requests
import os
import sys
import time

URL = "http://localhost:8000/api/preview/movimientos"
HEALTH_URL = "http://localhost:8000/health"
FILE_PATH = '../DATOS BO DÍA_Antigravity.xlsx'

def check_server():
    try:
        r = requests.get(HEALTH_URL)
        return r.status_code == 200
    except:
        return False

def test_endpoint():
    if not os.path.exists(FILE_PATH):
        print("File not found")
        sys.exit(1)

    print(f"Testing with file: {FILE_PATH}")
    
    with open(FILE_PATH, 'rb') as f:
        try:
            response = requests.post(URL, files={"file": f})
        except Exception as e:
            print(f"Request failed: {e}")
            sys.exit(1)

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Filename: {data['filename']}")
        print(f"Total Records: {data['total_records']}")
        print(f"Warnings ({len(data['warnings'])}):")
        for w in data['warnings']:
            print(f" - {w}")
        
        if data['data']:
            # Verificar tipos de movimiento únicos en la data retornada
            tipos = set(row.get('tipo_movimiento') for row in data['data'])
            print(f"Tipos de Movimiento encontrados: {sorted(list(tipos))}")
            if 'TRASPASO' in tipos:
                print("FAIL: TRASPASO encontrado en resultados")
            else:
                print("SUCCESS: TRASPASO correctamente filtrado")
        else:
            print("No data returned")
    else:
        print(f"Error Response: {response.text}")

if __name__ == "__main__":
    if not check_server():
        print("Server not running. Please start it.")
        sys.exit(1)
    test_endpoint()

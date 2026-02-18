
import requests
import os
import json

SUPABASE_URL = 'https://nvrcsheavwwrcukhtvcw.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52cmNzaGVhdnd3cmN1a2h0dmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MzkyMDUsImV4cCI6MjA4NjMxNTIwNX0.0ndDO1K8c_WnP3FQumSCoWf-XGlBsrBfJXlCNMplGSE'

def get_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

def truncate_table():
    url = f"{SUPABASE_URL}/rest/v1/sap_maestro_articulos"
    params = {"codigo": "neq.0"} # Delete everything where codigo is not 0
    resp = requests.delete(url, headers=get_headers(), params=params)
    if resp.status_code in [200, 204]:
        print("Tabla sap_maestro_articulos truncada con éxito.")
        return True
    else:
        print(f"Error al truncar: {resp.status_code} - {resp.text}")
        return False

if __name__ == "__main__":
    truncate_table()

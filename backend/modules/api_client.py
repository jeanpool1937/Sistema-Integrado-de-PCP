import os
import requests
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def get_headers():
    if not SUPABASE_KEY:
        raise ValueError("SUPABASE_KEY no encontrada en las variables de entorno.")
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal" 
    }

def post_to_supabase(endpoint, payload):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    response = requests.post(url, headers=get_headers(), json=payload)
    response.raise_for_status()
    return response

def patch_to_supabase(endpoint, payload, params):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    response = requests.patch(url, headers=get_headers(), json=payload, params=params)
    response.raise_for_status()
    return response

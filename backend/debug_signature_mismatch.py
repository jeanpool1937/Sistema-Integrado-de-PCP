
import os
import pandas as pd
import logging
from sync_utils import generate_signature, fetch_existing_signatures, get_headers, SUPABASE_URL, normalize_value, cleanup_column_names
import requests
import json

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def debug_mismatch():
    file_path = r"d:\OneDrive - CORPORACIÓN ACEROS AREQUIPA SA\PCP - General\2. CONTROL\ESTADISTICA ANUAL - HISTORICO\Reporte de seguimiento y coberturas\Movimientos\Consumo 2020-2025.xlsx"
    
    # 1. Read Excel to find a candidate
    # Use chunksize or read all if fit in memory (file is large)
    # Filter by specific criteria to find row quickly
    logging.info("Reading Excel...")
    df = pd.read_excel(file_path, header=1)
    df = cleanup_column_names(df)
    
    # Find specific row
    # material_clave: 303076, fecha: 2025-01-01, cl_movimiento: 309
    # fecha in Excel might be string or datetime
    candidate = None
    for _, row in df.iterrows():
        m_clave = str(row['material_clave']).strip()
        cl_mov = str(row['cl_movimiento']).strip()
        fecha = str(row['fecha'])
        
        if m_clave == '303076' and cl_mov == '309' and '2025-01-01' in fecha:
            # Check quantity
            if abs(row['cantidad_final_tn'] - (-0.009645)) < 0.001:
                candidate = row
                break
    
    if candidate is None:
        logging.error("Could not find candidate record in Excel.")
        return

    # Prepare Excel Record
    excel_record = candidate.to_dict()
    # Apply same processing as sync_file
    upload_record = {
        'material_clave': excel_record.get('material_clave'),
        'fecha': excel_record.get('fecha'),
        'cl_movimiento': excel_record.get('cl_movimiento'),
        'centro': excel_record.get('centro'),
        'almacen': excel_record.get('almacen'),
        'cantidad_final_tn': excel_record.get('cantidad_final_tn'),
    }
    
    sig_excel = generate_signature(upload_record)
    logging.info(f"Excel Record Raw: {upload_record}")
    logging.info(f"Excel Signature: {sig_excel}")
    logging.info(f"Normalized Qty: {normalize_value(upload_record['cantidad_final_tn'])}")
    
    # 2. Fetch corresponding record from Supabase by ID (The 'clean' one)
    # ID: d8b1760f-4cc2-4974-9fcc-d86370ec5729
    url = f"{SUPABASE_URL}/rest/v1/sap_consumo_movimientos"
    params = {
        "id": "eq.d8b1760f-4cc2-4974-9fcc-d86370ec5729",
        "select": "*" 
    }
    
    response = requests.get(url, headers=get_headers(), params=params)
    if response.status_code != 200:
        logging.error(f"API Error: {response.text}")
        return
        
    db_records = response.json()
    if not db_records:
        logging.error("DB Record not found by ID. Maybe deleted?")
        return

    db_rec = db_records[0]
    sig_db = generate_signature(db_rec)
    logging.info(f"DB Record Raw: {db_rec}")
    logging.info(f"DB Signature: {sig_db}")
    logging.info(f"DB Qty Raw: {db_rec.get('cantidad_final_tn')}")
    logging.info(f"DB Qty Normalized: {normalize_value(db_rec.get('cantidad_final_tn'))}")
    
    if sig_db == sig_excel:
        logging.info("MATCH FOUND! (Wait, then why duplication?)")
    else:
        logging.info("MISMATCH FOUND!")
        excel_parts = sig_excel.split('|')
        db_parts = sig_db.split('|')
        for i, (e, d) in enumerate(zip(excel_parts, db_parts)):
            if e != d:
                logging.info(f"Diff at index {i}: Excel='{e}' vs DB='{d}'")

if __name__ == "__main__":
    debug_mismatch()

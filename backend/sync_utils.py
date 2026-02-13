
import os
import pandas as pd
import logging
import requests
import json
import time
from datetime import datetime

# Configure logging
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(SCRIPT_DIR, 'sync_log.txt')
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Supabase Credentials
SUPABASE_URL = 'https://nvrcsheavwwrcukhtvcw.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52cmNzaGVhdnd3cmN1a2h0dmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MzkyMDUsImV4cCI6MjA4NjMxNTIwNX0.0ndDO1K8c_WnP3FQumSCoWf-XGlBsrBfJXlCNMplGSE'

def get_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal" 
    }

def cleanup_column_names(df):
    """Clean column names and handle fuzzy matching manually."""
    column_mapping = {
        'Material - Clave': 'material_clave',
        'Material - Texto': 'material_texto',
        'Nueva Unidad Medida': 'unidad_medida',
        'Cl.movimiento': 'cl_movimiento',
        'Tipo2': 'tipo2',
        'Cantidad final tn': 'cantidad_final_tn',
        'Centro': 'centro',
        'Almacen': 'almacen'
    }
    
    # Try to find date column
    date_col = None
    for col in df.columns:
        if 'natural' in col.lower() or 'mes' in col.lower():
            date_col = col
            break
            
    if date_col:
        column_mapping[date_col] = 'fecha'
        
    df = df.rename(columns=column_mapping)
    return df

def parse_date(date_val):
    """Parse dates handling various formats (Excel serial, string DD/MM/YYYY, MM.YYYY)."""
    if pd.isna(date_val):
        return None
        
    str_val = str(date_val).strip()
    
    try:
        # Handle 'MM.YYYY' (Historical) -> 'YYYY-MM-01'
        if '.' in str_val and len(str_val.split('.')) == 2:
            parts = str_val.split('.')
            return f"{parts[1]}-{parts[0]}-01"
            
        # Handle 'DD/MM/YYYY' (Daily) -> 'YYYY-MM-DD'
        if '/' in str_val:
            parts = str_val.split('/')
            if len(parts) == 3:
                return f"{parts[2]}-{parts[1]}-{parts[0]}"
                
        # Handle already formatted YYYY-MM-DD
        if '-' in str_val and len(str_val.split('-')) == 3:
            return str_val
    except Exception:
        return None
    return None

def normalize_value(val):
    """Normalize values for signature: handled str, float, int, None."""
    if pd.isna(val) or val is None or str(val).strip() == "":
        return ""
    
    s_val = str(val).strip()
    
    try:
        f_val = float(s_val)
        # Check if it's effectively an integer
        if f_val.is_integer():
            return str(int(f_val))
        
        # If it's a float, round to 6 decimal places to mask precision errors
        # Format as fixed point string to avoid scientific notation
        # Then strip trailing zeros and decimal point if it becomes integer-like
        formatted = f"{f_val:.6f}".rstrip('0').rstrip('.')
        return formatted
    except ValueError:
        pass
        
    return s_val

def generate_signature(row):
    """Create a unique signature for deduplication."""
    # Normalize date
    fecha_val = row.get('fecha', '')
    if pd.notna(fecha_val) and fecha_val:
        # If it's a pandas Timestamp or datetime object
        if hasattr(fecha_val, 'strftime'):
            fecha_str = fecha_val.strftime('%Y-%m-%d')
        else:
            # If it's a string, try to take the YYYY-MM-DD part
            fecha_str = str(fecha_val).split(' ')[0]
    else:
        fecha_str = ''

    parts = [
        normalize_value(row.get('material_clave')),
        fecha_str, # Already normalized above to specific format
        normalize_value(row.get('cl_movimiento')),
        normalize_value(row.get('centro')),
        normalize_value(row.get('almacen')),
        normalize_value(row.get('cantidad_final_tn'))
    ]
    sig = "|".join(parts)
    return sig

def fetch_existing_signatures(min_date: str):
    """Fetch all existing signatures since min_date using REST API."""
    logging.info(f"Fetching existing records since {min_date}...")
    
    url = f"{SUPABASE_URL}/rest/v1/sap_consumo_movimientos"
    
    # Ensure min_date is string YYYY-MM-DD
    if isinstance(min_date, datetime):
        min_date_str = min_date.strftime('%Y-%m-%d')
    else:
        # If it's a string timestamp 'YYYY-MM-DD HH:MM:SS', take just date
        min_date_str = str(min_date).split(' ')[0]

    all_signatures = set()
    start = 0
    batch_size = 1000
    
    while True:
        try:
            params = {
                "select": "material_clave,fecha,cl_movimiento,centro,almacen,cantidad_final_tn",
                "fecha": f"gte.{min_date_str}"
            }
            headers = get_headers()
            headers["Range"] = f"{start}-{start + batch_size - 1}"
            
            response = requests.get(url, headers=headers, params=params)
            
            if response.status_code != 200:
                logging.error(f"API Error {response.status_code}: {response.text}")
                raise Exception(f"Failed to fetch existing records: {response.text}")
                
            data = response.json()
            if not data:
                break
                
            for record in data:
                all_signatures.add(generate_signature(record))
            
            if len(data) < batch_size:
                break
                
            start += batch_size
            
        except Exception as e:
            logging.error(f"Critical error fetching existing records: {e}")
            raise # Re-raise to stop the sync process instead of assuming 0 records
            
    logging.info(f"Found {len(all_signatures)} existing records in Supabase.")
    return all_signatures

def batch_insert(records):
    """Insert records in batches using REST API."""
    url = f"{SUPABASE_URL}/rest/v1/sap_consumo_movimientos"
    headers = get_headers()
    
    try:
        response = requests.post(url, headers=headers, json=records)
        response.raise_for_status()
        return True
    except Exception as e:
        logging.error(f"Error inserting batch: {e}")
        if hasattr(e, 'response') and e.response is not None:
             logging.error(f"Response: {e.response.text}")
        return False

def sync_file(file_path: str, is_historical: bool = False, dry_run: bool = False):
    process_name = "Monthly Sync" if is_historical else "Daily Sync"
    if dry_run:
        process_name += " (DRY RUN)"
        
    logging.info(f"--- Starting {process_name}: {file_path} ---")
    
    if not os.path.exists(file_path):
        logging.error(f"File not found: {file_path}")
        return

    try:
        # Dynamic header detection
        # Read first few rows to find the header
        df_preview = pd.read_excel(file_path, header=None, nrows=20)
        header_row_index = 0 # Default to 0
        
        for i, row in df_preview.iterrows():
            row_str = " ".join([str(x) for x in row.values]).lower()
            # Look for characteristic column names
            if "material" in row_str and "centro" in row_str:
                header_row_index = i
                logging.info(f"Detected header at row index: {i}")
                break
        
        # Read the file with the detected header
        df = pd.read_excel(file_path, header=header_row_index)
        logging.info(f"Read {len(df)} rows from Excel.")
        
        df = cleanup_column_names(df)
        df['fecha'] = df['fecha'].apply(parse_date)
        
        initial_count = len(df)
        df = df.dropna(subset=['fecha'])
        
        if initial_count != len(df):
            logging.warning(f"Dropped {initial_count - len(df)} rows with invalid dates.")

        SYNC_START_DATE = '2024-01-01'
        df = df[df['fecha'] >= SYNC_START_DATE]
        
        if df.empty:
            logging.info("No rows remaining after date filtering.")
            return

        min_date = df['fecha'].min()
        existing_signatures = fetch_existing_signatures(min_date)
        
        new_rows = []
        for _, row in df.iterrows():
            record = row.to_dict()
            upload_record = {k: v for k, v in record.items() if k in [
                'material_clave', 'material_texto', 'unidad_medida', 'fecha',
                'cl_movimiento', 'tipo2', 'cantidad_final_tn', 'centro', 'almacen'
            ]}
            upload_record['source_file'] = os.path.basename(file_path)
            
            sig = generate_signature(upload_record)
            if sig not in existing_signatures:
                new_rows.append(upload_record)
        
        logging.info(f"Identified {len(new_rows)} new unique records to upload.")
        
        if dry_run:
            logging.info("DRY RUN: Skipping upload.")
            return

        if new_rows:
            batch_size = 1000
            total_uploaded = 0
            for i in range(0, len(new_rows), batch_size):
                batch = new_rows[i:i + batch_size]
                if batch_insert(batch):
                    total_uploaded += len(batch)
                    logging.info(f"Uploaded batch {i // batch_size + 1} ({total_uploaded}/{len(new_rows)})")
                else:
                    logging.error(f"Failed to upload batch {i // batch_size + 1}")
            logging.info(f"Successfully uploaded {total_uploaded} records.")
        else:
            logging.info("Sync complete. No new records found.")

    except Exception as e:
        logging.error(f"Critical error during sync: {e}")
        print(f"Error: {e}")

# --- Logic for SAP Production ---

def clean_production_column_name(col_name):
    # Map Excel headers to DB columns
    # Note: 'clean_column_name' handles Consumo/Movimientos, this is for Production
    mapping = {
        "Fecha de contabilización": "fecha_contabilizacion",
        "Clase de orden - Clave": "clase_orden",
        "Orden - Clave": "orden",
        "Material - Clave": "material",
        "Material - Texto de longitud media": "texto_material",
        "Nueva Unid Med": "unidad_medida",
        "Prod tn.": "cantidad_tn",
        "Creado el": "creado_el"
    }
    
    if col_name in mapping:
        return mapping[col_name]
    
    col_lower = col_name.lower()
    if "fecha" in col_lower and "contabiliza" in col_lower:
        return "fecha_contabilizacion"
    if "clase" in col_lower and "orden" in col_lower:
        return "clase_orden"
    if "orden" in col_lower and "clave" in col_lower:
        return "orden"
    if "material" in col_lower and "clave" in col_lower:
        return "material"
    if "texto" in col_lower and "longitud" in col_lower:
        return "texto_material"
    if "nueva" in col_lower and "med" in col_lower:
        return "unidad_medida"
    if "prod" in col_lower and "tn" in col_lower:
        return "cantidad_tn"
    if "creado" in col_lower:
        return "creado_el"
        
    return None

def generate_production_signature(row):
    """Create a unique signature for production deduplication."""
    # Normalize date
    fecha_val = row.get('fecha_contabilizacion', '')
    if pd.notna(fecha_val) and fecha_val:
        if hasattr(fecha_val, 'strftime'):
            fecha_str = fecha_val.strftime('%Y-%m-%d')
        else:
            # Handle string dates: '2026-02-01T00:00:00' -> '2026-02-01'
            s_val = str(fecha_val)
            if 'T' in s_val:
                fecha_str = s_val.split('T')[0]
            else:
                fecha_str = s_val.split(' ')[0]
    else:
        fecha_str = ''

    parts = [
        normalize_value(row.get('orden')),
        normalize_value(row.get('material')),
        fecha_str,
        normalize_value(row.get('cantidad_tn')),
        normalize_value(row.get('clase_orden'))
    ]
    sig = "|".join(parts)
    return sig

def fetch_existing_production_signatures(min_date: str):
    """Fetch all existing signatures for production since min_date."""
    logging.info(f"Fetching existing production records since {min_date}...")
    
    url = f"{SUPABASE_URL}/rest/v1/sap_produccion"
    
    if isinstance(min_date, datetime):
        min_date_str = min_date.strftime('%Y-%m-%d')
    else:
        min_date_str = str(min_date).split(' ')[0]

    all_signatures = set()
    start = 0
    batch_size = 1000
    
    while True:
        try:
            params = {
                "select": "orden,material,fecha_contabilizacion,cantidad_tn,clase_orden",
                "fecha_contabilizacion": f"gte.{min_date_str}"
            }
            headers = get_headers()
            headers["Range"] = f"{start}-{start + batch_size - 1}"
            
            response = requests.get(url, headers=headers, params=params)
             
            if response.status_code != 200:
                logging.error(f"API Error {response.status_code}: {response.text}")
                break # Break instead of raise to avoid crashing if API hiccups, though could retry
                
            data = response.json()
            if not data:
                break
                
            for record in data:
                all_signatures.add(generate_production_signature(record))
            
            if len(data) < batch_size:
                break
                
            start += batch_size
            
        except Exception as e:
            logging.error(f"Error fetching existing production records: {e}")
            break
            
    logging.info(f"Found {len(all_signatures)} existing production records.")
    return all_signatures

def sync_production_file(file_path: str):
    logging.info(f"--- Starting Production Sync: {file_path} ---")
    
    if not os.path.exists(file_path):
        logging.error(f"File not found: {file_path}")
        return

    try:
        # Dynamic header detection
        df_raw = pd.read_excel(file_path, header=None, nrows=20)
        
        header_row_idx = None
        for idx, row in df_raw.iterrows():
            row_values = [str(x).lower() for x in row.values]
            if any("clase de orden" in x for x in row_values) and any("material" in x for x in row_values):
                header_row_idx = idx
                logging.info(f"Found production header at row {idx}")
                break
        
        if header_row_idx is None:
            logging.error(f"Could not find production header row in {file_path}")
            return

        # Re-read with correct header
        df = pd.read_excel(file_path, header=header_row_idx)
        
        # Renaissance columns
        rename_map = {}
        for col in df.columns:
            new_name = clean_production_column_name(str(col))
            if new_name:
                rename_map[col] = new_name
        
        df = df.rename(columns=rename_map)
        
        # Filter only relevant columns
        valid_columns = [
            "fecha_contabilizacion", "clase_orden", "orden", 
            "material", "texto_material", "unidad_medida", 
            "cantidad_tn", "creado_el"
        ]
        df = df[[c for c in valid_columns if c in df.columns]]
        
        # Clean data
        if 'fecha_contabilizacion' in df.columns:
            df['fecha_contabilizacion'] = df['fecha_contabilizacion'].apply(parse_date)
            df = df.dropna(subset=['fecha_contabilizacion'])
            
        if 'creado_el' in df.columns:
            df['creado_el'] = df['creado_el'].apply(parse_date)
            
        # Convert numeric
        if 'cantidad_tn' in df.columns:
            df['cantidad_tn'] = pd.to_numeric(df['cantidad_tn'], errors='coerce').fillna(0)
            
        # Replace NaN with None for JSON serialization
        df = df.where(pd.notnull(df), None)

        if df.empty:
            logging.info("No records found in file.")
            return

        # Deduplication
        min_date = df['fecha_contabilizacion'].min()
        existing_sigs = fetch_existing_production_signatures(min_date)
            
        new_rows = []
        for _, row in df.iterrows():
            record = row.to_dict()
            # Generate signature for this record
            sig = generate_production_signature(record)
            
            if sig not in existing_sigs:
                new_rows.append(record)
                
        logging.info(f"Identified {len(new_rows)} new unique records to upload (out of {len(df)} total).")
        
        if not new_rows:
             logging.info("Sync complete. No new records found.")
             return

        # Batch insert
        TABLE_NAME_PROD = 'sap_produccion'
        url = f"{SUPABASE_URL}/rest/v1/{TABLE_NAME_PROD}"
        headers = get_headers()
        
        batch_size = 1000
        total_uploaded = 0
        for i in range(0, len(new_rows), batch_size):
            batch = new_rows[i:i + batch_size]
            resp = requests.post(url, headers=headers, json=batch)
            if resp.status_code in [200, 201]:
                total_uploaded += len(batch)
                logging.info(f"Uploaded prod batch {i//batch_size + 1} ({len(batch)})")
            else:
                logging.error(f"Error uploading prod batch {i}: {resp.text}")
        
        logging.info(f"Finished processing {os.path.basename(file_path)}. Total uploaded: {total_uploaded}")
                
    except Exception as e:
        logging.error(f"Failed to process production file {file_path}: {e}")

def clean_articulos_column_name(col_name):
    col_name = str(col_name).strip()
    
    # Robust matching for encoding issues
    if 'digo' in col_name or 'Cdigo' in col_name: return 'codigo'
    if 'Material' in col_name and 'media' in col_name: return 'descripcion_material'
    if 'Nueva Unidad' in col_name: return 'unidad_medida'
    if 'Nivel 1' in col_name: return 'jerarquia_nivel_1'
    if 'Nivel 2' in col_name: return 'jerarquia_nivel_2'
    if 'Nivel 3' in col_name: return 'jerarquia_nivel_3'
    # Must check description before code due to substring
    if 'Grupo de art' in col_name and 'breve' in col_name: return 'grupo_articulos_descripcion'
    if 'Grupo de art' in col_name: return 'grupo_articulos_codigo'
    if 'Tipo de material' in col_name and 'media' in col_name: return 'tipo_material_descripcion'
    if 'Tipo de material' in col_name: return 'tipo_material'
    if 'ABC' in col_name: return 'abc'
    if 'Clase' in col_name: return 'clase'
    if 'Agrupacion' in col_name: return 'agrupacion_comercial'
    if 'Largo' in col_name: return 'largo'
    if 'Stock' in col_name: return 'stock_seguridad'
    if 'Lead' in col_name: return 'lead_time'
             
    # Fallback cleanup
    return col_name.lower().replace(' ', '_').replace('.', '').replace('(', '').replace(')', '')

def clean_procesos_column_name(col_name):
    col_name = str(col_name).strip()
    mapping = {
        'CLASE PROCESO': 'clase_proceso',
        'PROCESO': 'descripcion_proceso',
        'AREA': 'area',
        'PLAN INICIAL': 'plan_inicial',
        'Centro': 'centro'
    }
    return mapping.get(col_name, col_name.lower().replace(' ', '_'))

def clean_centro_column_name(col_name):
    col_name = str(col_name).strip()
    mapping = {
        'Centro': 'centro_id',
        'Descripcion': 'descripcion',
        'Pais': 'pais'
    }
    return mapping.get(col_name, col_name.lower().replace(' ', '_'))

def clean_almacenes_column_name(col_name):
    col_name = str(col_name).strip()
    # Robust matching for encoding issues (Almacén, Denominación)
    if col_name.startswith('Centro'): return 'centro'
    if 'lmac' in col_name and 'Denominac' not in col_name and 'denominac' not in col_name: return 'almacen_id'
    if 'Denominac' in col_name or 'denominac' in col_name: return 'descripcion'
    if 'STATUS' in col_name or 'status' in col_name: return 'status'
    return col_name.lower().replace(' ', '_').replace('.', '')

def sync_master_data(file_path, sheet_name, table_name, clean_col_func, pk_col, usecols=None):
    logging.info(f"--- Starting Sync for {table_name} from {sheet_name} ---")
    
    if not os.path.exists(file_path):
        logging.error(f"File not found: {file_path}")
        return

    temp_file_path = None
    try:
        read_kwargs = {'sheet_name': sheet_name}
        if usecols:
            read_kwargs['usecols'] = usecols
        try:
            df = pd.read_excel(file_path, **read_kwargs)
        except PermissionError:
            logging.warning(f"Permission denied for {file_path}. Attempting to copy to temp file...")
            import shutil
            import tempfile
            
            temp_dir = tempfile.gettempdir()
            temp_file_path = os.path.join(temp_dir, f"temp_{os.path.basename(file_path)}")
            shutil.copy2(file_path, temp_file_path)
            
            df = pd.read_excel(temp_file_path, **read_kwargs)
        
        # Renaissance columns
        rename_map = {}
        for col in df.columns:
            new_name = clean_col_func(str(col))
            if new_name:
                rename_map[col] = new_name
        
        df = df.rename(columns=rename_map)
        
        # Deduplicate columns
        df = df.loc[:, ~df.columns.duplicated()]

        # Filter required columns
        if 'SKU ID' not in df.columns or 'Mes' not in df.columns or 'Cantidad' not in df.columns:
            logging.error(f"Missing columns in PO Historico. Found: {df.columns.tolist()}")
            return
            
        # Filter rows without PK
        if pk_col in df.columns:
             df = df.dropna(subset=[pk_col])
             
        # Clean numeric
        for col in df.columns:
             if 'stock' in col or 'lead' in col or 'plan' in col:
                  df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        
        # Clean text
        df = df.astype(object)
        df = df.where(pd.notnull(df), None)
        
        records = df.to_dict(orient='records')
        logging.info(f"Prepared {len(records)} records for {table_name}.")
        
        if not records:
             return

        # Upsert logic
        url = f"{SUPABASE_URL}/rest/v1/{table_name}"
        headers = get_headers()
        headers["Prefer"] = "resolution=merge-duplicates" 
        
        batch_size = 1000
        total_uploaded = 0
        
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            resp = requests.post(url, headers=headers, json=batch)
            if resp.status_code in [200, 201]:
                total_uploaded += len(batch)
                logging.info(f"Upserted batch {i//batch_size + 1} for {table_name} ({len(batch)})")
            else:
                logging.error(f"Error upserting batch {i} for {table_name}: {resp.text}")
                
        logging.info(f"Finished processing {table_name}. Total processed: {total_uploaded}")

    except Exception as e:
        logging.error(f"Failed to process {table_name}: {e}")
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except:
                pass

# --- Logic for SAP Stock MB52 ---

def clean_mb52_column_name(col_name):
    col_name = str(col_name).strip()
    # Robust matching for encoding issues
    if col_name == 'Material': return 'material'
    if 'Texto breve' in col_name: return 'texto_material'
    if col_name == 'Centro': return 'centro'
    if 'lmac' in col_name: return 'almacen'
    if 'Tipo material' in col_name: return 'tipo_material'
    if 'Unidad medida' in col_name: return 'unidad_medida'
    if 'Libre utilizac' in col_name or 'Libre' in col_name: return 'libre_utilizacion'
    if 'Trans' in col_name and 'Trasl' in col_name: return 'transito_traslado'
    if 'Inspecc' in col_name: return 'inspeccion_calidad'
    if 'Stock no libre' in col_name or 'no libre' in col_name: return 'stock_no_libre'
    if 'Bloqueado' in col_name: return 'bloqueado'
    if 'Grupo de art' in col_name: return 'grupo_articulos'
    if 'Stock en tr' in col_name: return 'stock_en_transito'
    return col_name.lower().replace(' ', '_').replace('.', '').replace('/', '_')

def sync_stock_mb52(file_path: str):
    """Sync MB52 stock snapshot. Truncates and replaces all data each run."""
    logging.info(f"--- Starting Stock MB52 Sync: {file_path} ---")
    
    if not os.path.exists(file_path):
        logging.error(f"File not found: {file_path}")
        return

    temp_file_path = None
    try:
        try:
            df = pd.read_excel(file_path)
        except PermissionError:
            logging.warning(f"Permission denied for {file_path}. Copying to temp...")
            import shutil
            import tempfile
            temp_dir = tempfile.gettempdir()
            temp_file_path = os.path.join(temp_dir, f"temp_{os.path.basename(file_path)}")
            shutil.copy2(file_path, temp_file_path)
            df = pd.read_excel(temp_file_path)
        
        # Rename columns
        rename_map = {}
        for col in df.columns:
            new_name = clean_mb52_column_name(str(col))
            if new_name:
                rename_map[col] = new_name
        df = df.rename(columns=rename_map)
        df = df.loc[:, ~df.columns.duplicated()]
        
        # Keep only valid columns
        valid_cols = [
            'material', 'texto_material', 'centro', 'almacen', 'tipo_material',
            'unidad_medida', 'libre_utilizacion', 'transito_traslado',
            'inspeccion_calidad', 'stock_no_libre', 'bloqueado',
            'grupo_articulos', 'stock_en_transito'
        ]
        df = df[[c for c in valid_cols if c in df.columns]]
        
        # Convert types
        numeric_cols = ['libre_utilizacion', 'transito_traslado', 'inspeccion_calidad',
                        'stock_no_libre', 'bloqueado', 'stock_en_transito']
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        
        # Convert material and grupo_articulos to string
        for col in ['material', 'centro', 'almacen', 'grupo_articulos']:
            if col in df.columns:
                df[col] = df[col].apply(lambda x: str(int(x)) if pd.notna(x) and isinstance(x, (int, float)) else (str(x) if pd.notna(x) else None))
        
        df = df.astype(object)
        df = df.where(pd.notnull(df), None)
        
        records = df.to_dict(orient='records')
        logging.info(f"Prepared {len(records)} records for sap_stock_mb52.")
        
        if not records:
            return
        
        # Step 1: Truncate existing data
        url_delete = f"{SUPABASE_URL}/rest/v1/sap_stock_mb52"
        headers = get_headers()
        # Delete all records (id > 0 matches everything)
        resp_del = requests.delete(url_delete, headers=headers, params={"id": "gt.0"})
        if resp_del.status_code in [200, 204]:
            logging.info("Truncated sap_stock_mb52 successfully.")
        else:
            logging.error(f"Error truncating sap_stock_mb52: {resp_del.text}")
            return
        
        # Step 2: Insert all new records
        url_insert = f"{SUPABASE_URL}/rest/v1/sap_stock_mb52"
        headers_insert = get_headers()
        
        batch_size = 1000
        total_uploaded = 0
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            resp = requests.post(url_insert, headers=headers_insert, json=batch)
            if resp.status_code in [200, 201]:
                total_uploaded += len(batch)
                logging.info(f"Uploaded MB52 batch {i//batch_size + 1} ({len(batch)})")
            else:
                logging.error(f"Error uploading MB52 batch {i}: {resp.text}")
        
        logging.info(f"Finished MB52 sync. Total uploaded: {total_uploaded}")
        
    except Exception as e:
        logging.error(f"Failed to process MB52: {e}")
    finally:
            try:
                os.remove(temp_file_path)
            except:
                pass


# ============================================================
# Sync Demanda Proyectada (PO Histórico.xlsx → sap_demanda_proyectada)
# ============================================================

def clean_demanda_column_name(col_name):
    """Normaliza los nombres de columna del PO Histórico para mapearlos."""
    col_lower = col_name.strip().lower()
    mapping = {
        'sku id': 'sku',
        'skuid': 'sku',
        'sku': 'sku',
        'mes': 'mes',
        'cantidad': 'cantidad_val',
        'descripcion': 'descripcion',
        'descripción': 'descripcion',
        'org': 'org',
        'mdo': 'mdc',
        'mdc': 'mdc',
        'pas': 'pais',
        'pais': 'pais',
        'país': 'pais',
        'j1': 'j1',
        'product group': 'product_group',
        'observaciones': 'observaciones',
    }
    return mapping.get(col_lower, col_lower)


def sync_demanda_proyectada(file_path: str):
    """
    Sincroniza la demanda proyectada desde PO Histórico.xlsx a Supabase.
    Lee la demanda mensual, filtra mes actual + próximo, y sube a sap_demanda_proyectada.
    Estrategia: TRUNCATE + RELOAD completo.
    """
    import shutil
    import tempfile
    
    logging.info(f"Starting sync_demanda_proyectada from: {file_path}")
    
    if not os.path.exists(file_path):
        logging.error(f"Demanda file not found: {file_path}")
        print(f"ERROR: File not found: {file_path}")
        return
    
    # Copiar archivo a temp para evitar lock de Excel
    temp_dir = tempfile.mkdtemp()
    temp_file = os.path.join(temp_dir, "po_historico_temp.xlsx")
    
    try:
        shutil.copy2(file_path, temp_file)
        logging.info(f"Copied file to temp: {temp_file}")
        
        # Leer Excel
        df = pd.read_excel(temp_file, engine='openpyxl')
        logging.info(f"Read {len(df)} rows, columns: {df.columns.tolist()}")
        print(f"Read {len(df)} rows from PO Histórico")
        print(f"Original columns: {df.columns.tolist()}")
        
        # Normalizar nombres de columnas
        df.columns = [clean_demanda_column_name(c) for c in df.columns]
        logging.info(f"Normalized columns: {df.columns.tolist()}")
        print(f"Normalized columns: {df.columns.tolist()}")
        
        # Validar columnas requeridas
        required = ['sku', 'mes', 'cantidad_val']
        missing = [c for c in required if c not in df.columns]
        if missing:
            logging.error(f"Missing required columns: {missing}")
            print(f"ERROR: Missing columns: {missing}")
            return
        
        # Parsear y filtrar fechas
        # La columna 'mes' puede ser datetime, string, o número
        def parse_mes(val):
            if pd.isna(val):
                return None
            if isinstance(val, datetime):
                return val.replace(day=1)
            try:
                # Intentar parsear como string
                dt = pd.to_datetime(val, errors='coerce')
                if pd.notna(dt):
                    return dt.replace(day=1)
            except:
                pass
            return None
        
        df['mes_parsed'] = df['mes'].apply(parse_mes)
        
        # Eliminar filas sin fecha válida
        before_count = len(df)
        df = df.dropna(subset=['mes_parsed'])
        after_count = len(df)
        logging.info(f"Date filtering: {before_count} -> {after_count} rows (removed {before_count - after_count} without valid date)")
        print(f"Valid dates: {after_count}/{before_count} rows")
        
        # Filtrar: mantener mes actual + próximo mes
        now = datetime.now()
        current_month_start = datetime(now.year, now.month, 1)
        if now.month == 12:
            next_month_start = datetime(now.year + 1, 1, 1)
            month_after_next = datetime(now.year + 1, 2, 1)
        else:
            next_month_start = datetime(now.year, now.month + 1, 1)
            if now.month + 1 == 12:
                month_after_next = datetime(now.year + 1, 1, 1)
            else:
                month_after_next = datetime(now.year, now.month + 2, 1)
        
        df_filtered = df[
            (df['mes_parsed'] >= current_month_start) & 
            (df['mes_parsed'] < month_after_next)
        ].copy()
        
        logging.info(f"After date filter (current + next month): {len(df_filtered)} rows")
        print(f"Filtered to current+next month: {len(df_filtered)} rows")
        
        if df_filtered.empty:
            logging.warning("No records match the date filter. Nothing to sync.")
            print("WARNING: No records for current/next month found.")
            return
        
        # Preparar registros para Supabase
        df_filtered['fecha_str'] = df_filtered['mes_parsed'].apply(lambda x: x.strftime('%Y-%m-%d'))
        
        # Limpiar NaN/NaT → None
        records_raw = df_filtered.to_dict(orient='records')
        records = []
        for r in records_raw:
            clean_r = {}
            for k, v in r.items():
                if pd.notna(v) if not isinstance(v, str) else True:
                    clean_r[k] = v
                else:
                    clean_r[k] = None
            records.append(clean_r)
        
        logging.info(f"Prepared {len(records)} clean records for upload.")
        
        # Mapear a esquema de DB
        db_records = []
        for r in records:
            sku_val = r.get('sku')
            if sku_val is None:
                continue
            # Convertir SKU a string limpio
            sku_str = str(int(sku_val)) if isinstance(sku_val, float) and not pd.isna(sku_val) else str(sku_val)
            
            cantidad = r.get('cantidad_val', 0)
            if cantidad is None or (isinstance(cantidad, float) and pd.isna(cantidad)):
                cantidad = 0
            
            db_records.append({
                "sku_id": sku_str.strip(),
                "sku_descripcion": str(r.get('descripcion', '')) if r.get('descripcion') else None,
                "mes": r['fecha_str'],
                "cantidad": float(cantidad),
                "org": str(r.get('org', '')) if r.get('org') else None,
                "mdc": str(r.get('mdc', '')) if r.get('mdc') else None,
                "pais": str(r.get('pais', '')) if r.get('pais') else None,
                "j1": str(r.get('j1', '')) if r.get('j1') else None,
                "product_group": str(r.get('product_group', '')) if r.get('product_group') else None,
                "observaciones": str(r.get('observaciones', '')) if r.get('observaciones') else None,
            })
        
        logging.info(f"Mapped {len(db_records)} records to DB schema.")
        print(f"DB records prepared: {len(db_records)}")
        
        if not db_records:
            return
        
        headers = get_headers()
        
        # Step 1: Truncate (delete all)
        url_delete = f"{SUPABASE_URL}/rest/v1/sap_demanda_proyectada"
        resp_del = requests.delete(url_delete, headers=headers, params={"id": "gt.0"})
        if resp_del.status_code in [200, 204]:
            logging.info("Truncated sap_demanda_proyectada successfully.")
            print("Truncated existing data.")
        else:
            logging.error(f"Error truncating: {resp_del.text}")
            print(f"ERROR truncating: {resp_del.text}")
            return
        
        # Step 2: Insert in batches
        url_insert = f"{SUPABASE_URL}/rest/v1/sap_demanda_proyectada"
        batch_size = 1000
        total_uploaded = 0
        
        for i in range(0, len(db_records), batch_size):
            batch = db_records[i:i + batch_size]
            resp = requests.post(url_insert, headers=headers, json=batch)
            if resp.status_code in [200, 201]:
                total_uploaded += len(batch)
                logging.info(f"Uploaded demanda batch {i//batch_size + 1} ({len(batch)} records)")
                print(f"  Batch {i//batch_size + 1}: {len(batch)} records OK")
            else:
                logging.error(f"Error uploading demanda batch {i}: {resp.text}")
                print(f"  ERROR batch {i//batch_size + 1}: {resp.text[:200]}")
        
        logging.info(f"Finished demanda sync. Total uploaded: {total_uploaded}")
        print(f"Demanda sync complete. Total: {total_uploaded} records.")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        logging.error(f"Failed sync_demanda_proyectada: {e}")
        print(f"ERROR: {e}")
    finally:
        try:
            os.remove(temp_file)
            os.rmdir(temp_dir)
        except:
            pass


# ============================================================
# Sync Programa Producción (Planes 2025.xlsm → sap_programa_produccion)
# ============================================================

def clean_programa_produccion_column(col_name):
    """Normaliza columnas de Planes 2025.xlsm - Pestaña BASE DATOS"""
    c = str(col_name).strip().upper()
    if 'FECHA' in c: return 'fecha'
    if 'ORDEN' in c and 'PROCESO' in c: return 'orden_proceso'
    if 'SKU' in c and 'CONSUMO' not in c: return 'sku_produccion' # Col C originally just SKU
    if 'DESCRIPCION' in c: return 'sku_consumo' # Col D Labelled DESCRIPCION but user says it is SKU Consumo
    if 'PROGRAMADO' in c: return 'cantidad_programada'
    if 'CLASE' in c and 'PROCESO' in c: return 'clase_proceso'
    return c.lower().replace(' ', '_')

def sync_programa_produccion(file_path: str):
    """
    Sincroniza el programa de producción desde 'Planes 2025.xlsm' (Hoja: BASE DATOS).
    Estrategia: Full Replace (Truncate & Insert) o Upsert por rango de fecha.
    Dado que es un plan mensual que cambia, Truncate es más limpio si solo es mes vigente.
    User request: "solo del mes vigente".
    """
    logging.info(f"--- Starting Sync Programa Producción: {file_path} ---")
    
    if not os.path.exists(file_path):
        logging.error(f"File not found: {file_path}")
        return

    import shutil
    import tempfile
    
    temp_file_path = None
    try:
        # Copiar a temp para evitar bloqueos de archivo abierto
        temp_dir = tempfile.gettempdir()
        temp_file_path = os.path.join(temp_dir, f"temp_prog_{os.path.basename(file_path)}")
        try:
            shutil.copy2(file_path, temp_file_path)
            read_path = temp_file_path
        except Exception as e:
            logging.warning(f"Could not copy file to temp, trying direct read: {e}")
            read_path = file_path

        # Leer Excel - Hoja 'BASE DATOS' - Cols A:F
        # A: Fecha, B: Orden, C: SKU Prod, D: SKU Consumo (Desc), E: Cantidad, F: Clase Proceso
        try:
            df = pd.read_excel(read_path, sheet_name='BASE DATOS', usecols="A:F")
        except ValueError as ve:
             # Fallback if sheet name differs
             logging.warning(f"Sheet 'BASE DATOS' not found, trying first sheet. Error: {ve}")
             df = pd.read_excel(read_path, sheet_name=0, usecols="A:F")

        # Renombrar columnas dinámicamente
        rename_map = {}
        for col in df.columns:
            new_name = clean_programa_produccion_column(col)
            # Fix manual mapping logic based on user instruction if cleaner failed logic
            # Col 3 (index 2) -> SKU Produccion
            # Col 4 (index 3) -> SKU Consumo
            rename_map[col] = new_name
        
        df = df.rename(columns=rename_map)
        
        # Mapping explicito por posición si los nombres varian
        # A veces es mejor asegurar por posición si el formato es fijo A:F
        if len(df.columns) >= 6:
            # Asumiendo orden A,B,C,D,E,F
            cols = df.columns.tolist()
            # Si clean_column no funcionó como se espera, forzamos:
            if 'sku_produccion' not in cols:
                # Intentar deducir por posición
                # A=Fecha, B=Orden, C=SKU_Prod, D=SKU_Cons, E=Cant, F=Clase
                mapping_pos = {
                    cols[0]: 'fecha',
                    cols[1]: 'orden_proceso',
                    cols[2]: 'sku_produccion',
                    cols[3]: 'sku_consumo',
                    cols[4]: 'cantidad_programada',
                    cols[5]: 'clase_proceso'
                }
                df = df.rename(columns=mapping_pos)

        logging.info(f"Columns after rename: {df.columns.tolist()}")

        # Validar columnas críticas
        required = ['fecha', 'sku_produccion', 'cantidad_programada']
        if not all(col in df.columns for col in required):
            logging.error(f"Missing required columns in Programa Produccion. Found: {df.columns.tolist()}")
            return

        # Limpieza de Datos
        # 1. Fecha
        df['fecha'] = df['fecha'].apply(parse_date)
        df = df.dropna(subset=['fecha'])
        
        # 2. Cantidad Programada -> Numeric, Coerce errors to NaN then 0
        df['cantidad_programada'] = pd.to_numeric(df['cantidad_programada'], errors='coerce').fillna(0)
        
        # 3. Eliminar Filas Erróneas
        # "elimina filas nulas o cero de las columnas SKU a producir y Cantidad programada"
        # Logic: Drop if SKU_Prod is Null/Empty OR Qty is 0
        
        # Ensure SKU Prod is string
        df['sku_produccion'] = df['sku_produccion'].fillna('').astype(str).str.strip()
        
        # Filter
        # Keep rows where SKU Prod is NOT empty AND Qty != 0
        initial_len = len(df)
        df = df[ (df['sku_produccion'] != '') & (df['sku_produccion'] != '0') & (df['sku_produccion'] != 'nan') ]
        df = df[ df['cantidad_programada'] != 0 ]
        
        dropped = initial_len - len(df)
        if dropped > 0:
            logging.info(f"Dropped {dropped} rows due to missing SKU or zero quantity.")

        # 4. Rellenar otros nulos
        # "en caso de nulos tomar como 0" para el resto
        fill_cols = ['sku_consumo', 'orden_proceso']
        for c in fill_cols:
            if c in df.columns:
                df[c] = df[c].fillna('0').astype(str).str.strip().replace({'nan': '0', '': '0'})
        
        if 'clase_proceso' in df.columns:
            df['clase_proceso'] = df['clase_proceso'].fillna('').astype(str)

        # Prepare for Upload
        df = df.astype(object)
        df = df.where(pd.notnull(df), None)
        
        records = df.to_dict(orient='records')
        
        if not records:
            logging.info("No valid records found for Programa Produccion.")
            return

        logging.info(f"Prepared {len(records)} records for sap_programa_produccion.")

        # Upload Strategy: Truncate local month? or Truncate All?
        # User says "archivo contiene... solo del mes vigente". 
        # So we should probably Replace All to ensure sync matches file exactly.
        
        TABLE = 'sap_programa_produccion'
        url_base = f"{SUPABASE_URL}/rest/v1/{TABLE}"
        headers = get_headers()
        
        # Truncate
        try:
            requests.delete(url_base, headers=headers, params={"id": "gt.0"})
            logging.info(f"Truncated {TABLE}.")
        except Exception as e:
            logging.error(f"Error truncating {TABLE}: {e}")
            return

        # Insert Batch
        batch_size = 1000
        total_uploaded = 0
        
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            resp = requests.post(url_base, headers=headers, json=batch)
            if resp.status_code in [200, 201]:
                total_uploaded += len(batch)
                logging.info(f"Uploaded batch {i//batch_size + 1} ({len(batch)})")
            else:
                logging.error(f"Error uploading batch {i}: {resp.text}")

        logging.info(f"Sync Programa Produccion Complete. Total: {total_uploaded}")

    except Exception as e:
        logging.error(f"Critical error in sync_programa_produccion: {e}")
        import traceback
        logging.error(traceback.format_exc())
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except:
                pass

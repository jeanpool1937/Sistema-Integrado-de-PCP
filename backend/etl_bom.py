import os
import pandas as pd
import logging
import requests
import json
from modules.api_client import get_headers, post_to_supabase, SUPABASE_URL

# Configure logging
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(SCRIPT_DIR, 'sync_log.txt')
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

def clean_bom_column(col_name):
    return col_name.strip().lower().replace(" ", "_").replace(".", "")

def sync_bom_file(file_path: str):
    logging.info(f"--- Starting BOM Sync: {file_path} ---")
    
    # Create temp copy to avoid file lock - using shell copy as it is more robust to locks
    temp_path = "temp_bom_etl.xlsx"
    try:
        import subprocess
        # Windows copy command
        cmd = f'copy "{file_path}" "{temp_path}"'
        subprocess.run(cmd, shell=True, check=True)
    except Exception as e:
        logging.error(f"Failed to copy file: {e}")
        return

    try:
        df = pd.read_excel(temp_path)
        
        # Normalize columns
        df.columns = [clean_bom_column(c) for c in df.columns]
        
        # Expected columns mapping or verification
        # Actual: pt_sku, pt_description, parent_sku, parent_description, component_sku, component_description, level, ratio_mp_to_parent, total_ratio_to_pt
        
        records = []
        for _, row in df.iterrows():
            r = row.to_dict()
            cleaned = {}
            for k, v in r.items():
                if pd.isna(v):
                    cleaned[k] = None
                else:
                    cleaned[k] = v
            records.append(cleaned)

        if not records:
            logging.info("No records found in BOM file.")
            return

        logging.info(f"Prepared {len(records)} records for sap_bom_multinivel.")

        # Truncate table
        del_url = f"{SUPABASE_URL}/rest/v1/sap_bom_multinivel"
        resp = requests.delete(del_url, headers=get_headers(), params={"pt_sku": "neq.null"}) 
        # Note: "neq.null" is a trick to delete all rows if no ID column. 
        # Alternatively check if table has primary key. If not, delete all might be tricky with standard PostgREST if no allow_all is on.
        # But for now assuming we can delete.
        
        if resp.status_code not in [200, 204]:
             logging.warning(f"Truncate failed or returned {resp.status_code}. Response: {resp.text}")
        else:
             logging.info("Truncated sap_bom_multinivel successfully.")

        # Upload in batches
        batch_size = 1000
        for i in range(0, len(records), batch_size):
            batch = records[i:i+batch_size]
            try:
                post_to_supabase("sap_bom_multinivel", batch)
            except Exception as e:
                logging.error(f"Error uploading BOM batch {i}: {e}")
        
        logging.info(f"Finished BOM sync. Total: {len(records)}")

    except Exception as e:
        logging.error(f"Error in sync_bom_file: {e}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    # For testing/manual run
    file_path = r"D:\OneDrive - CORPORACIÓN ACEROS AREQUIPA SA\PCP - General\2. CONTROL\ESTADISTICA ANUAL - HISTORICO\Reporte de seguimiento y coberturas\BOM multinivel.xlsx"
    sync_bom_file(file_path)

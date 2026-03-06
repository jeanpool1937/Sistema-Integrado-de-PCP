"""
ai_data_cleaner.py
Motor de Limpieza de Datos Históricos con IA y Métodos Estadísticos.
Detecta outliers (picos irreales) e imputa ceros anómalos (quiebres de stock)
para generar una demanda "limpia" que alimentará el motor de pronósticos.

Ejecución: py -3 backend/agents/ai_data_cleaner.py
"""

import os
import sys
import math
import logging
import requests
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# --- Path setup ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
sys.path.insert(0, BACKEND_DIR)

from modules.api_client import get_headers, SUPABASE_URL, post_to_supabase
from sync_logger import log_sync_result

# --- Logging ---
LOG_FILE = os.path.join(SCRIPT_DIR, 'ai_data_cleaner_log.txt')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler()
    ]
)

BATCH_SIZE = 1000

def fetch_all_paginated(table, params=None, select='*'):
    if params is None:
        params = {}
    params['select'] = select
    all_data = []
    start, batch_size = 0, 1000
    while True:
        headers = get_headers()
        headers["Range"] = f"{start}-{start + batch_size - 1}"
        url = f"{SUPABASE_URL}/rest/v1/{table}"
        try:
            resp = requests.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()
            if not data:
                break
            all_data.extend(data)
            if len(data) < batch_size:
                break
            start += batch_size
        except Exception as e:
            logging.error(f"Error descargando {table}: {e}")
            break
    return pd.DataFrame(all_data) if all_data else pd.DataFrame()

def process_sku_timeseries(df_sku, sku_id):
    """
    Toma un DataFrame con la serie diaria de un SKU y la limpia.
    df_sku tiene: fecha, cantidad_total_tn
    """
    # 1. Asegurar serie continua (filling missing dates with 0)
    df_sku['fecha'] = pd.to_datetime(df_sku['fecha'])
    df_sku.set_index('fecha', inplace=True)
    df_sku = df_sku.sort_index()

    # Si no hay datos suficientes, devolvemos tal cual
    if len(df_sku) < 5:
        df_sku = df_sku.reset_index()
        df_sku['cantidad_limpia'] = df_sku['cantidad_total_tn']
        df_sku['es_outlier'] = False
        df_sku['es_quiebre_stock'] = False
        df_sku['metodo_limpieza'] = 'none'
        return df_sku

    # Rellenar fechas faltantes en el rango
    full_idx = pd.date_range(start=df_sku.index.min(), end=df_sku.index.max(), freq='D')
    df_full = df_sku.reindex(full_idx).reset_index()
    df_full.rename(columns={'index': 'fecha'}, inplace=True)
    df_full['cantidad_total_tn'] = df_full['cantidad_total_tn'].fillna(0.0)
    df_full['sku_id'] = sku_id
    
    # Trabajar con la serie original
    orig = df_full['cantidad_total_tn'].values
    limpia = np.copy(orig)
    n = len(orig)

    es_outlier = np.zeros(n, dtype=bool)
    es_quiebre = np.zeros(n, dtype=bool)
    metodos = [''] * n

    # --- 1er PASO: DETECCIÓN DE OUTLIERS ---
    # Consideramos solo valores no cero para calcular el percentil y mean/std
    non_zeros = orig[orig > 0]
    if len(non_zeros) >= 3:
        p95 = np.percentile(non_zeros, 95)
        mean_nz = np.mean(non_zeros)
        std_nz = np.std(non_zeros)
        
        for i in range(n):
            if orig[i] > p95 and std_nz > 0:
                z_score = (orig[i] - mean_nz) / std_nz
                if z_score > 2.0:  # Umbral Z-Score
                    limpia[i] = p95 # Winsorization al P95
                    es_outlier[i] = True
                    metodos[i] = 'winsorized_p95'

    # --- 2do PASO: DETECCIÓN DE SILENCIOS / QUIEBRES DE STOCK (Básico) ---
    # Imputar ceros anómalos en productos de movimiento "denso"
    # Usamos rolling mean, si hay un '0' rodeado de valores altos, lo imputamos por el avg reciente.
    rolling_window = 7
    for i in range(n):
        if orig[i] == 0:
            start_i = max(0, i - rolling_window)
            end_i = min(n, i + rolling_window + 1)
            window_vals = limpia[start_i:end_i]
            # Si en la ventana hay más de 50% de ceros, es intermitente (no se imputa)
            # Si la ventana tiene mucha actividad y de pronto hay un 0, podría ser quiebre.
            non_zero_count = np.count_nonzero(window_vals)
            if non_zero_count >= (len(window_vals) * 0.7):
                imputed_val = np.mean(window_vals[window_vals > 0])
                limpia[i] = imputed_val
                es_quiebre[i] = True
                metodos[i] = 'imputed_rolling_mean'

    df_full['cantidad_limpia'] = limpia
    df_full['es_outlier'] = es_outlier
    df_full['es_quiebre_stock'] = es_quiebre
    df_full['metodo_limpieza'] = metodos
    
    return df_full

def clean_data():
    logging.info("Iniciando AI Data Cleaner...")
    start_time = datetime.now()

    # 1. Obtener la data cruda (últimos 365 días como máximo para reducir carga, o 90 si se desea)
    one_year_ago = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
    logging.info(f"Descargando sap_consumo_diario_resumen desde {one_year_ago}...")
    df_raw = fetch_all_paginated(
        'sap_consumo_diario_resumen',
        {'fecha': f'gte.{one_year_ago}'},
        'sku_id,fecha,cantidad_total_tn'
    )
    
    if df_raw.empty:
        logging.warning("No hay datos crudos para limpiar.")
        return 0

    logging.info(f"Total registros crudos: {len(df_raw)}")
    
    # Limpieza por SKU
    all_clean_records = []
    skus = df_raw['sku_id'].unique()
    logging.info(f"Procesando {len(skus)} SKUs...")

    for count, sku in enumerate(skus):
        df_sku = df_raw[df_raw['sku_id'] == sku].copy()
        
        # Procesar serie temporal entera de ese SKU
        try:
            df_cleaned = process_sku_timeseries(df_sku, sku)
            
            # Convertir a records
            for _, row in df_cleaned.iterrows():
                # No guardar ceros que quedaron como ceros puros para optimizar base de datos
                # a menos que sean importantes? Mejor seguir la lógica: guardamos todo porque
                # puede que se consulte la data limpia de forma continua.
                # Pero en la BD actual solo bajamos lo que hay.
                # Si cantidad_limpia > 0 o la original era > 0:
                if row['cantidad_limpia'] > 0 or row['cantidad_total_tn'] > 0:
                    rec = {
                        'sku_id': sku,
                        'fecha': row['fecha'].strftime('%Y-%m-%d'),
                        'cantidad_original': float(row['cantidad_total_tn']),
                        'cantidad_limpia': float(row['cantidad_limpia']),
                        'es_outlier': bool(row['es_outlier']),
                        'es_quiebre_stock': bool(row['es_quiebre_stock']),
                        'metodo_limpieza': str(row['metodo_limpieza']),
                        'updated_at': datetime.now().isoformat()
                    }
                    all_clean_records.append(rec)
        except Exception as e:
            logging.error(f"Error procesando SKU {sku}: {e}")

        if (count + 1) % 500 == 0:
            logging.info(f"  Procesados {count + 1} SKUs...")

    logging.info(f"Total registros limpios generados: {len(all_clean_records)}")

    # Truncar tabla antigua y guardar
    logging.info("Truncando tabla sap_consumo_diario_clean en Supabase...")
    try:
        del_url = f"{SUPABASE_URL}/rest/v1/sap_consumo_diario_clean"
        requests.delete(del_url, headers=get_headers(), params={"id": "gt.0"})
    except Exception as e:
        logging.error(f"Error truncando tabla clean: {e}")

    logging.info("Insertando registros limpios...")
    total_inserted = 0
    for i in range(0, len(all_clean_records), BATCH_SIZE):
        batch = all_clean_records[i:i + BATCH_SIZE]
        try:
            post_to_supabase('sap_consumo_diario_clean', batch)
            total_inserted += len(batch)
        except Exception as e:
            logging.error(f"Error insertando batch clean: {e}")

    elapsed = (datetime.now() - start_time).total_seconds()
    log_sync_result(
        table_name="sap_consumo_diario_clean",
        rows_upserted=total_inserted,
        status="success"
    )

    logging.info(f"Proceso de Limpieza completado en {elapsed:.1f} segundos. {total_inserted} insertados.")
    return total_inserted

if __name__ == "__main__":
    clean_data()

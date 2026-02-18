import pandas as pd
from .transformers import normalize_value

def generate_signature(row):
    fecha_val = row.get('fecha', '')
    if pd.notna(fecha_val) and fecha_val:
        fecha_str = fecha_val.strftime('%Y-%m-%d') if hasattr(fecha_val, 'strftime') else str(fecha_val).split(' ')[0]
    else: fecha_str = ''
    parts = [
        normalize_value(row.get('material_clave')),
        fecha_str,
        normalize_value(row.get('cl_movimiento')),
        normalize_value(row.get('centro')),
        normalize_value(row.get('almacen')),
        normalize_value(row.get('cantidad_final_tn'))
    ]
    return "|".join(parts)

def generate_production_signature(row):
    fecha_val = row.get('fecha_contabilizacion', '')
    if pd.notna(fecha_val) and fecha_val:
        if hasattr(fecha_val, 'strftime'): fecha_str = fecha_val.strftime('%Y-%m-%d')
        else:
            s_val = str(fecha_val)
            fecha_str = s_val.split('T')[0] if 'T' in s_val else s_val.split(' ')[0]
    else: fecha_str = ''
    parts = [
        normalize_value(row.get('orden')),
        normalize_value(row.get('material')),
        fecha_str,
        normalize_value(row.get('cantidad_tn')),
        normalize_value(row.get('clase_orden'))
    ]
    return "|".join(parts)

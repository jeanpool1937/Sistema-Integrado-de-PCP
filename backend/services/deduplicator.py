"""
Servicio de deduplicación de registros.
Identifica y maneja filas duplicadas.
"""

import pandas as pd
from typing import List, Tuple, Dict
import hashlib


def generate_row_hash(row: pd.Series, columns: List[str]) -> str:
    """Genera un hash único para una fila basado en columnas específicas"""
    values = [str(row.get(col, '')) for col in columns]
    combined = '|'.join(values)
    return hashlib.md5(combined.encode()).hexdigest()


def find_duplicates(df: pd.DataFrame, key_columns: List[str]) -> Tuple[pd.DataFrame, pd.DataFrame, List[str]]:
    """
    Encuentra y separa duplicados en un DataFrame.
    
    Args:
        df: DataFrame a procesar
        key_columns: Columnas que definen unicidad
    
    Returns:
        Tuple de (df_unicos, df_duplicados, warnings)
    """
    warnings = []
    
    # Verificar que las columnas existan
    missing_cols = [col for col in key_columns if col not in df.columns]
    if missing_cols:
        warnings.append(f"Columnas para deduplicación no encontradas: {', '.join(missing_cols)}")
        return df, pd.DataFrame(), warnings
    
    # Generar hash para cada fila
    df = df.copy()
    df['_row_hash'] = df.apply(lambda row: generate_row_hash(row, key_columns), axis=1)
    
    # Identificar duplicados
    duplicated_mask = df.duplicated(subset='_row_hash', keep='first')
    
    df_unique = df[~duplicated_mask].drop(columns=['_row_hash'])
    df_duplicates = df[duplicated_mask].drop(columns=['_row_hash'])
    
    if len(df_duplicates) > 0:
        warnings.append(f"{len(df_duplicates)} filas duplicadas encontradas y eliminadas")
    
    return df_unique, df_duplicates, warnings


def deduplicate_maestro(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """Deduplica Maestro de Artículos por código"""
    df_unique, df_dups, warnings = find_duplicates(df, ['codigo'])
    return df_unique, warnings


def deduplicate_demanda(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """Deduplica Demanda por fecha + código"""
    df_unique, df_dups, warnings = find_duplicates(df, ['fecha', 'codigo'])
    return df_unique, warnings


def deduplicate_movimientos(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """
    Deduplica Movimientos. 
    NOTA: Se ha deshabilitado la deduplicación para movimientos para evitar 
    la pérdida de transacciones legítimas idénticas (mismo SKU, fecha y cantidad).
    """
    return df, []


def merge_duplicates(df: pd.DataFrame, key_columns: List[str], 
                     sum_columns: List[str] = None,
                     keep_first: List[str] = None) -> pd.DataFrame:
    """
    Merge inteligente de duplicados.
    
    Args:
        df: DataFrame con duplicados
        key_columns: Columnas que definen la agrupación
        sum_columns: Columnas a sumar (ej: cantidades)
        keep_first: Columnas donde se mantiene el primer valor
    
    Returns:
        DataFrame con duplicados mergeados
    """
    if sum_columns is None:
        sum_columns = []
    if keep_first is None:
        keep_first = []
    
    # Crear agregaciones
    agg_dict = {}
    
    for col in df.columns:
        if col in key_columns:
            continue
        elif col in sum_columns:
            agg_dict[col] = 'sum'
        elif col in keep_first:
            agg_dict[col] = 'first'
        else:
            agg_dict[col] = 'first'
    
    result = df.groupby(key_columns, as_index=False).agg(agg_dict)
    return result

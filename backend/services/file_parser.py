"""
Parser de archivos Excel usando pandas y openpyxl.
Detecta automáticamente el tipo de archivo y extrae los datos.
"""

import pandas as pd
from typing import Tuple, Dict, List, Any
from datetime import datetime
import re


# Mapeo de columnas Excel a nombres internos (con variantes)
COLUMN_MAPPINGS = {
    "maestro": {
        "codigo": ["codigo", "sku", "material", "id_articulo", "código"],
        "descripcion": ["descripcion", "texto breve", "nombre", "descripción"],
        "unidad_medida": ["unidad de medida", "umb", "unidad", "u.m."],
        "nivel1_jerarquia": ["nivel 1 jerarquia de producto", "jerarquia 1", "familia", "rubro", "nivel 1", "categoria", "cat"],
        "grupo_articulos": ["grupo de articulos", "grupo art.", "grupo artículos"],
        "tipo_material": ["tipo de material", "tipo mat.", "tipo"],
        "lead_time": ["lead time", "tiempo entrega", "plazo entrega", "dias reposicion", "lt"],
    },
    "demanda": {
        "fecha": ["fecha", "dia", "date", "periodo", "mes", "year", "día", "período"],
        "codigo": ["codigo", "sku", "material", "código", "articulo", "artículo", "cod"],
        "cantidad_diaria": ["cantidad diaria", "cantidad", "demanda", "qty", "proyeccion", "forecast", "venta", "ventas", "salidas", "historia", "total"],
    },
    "movimientos": {
        "codigo": ["codigo", "sku", "material", "código"],
        "clase_movimiento": ["cl.movimiento", "clase de movimiento", "movimiento", "transaccion", "clase", "tipo"],
        "fecha": ["fecha", "contabilizacion", "dia"],
        "tipo_movimiento": ["tipo movimiento", "texto clase mov.", "tipo"],
        "cantidad": ["cantidad", "cant.", "qty", "total"],
        "centro": ["centro", "planta"],
        "almacen": ["almacen", "almacén", "deposito", "dep.", "alm."],
    },
    "produccion": {
        "fecha": ["fecha", "dia", "date", "periodo"],
        "orden_proceso": ["orden de proceso", "orden", "id orden", "numero orden"],
        "sku": ["sku", "codigo", "producto terminado", "pt"],
        "materia_prima": ["materia prima", "mp", "insumo", "componente"],
        "programado": ["programado", "programado ", "cantidad programada", "qty programada"],
        "clase_proceso": ["clase proceso", "clase", "tipo proceso"],
        "numero_semana": ["numero semana", "semana", "week"],
        "consumo": ["consumo", "cantidad consumo", "consumido"],
    },
    "stock": {
         "codigo": ["material", "codigo", "sku", "código"],
         # Prioridad: Libre utilización > Stock Final Tons
         "cantidad": ["libre utilizacion", "libre utilización", "stock final tons", "stock", "inventario", "qty"],
         "centro": ["centro", "planta"],
         "almacen": ["almacen", "almacén", "deposito", "dep.", "alm."],
         "descripcion": ["texto breve de material", "descripcion"],
         "unidad_medida": ["unidad medida base", "umb"],
         "almacen_valido": ["almacen valido", "almacén válido", "valido"],
    },
    "centro_master": {
        "centro": ["centro", "id_centro", "planta"],
        "descripcion": ["descripcion", "nombre", "texto"],
        "pais": ["pais", "país", "country"]
    },
    "proceso_master": {
        "clase_proceso": ["clase proceso", "tipo proceso", "clase"],
        "proceso": ["proceso", "descripcion proceso", "id proceso"],
        "area": ["area", "área", "sector"],
        "centro_codigo": ["centro", "id_centro", "planta"]
    }
}

# Columnas mínimas para identificar un tipo de archivo
REQUIRED_COLUMNS = {
    "maestro": ["codigo"], # Muy relajado, luego se validan las demás
    "demanda": ["fecha", "cantidad_diaria"],
    "movimientos": ["clase_movimiento", "cantidad"],
    "produccion": ["sku", "programado"],
    "stock": ["codigo", "cantidad"],
    "centro_master": ["centro"],
    "proceso_master": ["proceso"]
}

# Clases de movimiento válidas (excluyendo Traspaso)
VALID_CLASES_MOVIMIENTO = ["Consumo", "Producción", "Stock", "Venta"]

def normalize_text(text: str) -> str:
    """Normaliza texto para comparación: minúsculas, sin acentos, sin espacios/guiones"""
    import unicodedata
    if not isinstance(text, str): text = str(text)
    # Quitar acentos
    text = "".join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')
    # Minúsculas y quitar caracteres no alfanuméricos
    import re
    return re.sub(r'[^a-z0-9]', '', text.lower())

def detect_file_type(df: pd.DataFrame, filename: str = "") -> str:
    """
    Detecta automáticamente el tipo de archivo buscando columnas clave
    y analizando el nombre del archivo.
    """
    fname = normalize_text(filename)
    cols = [normalize_text(c) for c in df.columns]
    
    # 0. Prioridad por nombre de archivo (Reglas específicas del usuario)
    if "mb52" in fname or all(k in cols for k in ["material", "stockfinaltons"]):
         return "stock"
    if any(k in fname for k in ["ventaproy", "planventa", "proyeccion", "historia"]):
        return "demanda"
    if any(k in fname for k in ["datobo", "movimiento", "stockmov", "kardex", "transaccion"]):
        return "movimientos"
    if any(k in fname for k in ["maestro", "articul", "master"]):
        return "maestro"
    if any(k in fname for k in ["produccion", "planprod", "orden", "planesproduccion", "planes"]):
        return "produccion"
    if any(k in fname for k in ["stock", "inventario", "saldos"]):
        return "stock"

    # 1. Puntuación por columnas
    scores = {"maestro": 0, "demanda": 0, "movimientos": 0}
    
    # Palabras clave por tipo
    keywords = {
        "maestro": ["jerarquia", "familia", "grupo art", "tipo mat", "peso", "volumen", "maestro"],
        "demanda": ["cantidad diaria", "proyeccion", "forecast", "pronostico", "venta", "ventas", "historia"],
        "movimientos": ["clase mov", "tipo mov", "cl.mov", "entradas", "salidas", "stock"],
        "produccion": ["plan", "produccion", "orden", "fabricacion"],
        "stock": ["stock final tons", "libre utilizacion", "stock no libre", "bloqueado", "almacen valido"]
    }
    
    for col in cols:
        # Check Movimientos
        if any(k in col for k in keywords["movimientos"]):
            scores["movimientos"] += 2
        
        # Check Demanda
        if any(k in col for k in keywords["demanda"]):
            scores["demanda"] += 3 # Muy específico
            
        # Check Maestro
        if any(k in col for k in keywords["maestro"]):
            scores["maestro"] += 2
            
    # Fallback: Nombre de columna exacto de los mappings
    for file_type, mapping in COLUMN_MAPPINGS.items():
        for internal_col, variants in mapping.items():
            for variant in variants:
                if normalize_text(variant) in cols:
                     scores[file_type] += 1
    
    best_type = max(scores, key=scores.get)
    if scores[best_type] > 0:
        return best_type
    
    # 2. Ultimo recurso: Nombre de archivo genérico
    if "maestro" in fname or "master" in fname or "articulo" in fname: return "maestro"
    if "demanda" in fname or "venta" in fname or "proy" in fname: return "demanda"
    if "mov" in fname or "stock" in fname or "dato" in fname: return "movimientos"
    if "prod" in fname: return "produccion"
    if "inv" in fname: return "stock"

    return "unknown"


def normalize_columns(df: pd.DataFrame, file_type: str) -> pd.DataFrame:
    """
    Normaliza columnas buscando la mejor coincidencia entre las variantes.
    """
    if file_type not in COLUMN_MAPPINGS:
        return df # Si es desconocido, no hacemos nada
    
    mapping = COLUMN_MAPPINGS[file_type]
    rename_map = {}
    
    df_cols_norm = {col: normalize_text(col) for col in df.columns}
    print(f"DEBUG: Normalizing {file_type}. Original cols: {list(df.columns)}")
    
    for internal_col, variants in mapping.items():
        # Buscamos si alguna variante está en las columnas del DF
        found = False
        for variant in variants:
            var_norm = normalize_text(variant)
            
            # 1. Búsqueda exacta normalizada
            for original_col, col_norm in df_cols_norm.items():
                if var_norm == col_norm:
                    rename_map[original_col] = internal_col
                    found = True
                    print(f"  FOUND: '{original_col}' -> '{internal_col}' (exact)")
                    break
            if found: break
            
            # 2. Búsqueda parcial (contiene)
            if not found:
                for original_col, col_norm in df_cols_norm.items():
                    if var_norm in col_norm or col_norm in var_norm:
                        rename_map[original_col] = internal_col
                        found = True
                        print(f"  FOUND: '{original_col}' -> '{internal_col}' (fuzzy)")
                        break
            if found: break
            
    # Aplicar renombrado
    df = df.rename(columns=rename_map)
    print(f"DEBUG: Final columns: {list(df.columns)}")
    return df


def parse_excel_file(file_path: str, file_type: str = None, sheet_name: Any = 0) -> Tuple[pd.DataFrame, str, List[str]]:
    """
    Lee y parsea un archivo Excel con autodetección robusta y búsqueda dinámica de encabezados.
    """
    warnings = []
    print(f"\nDEBUG: Parsing file: {file_path}, requested sheet: {sheet_name}")
    
    try:
        # Si sheet_name es string, intentar buscar la mejor coincidencia (case-insensitive)
        if isinstance(sheet_name, str):
            with pd.ExcelFile(file_path) as xl:
                sheets = xl.sheet_names
                found_sheet = None
                
                # Buscar coincidencia exacta (normalizada)
                norm_target = normalize_text(sheet_name)
                for s in sheets:
                    if normalize_text(s) == norm_target:
                        found_sheet = s
                        break
                
                if found_sheet:
                    sheet_name = found_sheet
                    print(f"  --> Found matching sheet: {sheet_name}")
                else:
                    # Si no se encuentra, lanzar error para que el try/except superior lo capture
                    raise ValueError(f"No se encontró la pestaña '{sheet_name}' en el archivo. Pestañas disponibles: {sheets}")

        # 1. Intentar lectura básica con motor de alta velocidad 'calamine'
        try:
            df = pd.read_excel(file_path, engine='calamine', header=None, sheet_name=sheet_name)
        except Exception:
            df = pd.read_excel(file_path, engine='openpyxl', header=None, sheet_name=sheet_name)
            
        print(f"  Raw rows read: {len(df)}")
        if not df.empty:
            print("  --- FIRST 5 ROWS RAW ---")
            print(df.head(5).to_string())
            print("  -----------------------")
        
        # 2. Buscar la mejor fila de encabezado
        # Buscamos una fila que tenga al menos 1 columna que coincida con CUALQUIER variante de CUALQUIER tipo
        best_header_idx = -1
        max_matches = 0
        
        # Revisamos las primeras 30 filas buscando el header
        for i in range(min(30, len(df))):
            # Normalizamos cada valor de la fila para comparar
            row_values = []
            for v in df.iloc[i]:
                if pd.notnull(v):
                    row_values.append(normalize_text(str(v)))
            
            matches = 0
            for type_name, mapping in COLUMN_MAPPINGS.items():
                for internal_col, variants in mapping.items():
                    for var in variants:
                        if normalize_text(var) in row_values:
                            matches += 1
            
            if matches > max_matches:
                max_matches = matches
                best_header_idx = i
                print(f"  Header candidate at row {i} has {matches} matches. Values: {row_values[:5]}...")

        if best_header_idx != -1 and max_matches >= 1: # Bajamos el umbral a 1 match
            # Re-leer o re-ajustar con el header encontrado
            df.columns = df.iloc[best_header_idx]
            df = df.iloc[best_header_idx + 1:].reset_index(drop=True)
            print(f"  --> SELECTED header row: {best_header_idx}")
        else:
            # Si no encontramos nada, intentamos usar la primera fila
            df.columns = df.iloc[0]
            df = df.iloc[1:].reset_index(drop=True)
            print("  --> WARNING: No matching header found. Using row 0 as default.")

    except Exception as e:
        print(f"  ERROR reading Excel: {str(e)}")
        # Fallback para CSV
        try:
             df = pd.read_csv(file_path, encoding='latin-1', sep=None, engine='python')
        except:
             raise ValueError(f"No se pudo leer el archivo: {str(e)}")
    
    # Quitar columnas que sean Null por error de lectura
    df = df.loc[:, df.columns.notnull()]
    
    if df.empty:
        raise ValueError("El archivo no tiene datos después de los encabezados")
        
    # Detectar tipo (si no viene forzado)
    if file_type is None:
        file_type = detect_file_type(df, file_path)
        if file_type == "unknown":
             raise ValueError("No se pudo detectar el tipo de archivo.")
    
    print(f"  Process type: {file_type} | Initial Rows: {len(df)}")
    df = normalize_columns(df, file_type)
    
    # Limpieza
    df = clean_data(df, file_type, warnings)
    print(f"  Final Rows: {len(df)}")
    
    return df, file_type, warnings

def clean_data(df: pd.DataFrame, file_type: str, warnings: List[str]) -> pd.DataFrame:
    """
    Limpia y valida los datos según el tipo de archivo.
    """
    original_count = len(df)
    print(f"DEBUG: Cleaning {file_type}. Rows: {original_count}")
    
    # Eliminar filas completamente vacías
    df = df.dropna(how='all')
    
    # Convertir fechas
    if 'fecha' in df.columns:
        # Intentar conversión robusta (manejo de Excel Serial Dates: 45XXX)
        def convert_date(val):
            if pd.isna(val) or val == '': return None
            try:
                # Si es un número (int o float), tratar como fecha Excel
                if isinstance(val, (int, float)) or (isinstance(val, str) and val.isdigit()):
                    num = float(val)
                    if num > 30000 and num < 60000: # Rango razonable de fechas (actualidad)
                        return pd.to_datetime(num, unit='D', origin='1899-12-30').date()
                return pd.to_datetime(val, errors='coerce').date()
            except:
                return None
        
        df['fecha'] = df['fecha'].apply(convert_date)
        invalid_dates = df['fecha'].isna().sum()
        if invalid_dates > 0:
            warnings.append(f"{invalid_dates} filas con fechas inválidas")
            print(f"DEBUG: {invalid_dates} invalid dates removed")
            df = df.dropna(subset=['fecha'])
    
    # Convertir cantidades a numérico (Manejo de formatos latinos/europeos)
    quantity_cols = ['cantidad', 'cantidad_diaria', 'programado', 'consumo', 'numero_semana', 'lead_time']
    for col in quantity_cols:
        if col in df.columns:
            # Si es string, limpiar separadores de miles/decimales de forma inteligente (Vectorizado para velocidad)
            if df[col].dtype == object:
                s = df[col].astype(str).str.strip()
                # Detectar formato latín (1.234,56)
                mask = s.str.contains(',', na=False)
                if mask.any():
                    s.loc[mask] = s.loc[mask].str.replace('.', '', regex=False).str.replace(',', '.', regex=False)
                df[col] = s
            
            df[col] = pd.to_numeric(df[col], errors='coerce')
            invalid_qty = df[col].isna().sum()
            if invalid_qty > 0:
                warnings.append(f"{invalid_qty} filas con {col} inválida")
                print(f"DEBUG: {invalid_qty} invalid quantities removed")
                df = df.dropna(subset=[col])
    
    # Limpiar códigos (Normalizar: quitar ceros a la izquierda para matching robusto)
    if 'codigo' in df.columns:
        df['codigo'] = df['codigo'].astype(str).str.strip().str.lstrip('0')
        df = df[df['codigo'] != '']
        df = df[df['codigo'] != 'nan']
    
    # Filtrar clases de movimiento válidas (para movimientos)
    if file_type == "movimientos":
        # Fallback para clase_movimiento si no existe
        if 'clase_movimiento' not in df.columns:
            if 'tipo_movimiento' in df.columns:
                df['clase_movimiento'] = df['tipo_movimiento']
            else:
                df['clase_movimiento'] = "OTRO"
        
        df['clase_movimiento'] = df['clase_movimiento'].astype(str).str.strip().str.upper()
        
        # Excluir Traspaso
        excluded = df[df['clase_movimiento'] == 'TRASPASO']
        if len(excluded) > 0:
            warnings.append(f"{len(excluded)} movimientos de tipo 'Traspaso' excluidos")
            df = df[df['clase_movimiento'] != 'TRASPASO']
            
            # Validar clases permitidas (Opcional, no ser demasiado estricto para que pase 'DATO BO DIA')
            valid_types = [c.upper() for c in VALID_CLASES_MOVIMIENTO]
            # print(f"DEBUG: Valid types for movimientos: {valid_types}. Found: {df['clase_movimiento'].unique()}")
    
    # Limpiar SKU y Materia Prima para Producción y Demanda
    for target_col in ['sku', 'materia_prima']:
        if target_col in df.columns:
            df[target_col] = df[target_col].astype(str).str.strip().str.lstrip('0')
            # Limpiar nans resultantes
            df.loc[df[target_col].isin(['', 'nan', 'None', '0']), target_col] = None

    # Filtrar SKUs nulos para produccion (DB requiere NOT NULL en SKU de PT)
    if file_type == "produccion":
        if 'sku' in df.columns:
            null_skus = df['sku'].isna()
            if null_skus.sum() > 0:
                warnings.append(f"{null_skus.sum()} filas con SKU vacío removidas")
                df = df[~null_skus]

    # Limpiar strings
    string_columns = df.select_dtypes(include=['object']).columns
    for col in string_columns:
        if col == 'fecha': continue # SQLite requiere objetos date, no strings
        df[col] = df[col].astype(str).str.strip()
        df[col] = df[col].replace('nan', None)
    
    removed = original_count - len(df)
    if removed > 0:
        warnings.append(f"{removed} filas eliminadas durante limpieza")
    
    print(f"DEBUG: Final rows after clean: {len(df)}")
    return df


def parse_maestro(file_path: str) -> Tuple[pd.DataFrame, List[str]]:
    """Parsea archivo Maestro de Artículos"""
    df, _, warnings = parse_excel_file(file_path, "maestro")
    return df, warnings


def parse_demanda(file_path: str) -> Tuple[pd.DataFrame, List[str]]:
    """Parsea archivo Demanda Proyectada"""
    df, _, warnings = parse_excel_file(file_path, "demanda")
    return df, warnings


def parse_movimientos(file_path: str) -> Tuple[pd.DataFrame, List[str]]:
    """Parsea archivo Movimientos de Stock"""
    df, _, warnings = parse_excel_file(file_path, "movimientos")
    return df, warnings


def parse_produccion(file_path: str) -> Tuple[pd.DataFrame, List[str]]:
    """Parsea archivo Planes de Producción"""
    df, _, warnings = parse_excel_file(file_path, "produccion")
    return df, warnings


def parse_stock(file_path: str) -> Tuple[pd.DataFrame, List[str]]:
    """Parsea archivo Stock Actual (Snapshot)"""
    df, _, warnings = parse_excel_file(file_path, "stock")
    # Forzar fecha hoy si no tiene
    if 'fecha' not in df.columns:
        from datetime import date
        df['fecha'] = date.today()
        
    # Limpieza específica para MB52
    if 'cantidad' in df.columns:
         # Asegurar numérico, convertir nan a 0
         df['cantidad'] = pd.to_numeric(df['cantidad'], errors='coerce').fillna(0)
         
    return df, warnings


def parse_centro_master(file_path: str, sheet_name: str = "Centro") -> Tuple[pd.DataFrame, List[str]]:
    """Parsea la pestaña de Centros"""
    df, _, warnings = parse_excel_file(file_path, "centro_master", sheet_name=sheet_name)
    return df, warnings


def parse_proceso_master(file_path: str, sheet_name: str = "Procesos") -> Tuple[pd.DataFrame, List[str]]:
    """Parsea la pestaña de Procesos"""
    df, _, warnings = parse_excel_file(file_path, "proceso_master", sheet_name=sheet_name)
    return df, warnings

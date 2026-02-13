"""
FastAPI Application - Gemelo Digital Inventory Management
API para carga y procesamiento de archivos Excel de inventario.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
import tempfile
import os
import uuid
from datetime import datetime
import pandas as pd

from database import (
    init_db, get_db,
    DBMaestroArticulo, DBCentro, DBProceso, 
    DBDemandaProyectada, DBMovimientoStock, DBPlanProduccion,
    DBUploadHistory, DBValidationLog
)
from services import (
    parse_excel_file, parse_maestro, parse_demanda, parse_movimientos, parse_produccion, parse_stock,
    parse_centro_master, parse_proceso_master,
    detect_file_type, VALID_CLASES_MOVIMIENTO,
    DataValidator, validate_dataframe_skus,
    deduplicate_maestro, deduplicate_demanda, deduplicate_movimientos,
    UnitNormalizer,
    calculate_psoh, get_stockout_alerts
)
from models import UploadResponse, PreviewResponse


# Inicializar FastAPI
app = FastAPI(
    title="Gemelo Digital - Inventory API",
    description="API para gestión de inventarios y procesamiento de datos Excel",
    version="1.0.0"
)

# Configurar CORS para frontend local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Inicializa la base de datos al arrancar"""
    init_db()


# ============== ENDPOINTS DE UPLOAD ==============

@app.post("/api/upload/maestro", response_model=UploadResponse)
async def upload_maestro(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Sube y procesa el archivo Maestro de Artículos.
    Este archivo debe cargarse primero ya que se usa para validar los otros.
    """
    upload_id = str(uuid.uuid4())[:8]
    
    try:
        # Guardar archivo temporal
        temp_path = await save_temp_file(file)
        
        # 1. Procesar Pestaña "Maestro de Articulos"
        df, warnings = parse_maestro(temp_path)
        df, dedup_warnings = deduplicate_maestro(df)
        warnings.extend(dedup_warnings)
        
        # Guardar en DB Maestro
        existing_items = {item.codigo: item for item in db.query(DBMaestroArticulo).all()}
        for _, row in df.iterrows():
            codigo = str(row['codigo'])
            existing = existing_items.get(codigo)
            if existing:
                for key, value in row.items():
                    if hasattr(existing, key) and value is not None and not pd.isna(value):
                        setattr(existing, key, value)
            else:
                item = DBMaestroArticulo(**{k: v for k, v in row.items() if hasattr(DBMaestroArticulo, k) and not pd.isna(v)})
                db.add(item)
                existing_items[codigo] = item
        
        # 2. Intentar Procesar Pestaña "Centro"
        try:
            df_centros, w_centros = parse_centro_master(temp_path)
            warnings.extend([f"Centro: {w}" for w in w_centros])
            
            existing_centros = {c.centro: c for c in db.query(DBCentro).all()}
            for _, row in df_centros.iterrows():
                c_code = str(row['centro'])
                existing = existing_centros.get(c_code)
                if existing:
                    for key, value in row.items():
                        if hasattr(existing, key) and not pd.isna(value):
                            setattr(existing, key, value)
                else:
                    centro = DBCentro(**{k: v for k, v in row.items() if hasattr(DBCentro, k) and not pd.isna(v)})
                    db.add(centro)
                    existing_centros[c_code] = centro
        except Exception as e:
            print(f"INFO: No se pudo procesar pestaña Centro: {e}")
            
        # 3. Intentar Procesar Pestaña "Procesos"
        try:
            df_procesos, w_procesos = parse_proceso_master(temp_path)
            warnings.extend([f"Procesos: {w}" for w in w_procesos])
            
            # Los procesos no suelen tener un 'ID' único de negocio tan claro, 
            # así que por ahora los agregamos si no existen combinaciones iguales exactas
            # O simplemente refrescamos. Para simplificar, agregamos los nuevos.
            for _, row in df_procesos.iterrows():
                # Evitar duplicados simples en este batch
                proc = DBProceso(**{k: v for k, v in row.items() if hasattr(DBProceso, k) and not pd.isna(v)})
                db.add(proc)
        except Exception as e:
            print(f"INFO: No se pudo procesar pestaña Procesos: {e}")

        db.commit()
        os.unlink(temp_path)
        log_upload(db, upload_id, file.filename, "maestro", len(df), len(df), 0)
        
        return UploadResponse(
            success=True,
            filename=file.filename,
            records_processed=len(df),
            records_valid=len(df),
            records_invalid=0,
            warnings=warnings
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return UploadResponse(
            success=False,
            filename=file.filename,
            records_processed=0,
            records_valid=0,
            records_invalid=0,
            errors=[str(e)]
        )


@app.post("/api/upload/demanda", response_model=UploadResponse)
async def upload_demanda(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Sube y procesa el archivo de Demanda Proyectada Diaria."""
    upload_id = str(uuid.uuid4())[:8]
    
    try:
        # Chequear si el maestro tiene datos
        if db.query(DBMaestroArticulo).count() == 0:
            return UploadResponse(
                success=False,
                filename=file.filename,
                records_processed=0,
                records_valid=0,
                records_invalid=0,
                errors=["ERROR CRÍTICO: Debe cargar el 'Maestro de Artículos' antes de cualquier otro archivo. El sistema necesita el maestro para identificar y validar los productos."]
            )

        temp_path = await save_temp_file(file)
        df, warnings = parse_demanda(temp_path)
        
        # Validar SKUs contra maestro
        validator = DataValidator(db)
        _, sku_warnings = validate_dataframe_skus(df, validator)
        warnings.extend(sku_warnings)
        
        # Deduplicar
        df, dedup_warnings = deduplicate_demanda(df)
        warnings.extend(dedup_warnings)
        
        # Guardar en DB (MODO BULK PARA VELOCIDAD > 500K FILAS)
        # Filtramos columnas para que coincidan exactamente con el modelo
        model_cols = {c.name for c in DBDemandaProyectada.__table__.columns}
        insert_df = df[[c for c in df.columns if c in model_cols]].copy()
        
        db.bulk_insert_mappings(DBDemandaProyectada, insert_df.to_dict(orient='records'))
        db.commit()
        records_saved = len(insert_df)
        os.unlink(temp_path)
        
        log_upload(db, upload_id, file.filename, "demanda", len(df), records_saved, 0)
        
        return UploadResponse(
            success=True,
            filename=file.filename,
            records_processed=len(df),
            records_valid=records_saved,
            records_invalid=0,
            warnings=warnings
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return UploadResponse(
            success=False,
            filename=file.filename,
            records_processed=0,
            records_valid=0,
            records_invalid=0,
            errors=[str(e)]
        )


@app.post("/api/upload/movimientos", response_model=UploadResponse)
async def upload_movimientos(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Sube y procesa el archivo de Movimientos de Stock."""
    upload_id = str(uuid.uuid4())[:8]
    
    try:
        # Chequear si el maestro tiene datos
        if db.query(DBMaestroArticulo).count() == 0:
            return UploadResponse(
                success=False,
                filename=file.filename,
                records_processed=0,
                records_valid=0,
                records_invalid=0,
                errors=["ERROR CRÍTICO: Debe cargar el 'Maestro de Artículos' antes de cualquier otro archivo. El sistema necesita el maestro para identificar y validar los productos."]
            )

        temp_path = await save_temp_file(file)
        df, warnings = parse_movimientos(temp_path)
        
        # Validar SKUs
        validator = DataValidator(db)
        _, sku_warnings = validate_dataframe_skus(df, validator)
        warnings.extend(sku_warnings)
        
        # Deduplicar
        df, dedup_warnings = deduplicate_movimientos(df)
        warnings.extend(dedup_warnings)
        
        # Normalizar unidades si es posible
        normalizer = UnitNormalizer(db)
        
        # Guardar en DB (MODO BULK PARA VELOCIDAD > 500K FILAS)
        # Filtramos columnas para que coincidan exactamente con el modelo
        model_cols = {c.name for c in DBMovimientoStock.__table__.columns}
        insert_df = df[[c for c in df.columns if c in model_cols]].copy()
        
        db.bulk_insert_mappings(DBMovimientoStock, insert_df.to_dict(orient='records'))
        db.commit()
        records_saved = len(insert_df)
        os.unlink(temp_path)
        
        log_upload(db, upload_id, file.filename, "movimientos", len(df), records_saved, 0)
        
        return UploadResponse(
            success=True,
            filename=file.filename,
            records_processed=len(df),
            records_valid=records_saved,
            records_invalid=0,
            warnings=warnings
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return UploadResponse(
            success=False,
            filename=file.filename,
            records_processed=0,
            records_valid=0,
            records_invalid=0,
            errors=[str(e)]
        )


@app.post("/api/upload/produccion", response_model=UploadResponse)
async def upload_produccion(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Sube y procesa el archivo de Planes de Producción."""
    upload_id = str(uuid.uuid4())[:8]
    
    try:
        # Chequear si el maestro tiene datos
        if db.query(DBMaestroArticulo).count() == 0:
            return UploadResponse(
                success=False,
                filename=file.filename,
                records_processed=0,
                records_valid=0,
                records_invalid=0,
                errors=["ERROR CRÍTICO: Debe cargar el 'Maestro de Artículos' antes de cualquier otro archivo."]
            )

        temp_path = await save_temp_file(file)
        df, warnings = parse_produccion(temp_path)
        
        # Validar SKUs
        validator = DataValidator(db)
        _, sku_warnings = validate_dataframe_skus(df, validator)
        warnings.extend(sku_warnings)
        
        # Guardar en DB (MODO BULK PARA VELOCIDAD)
        model_cols = {c.name for c in DBPlanProduccion.__table__.columns}
        insert_df = df[[c for c in df.columns if c in model_cols]].copy()
        
        db.bulk_insert_mappings(DBPlanProduccion, insert_df.to_dict(orient='records'))
        db.commit()
        records_saved = len(insert_df)
        
        os.unlink(temp_path)
        
        log_upload(db, upload_id, file.filename, "produccion", len(df), records_saved, 0)
        
        return UploadResponse(
            success=True,
            filename=file.filename,
            records_processed=len(df),
            records_valid=records_saved,
            records_invalid=0,
            warnings=warnings
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return UploadResponse(
            success=False,
            filename=file.filename,
            records_processed=0,
            records_valid=0,
            records_invalid=0,
            errors=[str(e)]
        )


@app.post("/api/upload/stock", response_model=UploadResponse)
async def upload_stock(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Sube y procesa el archivo de Stock Actual.
    Lo convierte en un Movimiento de tipo 'STOCK' (Inventario Físico / Snapshot).
    """
    upload_id = str(uuid.uuid4())[:8]
    
    try:
        if db.query(DBMaestroArticulo).count() == 0:
            return UploadResponse(
                success=False,
                filename=file.filename,
                records_processed=0,
                records_valid=0,
                records_invalid=0,
                errors=["ERROR CRÍTICO: Debe cargar el 'Maestro de Artículos' primero."]
            )

        temp_path = await save_temp_file(file)
        df, warnings = parse_stock(temp_path)
        
        # Validar SKUs
        validator = DataValidator(db)
        _, sku_warnings = validate_dataframe_skus(df, validator)
        warnings.extend(sku_warnings)
        
        # Guardar como Movimientos
        print(f"DEBUG: Stock DF columns before saving: {df.columns.tolist()}")
        if not df.empty:
            print(f"DEBUG: Sample row: {df.iloc[0].to_dict()}")
            
        # IMPORTANTE: Limpiar snapshots anteriores para evitar duplicidad y confusión
        # Esto asegura que "Stock Actual" sea siempre el resultado de la ÚLTIMA carga.
        skus_to_update = df['codigo'].unique().tolist()
        db.query(DBMovimientoStock).filter(
            DBMovimientoStock.clase_movimiento == "STOCK",
            DBMovimientoStock.codigo.in_(skus_to_update)
        ).delete(synchronize_session=False)
        db.commit()

        records_saved = 0
        for _, row in df.iterrows():
            def clean_val(val):
                if val is None or pd.isna(val): return None
                s = str(val).strip()
                if s.endswith('.0'): s = s[:-2]
                return s if s else None

            c = clean_val(row.get('centro'))
            a = clean_val(row.get('almacen'))
            a = clean_val(row.get('almacen'))
            valido = clean_val(row.get('almacen_valido')) # Nuevo campo
            
            item = DBMovimientoStock(
                codigo=row['codigo'],
                descripcion=row.get('descripcion'),
                unidad_medida=row.get('unidad_medida'),
                clase_movimiento="STOCK",
                fecha=row['fecha'],
                tipo_movimiento="STOCK_SNAPSHOT",
                cantidad=row['cantidad'],
                centro=c,
                almacen=a,
                almacen_valido=valido
            )
            db.add(item)
            records_saved += 1
        
        db.commit()
        os.unlink(temp_path)
        
        log_upload(db, upload_id, file.filename, "stock", len(df), records_saved, 0)
        
        return UploadResponse(
            success=True,
            filename=file.filename,
            records_processed=len(df),
            records_valid=records_saved,
            records_invalid=0,
            warnings=warnings
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return UploadResponse(
            success=False,
            filename=file.filename,
            records_processed=0,
            records_valid=0,
            records_invalid=0,
            errors=[str(e)]
        )


@app.post("/api/upload/auto", response_model=UploadResponse)
async def upload_auto_detect(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Sube un archivo y detecta automáticamente su tipo.
    Útil para uploads con drag & drop sin especificar tipo.
    """
    try:
        temp_path = await save_temp_file(file)
        
        # Detectar tipo
        import pandas as pd
        df_preview = pd.read_excel(temp_path, nrows=5)
        
        print(f"--- DIAGNOSTICO DE ARCHIVO: {file.filename} ---")
        print(f"Columnas encontradas: {list(df_preview.columns)}")
        
        file_type = detect_file_type(df_preview, file.filename)
        print(f"Tipo detectado: {file_type}")
        print("------------------------------------------------")
        
        os.unlink(temp_path)
        
        if file_type == "unknown":
            raise HTTPException(
                status_code=400,
                detail=f"No se pudo identificar. Columnas leídas: {list(df_preview.columns)}"
            )
        
        # Redirigir al endpoint apropiado
        temp_path = await save_temp_file(file)
        
        if file_type == "maestro":
            return await upload_maestro(file, db)
        elif file_type == "demanda":
            return await upload_demanda(file, db)
        elif file_type == "movimientos":
            return await upload_movimientos(file, db)
        elif file_type == "produccion":
             return await upload_produccion(file, db)
        elif file_type == "stock":
             return await upload_stock(file, db)
            
    except HTTPException:
        raise
    except Exception as e:
        return UploadResponse(
            success=False,
            filename=file.filename,
            records_processed=0,
            records_valid=0,
            records_invalid=0,
            errors=[str(e)]
        )


@app.post("/api/preview/movimientos", response_model=PreviewResponse)
async def preview_movimientos(
    file: UploadFile = File(...)
):
    """
    Parsea y previsualiza el archivo de Movimientos de Stock sin guardar en BD.
    Retorna los datos parseados en JSON.
    """
    try:
        temp_path = await save_temp_file(file)
        df, warnings = parse_movimientos(temp_path)
        
        # Convertir a dict para JSON
        # Reemplazar NaN/NaT con None
        df = df.where(pd.notnull(df), None)
        
        # Convertir fechas a string
        if 'fecha' in df.columns:
            df['fecha'] = df['fecha'].astype(str)
            
        data = df.to_dict(orient='records')
        
        os.unlink(temp_path)
        
        return PreviewResponse(
            filename=file.filename,
            total_records=len(df),
            warnings=warnings,
            headers=df.columns.tolist(),
            data=data
        )
        
    except Exception as e:
        # En caso de error, retornamos un PreviewResponse con el error como warning
        # o lanzamos HTTPException. Para preview, es mejor lanzar error 400.
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/preview/auto", response_model=PreviewResponse)
async def preview_auto_detect(
    file: UploadFile = File(...)
):
    """
    Auto-detecta y previsualiza cualquier archivo soportado.
    """
    try:
        temp_path = await save_temp_file(file)
        
        # Parsear (detecta tipo automáticamente)
        df, file_type, warnings = parse_excel_file(temp_path)
        
        df = df.where(pd.notnull(df), None)
        if 'fecha' in df.columns:
            df['fecha'] = df['fecha'].astype(str)
            
        data = df.to_dict(orient='records')
        os.unlink(temp_path)
        
        return PreviewResponse(
            filename=file.filename,
            total_records=len(df),
            warnings=warnings + [f"Tipo de archivo detectado: {file_type}"],
            headers=df.columns.tolist(),
            data=data
        )
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== ENDPOINTS DE CONSULTA ==============

@app.get("/api/maestro")
async def get_maestro_items(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Obtiene artículos del maestro con cálculo de stock real"""
    from sqlalchemy import func
    
    # 1. Obtener la última fecha de movimientos de tipo STOCK
    latest_date_query = db.query(func.max(DBMovimientoStock.fecha)).filter(
        (DBMovimientoStock.clase_movimiento.ilike('%STOCK%')) | 
        (DBMovimientoStock.tipo_movimiento.ilike('%STOCK%'))
    ).scalar()
    
    print(f"DEBUG STOCK: Latest date for STOCK: {latest_date_query}")
    
    # 2. Base query para Maestro con ordenamiento estable
    query = db.query(DBMaestroArticulo).order_by(DBMaestroArticulo.codigo)
    
    if search:
        query = query.filter(
            DBMaestroArticulo.codigo.contains(search) |
            DBMaestroArticulo.descripcion.contains(search)
        )
    
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    codigos_pagina = [item.codigo for item in items]
    codigos_normalizados = [c.lstrip('0') for c in codigos_pagina]

    # 3. Obtener stock agrupado para los items de esta página
    stock_map = {}
    if latest_date_query:
        stock_query = db.query(
            DBMovimientoStock.codigo,
            func.sum(DBMovimientoStock.cantidad).label('total_stock')
        ).filter(
            ((DBMovimientoStock.clase_movimiento.ilike('%STOCK%')) | 
             (DBMovimientoStock.tipo_movimiento.ilike('%STOCK%'))),
            DBMovimientoStock.fecha == latest_date_query,
            DBMovimientoStock.codigo.in_(codigos_normalizados)
        ).group_by(DBMovimientoStock.codigo).all()
        
        stock_map = {s.codigo: s.total_stock for s in stock_query}

    # 4. Obtener ADU y Desviación Estándar real desde MOVIMIENTOS (Consumo/Ventas)
    # Según experto DDMRP: ADU es el promedio de Consumo + Ventas, con 0s en días sin movimiento.
    demand_movs = db.query(
        DBMovimientoStock.codigo,
        DBMovimientoStock.fecha,
        DBMovimientoStock.cantidad
    ).filter(
        DBMovimientoStock.codigo.in_(codigos_normalizados),
        (DBMovimientoStock.tipo_movimiento.ilike('%CONSUMO%')) | 
        (DBMovimientoStock.tipo_movimiento.ilike('%VENTA%'))
    ).all()
    
    import statistics
    from datetime import date, timedelta
    
    # Rango de fechas global para normalizar (rellenar con 0s)
    # Buscamos el rango total de movimientos en la DB para este análisis
    global_range_query = db.query(
        func.min(DBMovimientoStock.fecha),
        func.max(DBMovimientoStock.fecha)
    ).filter(
        (DBMovimientoStock.tipo_movimiento.ilike('%CONSUMO%')) | 
        (DBMovimientoStock.tipo_movimiento.ilike('%VENTA%'))
    ).first()

    min_date, max_date = global_range_query if global_range_query and global_range_query[0] else (date.today(), date.today())
    days_range = (max_date - min_date).days + 1 if min_date else 1
    
    # Agrupar por SKU y Fecha
    sku_daily_demand = {}
    for code, f_date, qty in demand_movs:
        if code not in sku_daily_demand: sku_daily_demand[code] = {}
        # Sumamos algebraicamente para permitir que los negativos (devoluciones) resten
        sku_daily_demand[code][f_date] = sku_daily_demand[code].get(f_date, 0) + qty
    
    stats_map = {}
    for code in codigos_normalizados:
        daily_values = []
        daily_history_objects = []
        sku_data = sku_daily_demand.get(code, {})
        
        # Rellenar con 0s los días sin movimientos
        curr = min_date
        while curr <= max_date:
            val = sku_data.get(curr, 0)
            # Regla experta: si la suma del día es negativa (más devoluciones que ventas), se considera 0
            val = max(0, val)
            
            daily_values.append(val)
            daily_history_objects.append({"date": str(curr), "value": val})
            
            curr += timedelta(days=1)
        
        if not daily_values: daily_values = [0]
        
        adu = sum(daily_values) / len(daily_values) if daily_values else 0
        std_dev = statistics.stdev(daily_values) if len(daily_values) > 1 else 0
        # Guardamos la serie completa para el frontend (Sparklines) con fechas
        stats_map[code] = {"adu": adu, "std_dev": std_dev, "history": daily_history_objects[-90:]} # Últimos 90 días

    print(f"DEBUG EXPERT DDMRP: Final calculation with negative handling for {len(stats_map)} SKUs.")
    
    return {
        "total": total,
        "items": [
            {
                "codigo": item.codigo,
                "descripcion": item.descripcion,
                "unidad_medida": item.unidad_medida,
                "lead_time": item.lead_time,
                "stock": stock_map.get(item.codigo.lstrip('0'), 0),
                "adu": stats_map.get(item.codigo.lstrip('0'), {}).get('adu', 0),
                "std_dev": stats_map.get(item.codigo.lstrip('0'), {}).get('std_dev', 0),
                "history": stats_map.get(item.codigo.lstrip('0'), {}).get('history', [])
            }
            for item in items
        ]
    }


@app.get("/api/demanda")
async def get_demanda(
    skip: int = 0,
    limit: int = 100,
    codigo: Optional[str] = None,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Obtiene demanda proyectada con filtros"""
    query = db.query(DBDemandaProyectada)
    
    if codigo:
        query = query.filter(DBDemandaProyectada.codigo == codigo)
    if fecha_inicio:
        query = query.filter(DBDemandaProyectada.fecha >= fecha_inicio)
    if fecha_fin:
        query = query.filter(DBDemandaProyectada.fecha <= fecha_fin)
    
    total = query.count()
    items = query.order_by(DBDemandaProyectada.fecha).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "items": [
            {
                "fecha": str(item.fecha),
                "codigo": item.codigo,
                "descripcion": item.descripcion,
                "cantidad_diaria": item.cantidad_diaria,
            }
            for item in items
        ]
    }


@app.get("/api/movimientos")
async def get_movimientos(
    skip: int = 0,
    limit: int = 100,
    codigo: Optional[str] = None,
    clase_movimiento: Optional[str] = None,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Obtiene movimientos de stock con filtros"""
    query = db.query(DBMovimientoStock)
    
    if codigo:
        query = query.filter(DBMovimientoStock.codigo == codigo)
    if clase_movimiento:
        query = query.filter(DBMovimientoStock.clase_movimiento == clase_movimiento)
    if fecha_inicio:
        query = query.filter(DBMovimientoStock.fecha >= fecha_inicio)
    if fecha_fin:
        query = query.filter(DBMovimientoStock.fecha <= fecha_fin)
    
    total = query.count()
    items = query.order_by(DBMovimientoStock.fecha.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "items": [
            {
                "fecha": str(item.fecha),
                "codigo": item.codigo,
                "descripcion": item.descripcion,
                "clase_movimiento": item.clase_movimiento,
                "tipo_movimiento": item.tipo_movimiento,
                "cantidad": item.cantidad,
                "centro": item.centro,
            }
            for item in items
        ]
    }


@app.get("/api/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Estadísticas generales del sistema"""
    maestro_count = db.query(DBMaestroArticulo).count()
    demanda_count = db.query(DBDemandaProyectada).count()
    movimientos_count = db.query(DBMovimientoStock).count()
    
    # Clases de movimiento
    from sqlalchemy import func
    clases = db.query(
        DBMovimientoStock.clase_movimiento,
        func.count(DBMovimientoStock.id).label('count'),
        func.sum(DBMovimientoStock.cantidad).label('total_cantidad')
    ).group_by(DBMovimientoStock.clase_movimiento).all()
    
    return {
        "maestro_articulos": maestro_count,
        "demanda_registros": demanda_count,
        "movimientos_registros": movimientos_count,
        "clases_movimiento": [
            {
                "clase": c.clase_movimiento,
                "registros": c.count,
                "cantidad_total": float(c.total_cantidad) if c.total_cantidad else 0
            }
            for c in clases
        ]
    }


@app.get("/api/uploads")
async def get_upload_history(
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Historial de uploads recientes"""
    uploads = db.query(DBUploadHistory).order_by(
        DBUploadHistory.created_at.desc()
    ).limit(limit).all()
    
    return [
        {
            "upload_id": u.upload_id,
            "filename": u.filename,
            "file_type": u.file_type,
            "records_total": u.records_total,
            "records_valid": u.records_valid,
            "status": u.status,
            "created_at": str(u.created_at),
        }
        for u in uploads
    ]



# ============== PROYECCIÓN DE STOCK (PSoH) ==============

@app.get("/api/projection/alerts")
async def get_projection_alerts(
    horizon: int = 30,
    db: Session = Depends(get_db)
):
    """
    Retorna lista de SKUs con proyecciones de stockout (PSoH <= 0).
    """
    try:
        alerts = get_stockout_alerts(db, horizon_days=horizon)
        return {"alerts": alerts, "count": len(alerts)}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projection/{sku}")
async def get_sku_projection(
    sku: str,
    horizon: int = 30,
    safety_stock: float = 0,
    warehouses: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Calcula la proyección diaria de stock (PSoH) para un SKU.
    """
    try:
        # Normalizar SKU (quitar ceros izquierda si es numérico)
        sku_clean = sku.lstrip('0') if sku.isdigit() else sku
        
        # Parsear almacenes si vienen en el query
        # Parsear almacenes si vienen en el query
        target_warehouses = None
        if warehouses is not None:
            # Esperamos string separado por comas: "2100 - 2118,2100 - 2119"
            # Si warehouses es "", el resultado será [], lo cual es correcto (filtro vacío = 0 stock)
            target_warehouses = [w.strip() for w in warehouses.split(',') if w.strip()]
            print(f"DEBUG: Processing SKU {sku}")
            print(f"DEBUG: Raw 'warehouses' param: '{warehouses}'")
            print(f"DEBUG: Parsed 'target_warehouses': {target_warehouses}")
        
        projection = calculate_psoh(
            db, 
            sku=sku_clean, 
            horizon_days=horizon, 
            safety_stock=safety_stock,
            target_warehouses=target_warehouses
        )
        return {"sku": sku_clean, "projection": projection}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/system/status")
async def get_system_status(db: Session = Depends(get_db)):
    """
    Estado unificado del sistema para el contrato de integración.
    Verifica la presencia de datos en las tablas core.
    """
    has_maestro = db.query(DBMaestroArticulo).limit(1).count() > 0
    has_demanda = db.query(DBDemandaProyectada).limit(1).count() > 0
    # Movimientos: solo contar registros que NO sean STOCK (Consumo, Venta, Producción, etc.)
    has_movimientos = db.query(DBMovimientoStock).filter(
        DBMovimientoStock.clase_movimiento != 'STOCK'
    ).limit(1).count() > 0
    has_produccion = db.query(DBPlanProduccion).limit(1).count() > 0
    # Stock se verifica si hay movimientos tipo STOCK
    has_stock = db.query(DBMovimientoStock).filter(DBMovimientoStock.clase_movimiento == 'STOCK').limit(1).count() > 0
    
    total_skus = db.query(DBMaestroArticulo).count()
    
    # Obtener última carga exitosa
    last_upload = db.query(DBUploadHistory).order_by(
        DBUploadHistory.created_at.desc()
    ).first()
    
    return {
        "status": "online",
        "maestro": has_maestro,
        "demanda": has_demanda,
        "movimientos": has_movimientos,
        "produccion": has_produccion,
        "stock": has_stock,
        "total_skus": total_skus,
        "last_upload": str(last_upload.created_at) if last_upload else None
    }


@app.post("/api/system/reset")
async def reset_database(db: Session = Depends(get_db)):
    """
    Limpia todas las tablas de la base de datos para comenzar de cero.
    """
    try:
        db.query(DBMaestroArticulo).delete()
        db.query(DBDemandaProyectada).delete()
        db.query(DBMovimientoStock).delete()
        db.query(DBPlanProduccion).delete()
        db.query(DBUploadHistory).delete()
        db.commit()
        return {"status": "success", "message": "Base de datos reiniciada correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============== HELPERS ==============

async def save_temp_file(file: UploadFile) -> str:
    """Guarda un archivo subido en ubicación temporal"""
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
        content = await file.read()
        temp.write(content)
        await file.seek(0)  # Reset para posible re-lectura
        return temp.name


def log_upload(db: Session, upload_id: str, filename: str, file_type: str,
               total: int, valid: int, invalid: int):
    """Registra un upload en el historial"""
    history = DBUploadHistory(
        upload_id=upload_id,
        filename=filename,
        file_type=file_type,
        records_total=total,
        records_valid=valid,
        records_invalid=invalid,
        status="completed",
        completed_at=datetime.utcnow()
    )
    db.add(history)
    db.commit()


# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.get("/")
async def root():
    return {"message": "Antigravity API Online", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

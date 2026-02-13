"""
Servicio de Proyección de Stock (PSoH - Projected Stock on Hand)
Calcula el saldo proyectado de inventario día a día para detectar stockouts.
"""

import statistics
from datetime import date, timedelta
from typing import List, Dict, Tuple, Optional
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import func
from database.db import DBMaestroArticulo, DBMovimientoStock, DBDemandaProyectada, DBPlanProduccion, DBProceso

def get_skus_safety_stocks(db: Session) -> Dict[str, float]:
    """
    Calcula el Safety Stock (Zona Roja) para todos los SKUs basándose en ADU y Lead Time.
    Replica la lógica experta del frontend (DataContext.tsx).
    """
    # 1. Obtener Maestro y Lead Times
    maestro = db.query(DBMaestroArticulo.codigo, DBMaestroArticulo.lead_time).all()
    sku_lead_times = {m.codigo.lstrip('0'): (m.lead_time if m.lead_time and m.lead_time > 0 else 25) for m in maestro}
    all_codes = list(sku_lead_times.keys())
    
    # 2. Rango de fechas para ADU (Últimos 90 días desde la fecha máxima de movimientos)
    max_date_query = db.query(func.max(DBMovimientoStock.fecha)).filter(
        (DBMovimientoStock.tipo_movimiento.ilike('%CONSUMO%')) | 
        (DBMovimientoStock.tipo_movimiento.ilike('%VENTA%'))
    ).scalar()
    
    if not max_date_query:
        # Si no hay consumos/ventas, todos tienen SS = 0
        return {code: 0.0 for code in all_codes}
        
    # Limitar el análisis a los últimos 90 días para evitar dilución histórica
    max_date = max_date_query
    min_date = max_date - timedelta(days=90)
    
    # 3. Obtener Movimientos para ADU en ese rango
    demand_movs = db.query(
        DBMovimientoStock.codigo,
        DBMovimientoStock.fecha,
        DBMovimientoStock.cantidad
    ).filter(
        DBMovimientoStock.codigo.in_(all_codes),
        (DBMovimientoStock.tipo_movimiento.ilike('%CONSUMO%')) | 
        (DBMovimientoStock.tipo_movimiento.ilike('%VENTA%')),
        DBMovimientoStock.fecha >= min_date,
        DBMovimientoStock.fecha <= max_date
    ).all()
    
    # Agrupar diaria
    sku_daily = defaultdict(lambda: defaultdict(float))
    for code, d, qty in demand_movs:
        sku_daily[code.lstrip('0')][d] += qty
        
    safety_stocks = {}
    for code in all_codes:
        daily_values = []
        curr = min_date
        while curr <= max_date:
            val = max(0, sku_daily[code].get(curr, 0))
            daily_values.append(val)
            curr += timedelta(days=1)
            
        adu = sum(daily_values) / len(daily_values) if daily_values else 0
        std_dev = statistics.stdev(daily_values) if len(daily_values) > 1 else 0
        cov = (std_dev / adu) if adu > 0 else 0
        
        # Lógica DDMRP (Replica frontend)
        lead_time = sku_lead_times[code]
        ltf = 0.2
        
        vf = 0.7
        if cov <= 0.5: vf = 0.2
        elif cov < 0.8: vf = 0.4
        
        red_base = adu * lead_time * ltf
        red_alert = adu * lead_time * vf
        safety_stocks[code] = red_base + red_alert
        
    return safety_stocks

def get_initial_stock(db: Session, sku: str, target_warehouses: Optional[List[str]] = None) -> Tuple[float, Dict[str, float]]:
    """
    Obtiene el stock inicial detallado por centro y almacén.
    Si target_warehouses es provuesto, filtra el stock.
    Retorna: (total_stock, { 'Centro - Almacen': cantidad })
    """
    sku_normalized = sku.lstrip('0') if sku.isdigit() else sku
    
    # 1. Encontrar la última fecha de STOCK para este SKU
    latest_date = db.query(func.max(DBMovimientoStock.fecha)).filter(
        DBMovimientoStock.codigo == sku_normalized,
        (DBMovimientoStock.clase_movimiento == 'STOCK') | (DBMovimientoStock.tipo_movimiento.ilike('%STOCK%'))
    ).scalar()
    
    if not latest_date:
        return 0.0, {}
        
    # 2. Obtener movimientos solo de esa fecha
    results = db.query(
        DBMovimientoStock.centro,
        DBMovimientoStock.almacen,
        func.sum(DBMovimientoStock.cantidad).label('total'),
        DBMovimientoStock.almacen_valido
    ).filter(
        DBMovimientoStock.codigo == sku_normalized,
        (DBMovimientoStock.clase_movimiento == 'STOCK') | (DBMovimientoStock.tipo_movimiento.ilike('%STOCK%')),
        DBMovimientoStock.fecha == latest_date
    ).group_by(DBMovimientoStock.centro, DBMovimientoStock.almacen).all()
    
    breakdown = {}
    total = 0.0
    for c, a, q, valido in results:
        # 3. Filtrar Almacenes "N/A" (vacíos o nulos)
        if not a or str(a).strip().upper() in ['NONE', 'NAN', 'NAT', 'N/A', '']:
            continue
            
        key = f"{str(c).strip()} - {str(a).strip()}"
        
        # Filtro de almacenes (target_warehouses)
        # Normalizar target_warehouses para asegurarnos (ya se hace en main, pero por si acaso)
        is_included = True
        if target_warehouses is not None:
             is_included = key in target_warehouses
             if not is_included:
                 # Debug fallback: intentar matching flexible
                 # Si target_warehouses tiene "2100 - 2118" y key es "2100 - 2118", debería coincidir.
                 # Pero si hay encoding raro...
                 pass

        if is_included:
            # Convertir de kg a toneladas (dividir entre 1000)
            val = (float(q) / 1000.0) if q else 0.0
            total += val
            
            # Guardar metadata (qty + valid status)
            breakdown[key] = {
                "qty": round(val, 2),
                "is_valid": (str(valido).strip().upper() == "OK") if valido else True # Asumir OK si no hay data (legacy)
            }
            
    return total, breakdown
            
    return total, breakdown


def get_demand_out(db: Session, sku: str, start_date: date, end_date: date, procesos_map: Optional[Dict] = None) -> Dict[date, Dict[str, float]]:
    """
    Calcula Demand Out diario = Ventas Proyectadas + Consumos de Producción.
    Retorna: {date: {'VENTA': 100, 'Consumo - Proceso A': 50}}
    """
    # Obtener mapeo de procesos solo si no se provee
    if procesos_map is None:
        procesos_raw = db.query(DBProceso).all()
        procesos_map = {
            str(p.clase_proceso).strip().upper(): p.proceso 
            for p in procesos_raw if p.clase_proceso
        }
    
    sku_normalized = sku.lstrip('0') if sku.isdigit() else sku
    
    demand_by_date = defaultdict(lambda: defaultdict(float))
    
    # 1. Ventas Proyectadas (desde demanda_proyectada)
    ventas = db.query(
        DBDemandaProyectada.fecha,
        func.sum(DBDemandaProyectada.cantidad_diaria).label('total')
    ).filter(
        DBDemandaProyectada.codigo == sku_normalized,
        DBDemandaProyectada.fecha >= start_date,
        DBDemandaProyectada.fecha <= end_date
    ).group_by(DBDemandaProyectada.fecha).all()
    
    for v in ventas:
        if v.total:
            demand_by_date[v.fecha]['VENTA'] += float(v.total)

    # 2. Consumos de Producción (desde plan_produccion WHERE materia_prima = sku)
    # Necesitamos la clase_proceso del plan de producción
    consumos = db.query(
        DBPlanProduccion.fecha,
        DBPlanProduccion.clase_proceso,
        func.sum(DBPlanProduccion.consumo).label('total')
    ).filter(
        DBPlanProduccion.materia_prima == sku_normalized,
        DBPlanProduccion.fecha >= start_date,
        DBPlanProduccion.fecha <= end_date
    ).group_by(DBPlanProduccion.fecha, DBPlanProduccion.clase_proceso).all()
    
    for c in consumos:
        if c.total:
            code = str(c.clase_proceso).strip().upper()
            desc_proceso = procesos_map.get(code, c.clase_proceso or "OTROS")
            key = f"CONSUMO | {desc_proceso}"
            demand_by_date[c.fecha][key] += float(c.total)
    
    return dict(demand_by_date)


def get_supply_in(db: Session, sku: str, start_date: date, end_date: date, procesos_map: Optional[Dict] = None) -> Dict[date, Dict[str, float]]:
    """
    Calcula Supply In diario = Ingresos de Producción.
    Retorna: {date: {'EXTRUSION': 100, 'EMPAQUE': 50}}
    """
    # Obtener mapeo de procesos solo si no se provee
    if procesos_map is None:
        procesos_raw = db.query(DBProceso).all()
        procesos_map = {
            str(p.clase_proceso).strip().upper(): p.proceso 
            for p in procesos_raw if p.clase_proceso
        }
    
    sku_normalized = sku.lstrip('0') if sku.isdigit() else sku
    
    supply_by_date = defaultdict(lambda: defaultdict(float))
    
    # Producción programada (desde plan_produccion WHERE sku = sku)
    produccion = db.query(
        DBPlanProduccion.fecha,
        DBPlanProduccion.clase_proceso,
        func.sum(DBPlanProduccion.programado).label('total')
    ).filter(
        DBPlanProduccion.sku == sku_normalized,
        DBPlanProduccion.fecha >= start_date,
        DBPlanProduccion.fecha <= end_date
    ).group_by(DBPlanProduccion.fecha, DBPlanProduccion.clase_proceso).all()
    
    for p in produccion:
        if p.total:
            code = str(p.clase_proceso).strip().upper()
            clase_desc = procesos_map.get(code, p.clase_proceso or "PRODUCCION")
            supply_by_date[p.fecha][clase_desc] += float(p.total)
    
    return dict(supply_by_date)


def calculate_psoh(
    db: Session,
    sku: str,
    horizon_days: int = 30,
    safety_stock: float = 0,
    target_warehouses: Optional[List[str]] = None
) -> List[Dict]:
    """
    Calcula el PSoH (Projected Stock on Hand) para un SKU.
    """
    today = date.today()
    end_date = today + timedelta(days=horizon_days)
    
    # Obtener mapeo de procesos (opcional pero reduce consultas latentes)
    procesos_raw = db.query(DBProceso).all()
    p_map = {
        str(p.clase_proceso).strip().upper(): p.proceso 
        for p in procesos_raw if p.clase_proceso
    }

    # Obtener datos base (con filtro de almacenes si aplica)
    initial_stock, stock_breakdown = get_initial_stock(db, sku, target_warehouses)
    demand_map = get_demand_out(db, sku, today, end_date, procesos_map=p_map)
    supply_map = get_supply_in(db, sku, today, end_date, procesos_map=p_map)
    
    # Calcular PSoH recursivo
    result = []
    
    # 0. Agregar contexto de ayer (Stock Inicial)
    yesterday = today - timedelta(days=1)
    status_init = 'healthy'
    if initial_stock <= 0: status_init = 'critical'
    elif initial_stock < safety_stock: status_init = 'warning'
    
    result.append({
        'date': str(yesterday),
        'psoh': round(initial_stock, 2),
        'supply_in': 0.0,
        'demand_out': 0.0,
        'status': status_init,
        'supply_breakdown': {},
        'demand_breakdown': {},
        'stock_breakdown': stock_breakdown  # Desglose inicial por centro/almacén
    })

    psoh = initial_stock
    
    for i in range(horizon_days + 1):
        current_date = today + timedelta(days=i)
        
        # Obtener desgloses del día
        curr_supply_map = supply_map.get(current_date, {})
        curr_demand_map = demand_map.get(current_date, {})
        
        # Calcular totales para el PSoH
        supply_in = sum(curr_supply_map.values())
        demand_out = sum(curr_demand_map.values())
        
        # Fórmula: PSoH[t] = PSoH[t-1] + SupplyIn[t] - DemandOut[t]
        psoh = psoh + supply_in - demand_out
        
        # Determinar estado
        if psoh <= 0:
            status = 'critical'
        elif psoh <= safety_stock:
            status = 'warning'
        else:
            status = 'healthy'
        
        result.append({
            'date': str(current_date),
            'psoh': round(psoh, 2),
            'supply_in': round(supply_in, 2),
            'demand_out': round(demand_out, 2),
            'status': status,
            'supply_breakdown': dict(curr_supply_map),
            'demand_breakdown': dict(curr_demand_map)
        })
    
    return result


def get_stockout_alerts(db: Session, horizon_days: int = 30) -> List[Dict]:
    """
    Escanea todos los SKUs de forma ultra-rápida (Bulk) y retorna alertas.
    Optimizado: Pocas consultas pesadas en lugar de miles de consultas ligeras.
    """
    alerts = []
    today = date.today()
    end_date = today + timedelta(days=horizon_days)
    
    try:
        # 1. Pre-cálculo de Safety Stocks (Zona Roja) y Maestro
        safety_stocks_map = get_skus_safety_stocks(db)
        maestro_data = db.query(DBMaestroArticulo.codigo).all()
        all_sku_raw = [m.codigo for m in maestro_data]
        all_sku_norm = [s.lstrip('0') if s.isdigit() else s for s in all_sku_raw]
        sku_to_raw = dict(zip(all_sku_norm, all_sku_raw))
        
        # 2. BULK: Obtener STOCK inicial para todos (Último snapshot)
        latest_stock_date = db.query(func.max(DBMovimientoStock.fecha)).filter(
            (DBMovimientoStock.clase_movimiento == 'STOCK') | (DBMovimientoStock.tipo_movimiento.ilike('%STOCK%'))
        ).scalar()
        
        initial_stocks = defaultdict(float)
        if latest_stock_date:
            stock_results = db.query(
                DBMovimientoStock.codigo,
                func.sum(DBMovimientoStock.cantidad)
            ).filter(
                (DBMovimientoStock.clase_movimiento == 'STOCK') | (DBMovimientoStock.tipo_movimiento.ilike('%STOCK%')),
                DBMovimientoStock.fecha == latest_stock_date
            ).group_by(DBMovimientoStock.codigo).all()
            for c, q in stock_results:
                initial_stocks[c.lstrip('0') if c.isdigit() else c] = float(q)

        # 3. BULK: Obtener Demanda (Proyectada + Consumos)
        # 3a. Demanda Proyectada
        demanda_proj = db.query(
            DBDemandaProyectada.codigo,
            DBDemandaProyectada.fecha,
            func.sum(DBDemandaProyectada.cantidad_diaria)
        ).filter(
            DBDemandaProyectada.fecha >= today,
            DBDemandaProyectada.fecha <= end_date
        ).group_by(DBDemandaProyectada.codigo, DBDemandaProyectada.fecha).all()
        
        # 3b. Consumos de Producción
        consumos_prod = db.query(
            DBPlanProduccion.materia_prima,
            DBPlanProduccion.fecha,
            func.sum(DBPlanProduccion.consumo)
        ).filter(
            DBPlanProduccion.fecha >= today,
            DBPlanProduccion.fecha <= end_date
        ).group_by(DBPlanProduccion.materia_prima, DBPlanProduccion.fecha).all()
        
        demand_bulk = defaultdict(lambda: defaultdict(float))
        for c, f, q in demanda_proj: demand_bulk[c.lstrip('0') if c.isdigit() else c][f] += float(q)
        for c, f, q in consumos_prod: demand_bulk[c.lstrip('0') if c.isdigit() else c][f] += float(q)

        # 4. BULK: Obtener Supply (Ingresos de Producción)
        supply_prod = db.query(
            DBPlanProduccion.sku,
            DBPlanProduccion.fecha,
            func.sum(DBPlanProduccion.programado)
        ).filter(
            DBPlanProduccion.fecha >= today,
            DBPlanProduccion.fecha <= end_date
        ).group_by(DBPlanProduccion.sku, DBPlanProduccion.fecha).all()
        
        supply_bulk = defaultdict(lambda: defaultdict(float))
        for s, f, q in supply_prod: supply_bulk[s.lstrip('0') if s.isdigit() else s][f] += float(q)

        # 5. Loop de Procesamiento en memoria
        for sku_norm in all_sku_norm:
            sku_raw = sku_to_raw[sku_norm]
            safety_stock = safety_stocks_map.get(sku_norm, 0)
            initial_stock = initial_stocks[sku_norm]
            
            psoh = initial_stock
            first_stockout = None
            first_warning = None
            
            # Chequeo hoy (ayer en realidad)
            if psoh <= 0: first_stockout = {'date': str(today - timedelta(days=1)), 'psoh': psoh}
            elif psoh <= safety_stock: first_warning = {'date': str(today - timedelta(days=1)), 'psoh': psoh}
            
            # Horizonte
            sku_demand = demand_bulk.get(sku_norm, {})
            sku_supply = supply_bulk.get(sku_norm, {})
            
            for i in range(horizon_days + 1):
                d = today + timedelta(days=i)
                psoh = psoh + sku_supply.get(d, 0) - sku_demand.get(d, 0)
                
                if psoh <= 0 and not first_stockout:
                    first_stockout = {'date': str(d), 'psoh': psoh}
                if psoh <= safety_stock and not first_warning:
                    first_warning = {'date': str(d), 'psoh': psoh}
            
            # Riesgo por Atraso (Simulación simplificada)
            delay_risk = False
            if sku_supply and not first_stockout:
                sorted_dates = sorted(sku_supply.keys())
                f_date = sorted_dates[0]
                f_qty = sku_supply[f_date]
                
                sim_psoh = initial_stock
                for i in range(horizon_days + 1):
                    d = today + timedelta(days=i)
                    d_s = sku_supply.get(d, 0)
                    d_d = sku_demand.get(d, 0)
                    
                    if d == f_date: d_s -= f_qty
                    if d == f_date + timedelta(days=3): d_s += f_qty
                    
                    sim_psoh = sim_psoh + d_s - d_d
                    if sim_psoh < 0:
                        delay_risk = True
                        break
            
            # Agregar a alertas (Usar sku_raw)
            if first_stockout:
                alerts.append({
                    'sku': sku_raw,
                    'type': 'critical',
                    'date': first_stockout['date'],
                    'psoh': round(first_stockout['psoh'], 2),
                    'days_until': (date.fromisoformat(first_stockout['date']) - today).days
                })
            elif delay_risk:
                alerts.append({
                    'sku': sku_raw,
                    'type': 'delay_risk',
                    'date': str(today),
                    'psoh': 0,
                    'days_until': 0
                })
            elif first_warning:
                alerts.append({
                    'sku': sku_raw,
                    'type': 'warning',
                    'date': first_warning['date'],
                    'psoh': round(first_warning['psoh'], 2),
                    'days_until': (date.fromisoformat(first_warning['date']) - today).days
                })

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error bulk alerts: {e}")
        return []

    # Ordenar resultados: Críticos -> Riesgo Atraso -> Advertencia
    type_priority = {'critical': 0, 'delay_risk': 1, 'warning': 2}
    alerts.sort(key=lambda x: (type_priority.get(x['type'], 9), x['days_until']))
    
    return alerts

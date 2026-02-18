/**
 * Servicio de Proyección de Stock (PSoH - Projected Stock on Hand)
 * Calcula el saldo proyectado de inventario día a día.
 * 
 * La demanda mensual se distribuye proporcionalmente entre los días hábiles
 * del mes (Lunes a Sábado). Los Domingos tienen demanda 0.
 */

export interface ProjectionDay {
    date: string;
    psoh: number;
    supply: number;
    demand: number;
    status: 'healthy' | 'warning' | 'critical';
    supply_breakdown?: Record<string, number>;
    demand_breakdown?: Record<string, number>;
    stock_breakdown?: Record<string, number | { qty: number; is_valid: boolean }>;
}

/** Registro de demanda mensual desde Supabase */
export interface MonthlyDemand {
    mes: string;       // Fecha en formato 'YYYY-MM-DD' (primer día del mes)
    cantidad: number;  // Total mensual en toneladas
}

/** Registro de stock desde Supabase */
export interface StockRecord {
    centro: string;
    almacen: string;
    cantidad_stock: number;
    almacen_valido?: string;
}

/** Registro de producción desde Supabase */
export interface ProduccionRecord {
    fecha: string;
    programado?: number;
    consumo?: number;
    clase_proceso?: string;
}

// ============================================================
// Utilidades de Calendario
// ============================================================

/**
 * Calcula el número de días hábiles (Lunes a Sábado) en un mes dado.
 * @param year - Año (ej. 2026)
 * @param month - Mes (1-12)
 * @returns Número de días hábiles en ese mes
 */
export const getWorkingDaysInMonth = (year: number, month: number): number => {
    // Obtener el último día del mes
    const daysInMonth = new Date(year, month, 0).getDate();
    let workingDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
        if (dayOfWeek !== 0) { // Excluir Domingos
            workingDays++;
        }
    }

    return workingDays;
};

/**
 * Verifica si una fecha es día hábil (Lunes a Sábado).
 */
const isWorkingDay = (date: Date): boolean => {
    return date.getDay() !== 0; // 0 = Domingo
};

/**
 * Genera una clave 'YYYY-MM' a partir de un mes y año.
 */
const getMonthKey = (year: number, month: number): string => {
    return `${year}-${String(month).padStart(2, '0')}`;
};

/**
 * Verifica si una fecha pertenece a la última semana del mes (últimos 7 días).
 */
export const isLastWeekOfMonth = (date: Date): boolean => {
    const d = new Date(date);
    const month = d.getMonth();
    const year = d.getFullYear();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return d.getDate() > (lastDay - 7);
};

// ============================================================
// Construcción del Mapa de Demanda Diaria
// ============================================================

/**
 * Convierte un array de demanda mensual en un mapa de demanda diaria.
 * Distribuye la cantidad mensual entre los días hábiles (Lun-Sáb).
 * 
 * @param monthlyDemand - Array de { mes, cantidad } desde Supabase
 * @returns Mapa { 'YYYY-MM-DD': dailyDemandValue }
 */
export const buildDailyDemandMap = (monthlyDemand: MonthlyDemand[]): Record<string, number> => {
    const dailyMap: Record<string, number> = {};

    for (const record of monthlyDemand) {
        if (!record.mes || record.cantidad == null || record.cantidad <= 0) continue;

        // Parsear la fecha del mes (viene como 'YYYY-MM-DD' o 'YYYY-MM-01')
        const parts = record.mes.split('T')[0].split('-');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);

        if (isNaN(year) || isNaN(month)) continue;

        // Calcular días hábiles en el mes
        const workingDays = getWorkingDaysInMonth(year, month);
        if (workingDays === 0) continue;

        // Demanda diaria = total mensual / días hábiles
        const dailyDemand = record.cantidad / workingDays;

        // Asignar a cada día hábil del mes
        const daysInMonth = new Date(year, month, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            if (isWorkingDay(date)) {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                dailyMap[dateStr] = (dailyMap[dateStr] || 0) + dailyDemand;
            }
        }
    }

    return dailyMap;
};

// ============================================================
// Construcción del Mapa de Supply (Producción Programada)
// ============================================================

/**
 * Convierte registros de producción en un mapa diario de supply.
 */
export const buildSupplyMap = (produccion: ProduccionRecord[]): Record<string, { total: number; breakdown: Record<string, number> }> => {
    const supplyMap: Record<string, { total: number; breakdown: Record<string, number> }> = {};

    for (const record of produccion) {
        if (!record.fecha || !record.programado || record.programado <= 0) continue;
        const dateStr = record.fecha.split('T')[0];
        const proceso = record.clase_proceso || 'PRODUCCION';

        if (!supplyMap[dateStr]) {
            supplyMap[dateStr] = { total: 0, breakdown: {} };
        }

        supplyMap[dateStr].total += record.programado;
        supplyMap[dateStr].breakdown[proceso] = (supplyMap[dateStr].breakdown[proceso] || 0) + record.programado;
    }

    return supplyMap;
};

/**
 * Convierte consumos de producción en un mapa diario de demand (por proceso).
 */
export const buildConsumoDemandMap = (consumos: ProduccionRecord[]): Record<string, { total: number; breakdown: Record<string, number> }> => {
    const consumoMap: Record<string, { total: number; breakdown: Record<string, number> }> = {};

    for (const record of consumos) {
        if (!record.fecha || !record.consumo || record.consumo <= 0) continue;
        const dateStr = record.fecha.split('T')[0];
        const proceso = `CONSUMO | ${record.clase_proceso || 'OTROS'}`;

        if (!consumoMap[dateStr]) {
            consumoMap[dateStr] = { total: 0, breakdown: {} };
        }

        consumoMap[dateStr].total += record.consumo;
        consumoMap[dateStr].breakdown[proceso] = (consumoMap[dateStr].breakdown[proceso] || 0) + record.consumo;
    }

    return consumoMap;
};

// ============================================================
// Stock Inicial
// ============================================================

/**
 * Calcula el stock inicial total y su desglose por centro/almacén.
 * Convierte de kg a toneladas (÷1000).
 */
export const calculateInitialStock = (
    stockRecords: StockRecord[],
    targetWarehouses?: string[] | null
): { total: number; breakdown: Record<string, { qty: number; is_valid: boolean }> } => {
    let total = 0;
    const breakdown: Record<string, { qty: number; is_valid: boolean }> = {};

    for (const record of stockRecords) {
        if (!record.almacen || ['NONE', 'NAN', 'N/A', ''].includes(String(record.almacen).trim().toUpperCase())) {
            continue;
        }

        const key = `${String(record.centro).trim()} - ${String(record.almacen).trim()}`;

        // Filtrar por almacenes si se especifican
        if (targetWarehouses && targetWarehouses.length > 0 && !targetWarehouses.includes(key)) {
            continue;
        }

        // Convertir kg a toneladas
        const qty = (record.cantidad_stock || 0) / 1000;
        const isValid = record.almacen_valido
            ? String(record.almacen_valido).trim().toUpperCase() === 'OK'
            : true;

        total += qty;
        breakdown[key] = {
            qty: parseFloat(qty.toFixed(2)),
            is_valid: isValid
        };
    }

    return { total, breakdown };
};

// ============================================================
// Cálculo Principal de PSoH
// ============================================================

/**
 * Calcula el PSoH (Projected Stock on Hand) para un SKU.
 * Combina stock inicial + supply (producción) - demand (ventas + consumos).
 * La demanda mensual se distribuye automáticamente en días hábiles (Lun-Sáb).
 * 
 * @param initialStock - Stock inicial en toneladas
 * @param safetyStock - Zona roja (Safety Stock) en toneladas
 * @param monthlyDemand - Array de demanda mensual desde Supabase
 * @param produccion - Array de producción programada
 * @param consumos - Array de consumos de producción
 * @param horizonDays - Horizonte de proyección en días
 * @param stockBreakdown - Desglose inicial por centro/almacén
 * @param feiFactor - Factor de Estacionalidad e Incremento (FEI)
 */
export const calculateProjection = (
    initialStock: number,
    safetyStock: number,
    monthlyDemand: MonthlyDemand[],
    produccion: ProduccionRecord[],
    consumos: ProduccionRecord[],
    horizonDays: number = 30,
    stockBreakdown?: Record<string, { qty: number; is_valid: boolean }>,
    feiFactor: number = 1.0
): ProjectionDay[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Construir mapas de datos diarios
    const dailyDemandMap = buildDailyDemandMap(monthlyDemand);
    const supplyMap = buildSupplyMap(produccion);
    const consumoDemandMap = buildConsumoDemandMap(consumos);

    const result: ProjectionDay[] = [];
    let psoh = initialStock;

    // Día 0: Stock inicial (ayer)
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = formatDateStr(yesterday);

    let status0: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (psoh <= 0) status0 = 'critical';
    else if (psoh <= safetyStock) status0 = 'warning';

    result.push({
        date: yesterdayStr,
        psoh: parseFloat(psoh.toFixed(2)),
        supply: 0,
        demand: 0,
        status: status0,
        stock_breakdown: stockBreakdown || {}
    });

    // Horizonte: day 0 (hoy) a day N
    for (let i = 0; i <= horizonDays; i++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + i);
        const dateStr = formatDateStr(currentDate);

        // Supply del día
        const daySupply = supplyMap[dateStr] || { total: 0, breakdown: {} };

        // Demand del día = Venta proyectada + Consumos de producción
        let ventaDiaria = dailyDemandMap[dateStr] || 0;
        let feiIncrement = 0;

        // Aplicar FEI si es la última semana del mes y el factor es > 1
        if (feiFactor > 1 && isLastWeekOfMonth(currentDate)) {
            const originalVenta = ventaDiaria;
            ventaDiaria = originalVenta * feiFactor;
            feiIncrement = ventaDiaria - originalVenta;
        }

        const consumoDiario = consumoDemandMap[dateStr] || { total: 0, breakdown: {} };

        const totalDemand = ventaDiaria + consumoDiario.total;
        const totalSupply = daySupply.total;

        // PSoH[t] = PSoH[t-1] + Supply[t] - Demand[t]
        psoh = psoh + totalSupply - totalDemand;

        let status: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (psoh <= 0) status = 'critical';
        else if (psoh <= safetyStock) status = 'warning';

        // Construir breakdown de demanda
        const demandBreakdown: Record<string, number> = {};
        if (ventaDiaria > 0) {
            if (feiIncrement > 0) {
                demandBreakdown['VENTA BASE'] = parseFloat((ventaDiaria - feiIncrement).toFixed(2));
                demandBreakdown['ESTACIONALIDAD (FEI)'] = parseFloat(feiIncrement.toFixed(2));
            } else {
                demandBreakdown['VENTA'] = parseFloat(ventaDiaria.toFixed(2));
            }
        }
        for (const [key, val] of Object.entries(consumoDiario.breakdown)) {
            demandBreakdown[key] = parseFloat(val.toFixed(2));
        }

        result.push({
            date: dateStr,
            psoh: parseFloat(psoh.toFixed(2)),
            supply: parseFloat(totalSupply.toFixed(2)),
            demand: parseFloat(totalDemand.toFixed(2)),
            status,
            supply_breakdown: daySupply.breakdown,
            demand_breakdown: demandBreakdown
        });
    }

    return result;
};

/**
 * Formatea una fecha como 'YYYY-MM-DD' en zona local (sin desfase UTC).
 */
const formatDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

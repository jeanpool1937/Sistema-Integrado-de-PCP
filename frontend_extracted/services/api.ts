import { supabase } from './supabase';

export const api = {
    checkHealth: async (): Promise<boolean> => {
        // Simple check to see if we can reach Supabase
        const { error } = await supabase.from('sap_maestro_articulos').select('count', { count: 'exact', head: true });
        return !error;
    },

    getSystemStatus: async () => {
        // Query counts from all tables to build system status
        const [
            { count: maestro },
            { count: demanda },
            { count: movimientos },
            { count: stock },
            { count: produccion }
        ] = await Promise.all([
            supabase.from('sap_maestro_articulos').select('*', { count: 'exact', head: true }),
            supabase.from('sap_demanda_proyectada').select('*', { count: 'exact', head: true }),
            supabase.from('sap_consumo_movimientos').select('*', { count: 'exact', head: true }),
            supabase.from('sap_stock_mb52').select('*', { count: 'exact', head: true }),
            supabase.from('sap_produccion').select('*', { count: 'exact', head: true })
        ]);

        return {
            maestro: (maestro || 0) > 0,
            demanda: (demanda || 0) > 0,
            movimientos: (movimientos || 0) > 0,
            stock: (stock || 0) > 0,
            produccion: (produccion || 0) > 0
        };
    },

    resetDatabase: async () => {
        // Client-side reset is not allowed for security reasons in this architecture
        // This button should likely be hidden or repurposed
        console.warn("Reset database not supported in client-side mode");
        return { success: false, message: "Not supported" };
    },

    getStats: async () => {
        const { count } = await supabase.from('sap_maestro_articulos').select('*', { count: 'exact', head: true });
        return {
            total_skus: count || 0,
            last_sync: new Date().toISOString() // TODO: Get real last sync from logs/metadata table?
        };
    },

    getMaestro: async (skip = 0, limit = 1000) => {
        const { data, error } = await supabase
            .from('view_tablero_pcp')
            .select('*')
            .range(skip, skip + limit - 1);

        if (error) throw error;
        return { items: data || [] };
    },

    // Upload functions are deprecated as sync is handled by automatic scripts
    uploadFile: async () => {
        throw new Error("Upload functionality is deprecated. Use automatic sync scripts.");
    },

    /**
     * Obtiene la demanda proyectada mensual para un SKU desde Supabase.
     * Retorna registros con { mes, cantidad } para el mes actual y siguiente.
     */
    getDemandaProyectada: async (skuId: string) => {
        const { data, error } = await supabase
            .from('sap_demanda_proyectada')
            .select('mes, cantidad')
            .eq('sku_id', skuId);

        if (error) {
            console.warn('Error fetching demanda proyectada:', error.message);
            return [];
        }
        return data || [];
    },

    /**
     * Obtiene el stock actual (snapshot MB52) para un SKU.
     * Retorna desglose por centro/almacén.
     */
    getStockActual: async (skuId: string) => {
        const { data, error } = await supabase
            .from('sap_stock_mb52')
            .select('centro, almacen, cantidad_stock, almacen_valido')
            .eq('material', skuId);

        if (error) {
            console.warn('Error fetching stock actual:', error.message);
            return [];
        }
        return data || [];
    },

    /**
     * Obtiene la producción programada (supply in) para un SKU en un rango de fechas.
     */
    getProduccionProgramada: async (skuId: string, startDate: string, endDate: string) => {
        const { data, error } = await supabase
            .from('sap_produccion')
            .select('fecha, programado, clase_proceso')
            .eq('sku', skuId)
            .gte('fecha', startDate)
            .lte('fecha', endDate);

        if (error) {
            console.warn('Error fetching produccion:', error.message);
            return [];
        }
        return data || [];
    },

    /**
     * Obtiene consumos de producción (demand out por proceso) donde el SKU es materia prima.
     */
    getConsumoProduccion: async (skuId: string, startDate: string, endDate: string) => {
        const { data, error } = await supabase
            .from('sap_produccion')
            .select('fecha, consumo, clase_proceso')
            .eq('materia_prima', skuId)
            .gte('fecha', startDate)
            .lte('fecha', endDate);

        if (error) {
            console.warn('Error fetching consumo produccion:', error.message);
            return [];
        }
        return data || [];
    },

    /**
     * Obtiene toda la demanda proyectada agregada por mes.
     * Usado por Dashboard y DemandPlanning para visualizar tendencias globales.
     */
    getAllDemanda: async () => {
        const { data, error } = await supabase
            .from('sap_demanda_proyectada')
            .select('sku_id, mes, cantidad, j1, product_group')
            .order('mes', { ascending: true });

        if (error) {
            console.warn('Error fetching all demanda:', error.message);
            return [];
        }
        return data || [];
    },

    /**
     * Obtiene resumen de producción agrupado por mes para el dashboard.
     */
    getProduccionSummary: async () => {
        const { data, error } = await supabase
            .from('sap_produccion')
            .select('material, cantidad_tn, fecha_contabilizacion, clase_orden')
            .gte('fecha_contabilizacion', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
            .order('fecha_contabilizacion', { ascending: true });

        if (error) {
            console.warn('Error fetching produccion summary:', error.message);
            return [];
        }
        return data || [];
    },

    /**
     * Obtiene el historial de consumo (movimientos) agrupado para análisis.
     */
    getConsumoHistory: async () => {
        const { data, error } = await supabase
            .from('sap_consumo_movimientos')
            .select('material_clave, fecha, cantidad_final_tn, tipo2')
            .gte('fecha', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('fecha', { ascending: true })
            .limit(5000);

        if (error) {
            console.warn('Error fetching consumo history:', error.message);
            return [];
        }
        return data || [];
    }
};

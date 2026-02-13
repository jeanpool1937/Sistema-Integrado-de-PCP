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
    // ... existing code ...
    /**
     * Obtiene TODO el historial de consumo (movimientos) para recálculo de ADU.
     * Trae los últimos X días (default 180) con paginación automática.
     */
    getAllMovimientos: async (days: number = 180) => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];

        console.log(`Fetching movements since ${startDateStr}...`);

        let allData: any[] = [];
        let page = 0;
        const pageSize = 2000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('sap_consumo_movimientos')
                .select('material_clave, fecha, cantidad_final_tn, tipo2')
                .gte('fecha', startDateStr)
                .order('fecha', { ascending: true })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                console.error('Error fetching consumption history:', error);
                throw error;
            }

            if (data && data.length > 0) {
                allData = [...allData, ...data];
                // If we got less than pageSize, we're done
                if (data.length < pageSize) hasMore = false;
                page++;
            } else {
                hasMore = false;
            }
        }

        console.log(`Fetched ${allData.length} total movements.`);
        return allData;
    },

    getConsumoHistory: async () => {
        // Deprecated but kept for backward compatibility if needed
        // Just calls the new one with smaller window or direct query
        return api.getAllMovimientos(90);
    },

    /**
     * Configuration Methods
     */
    getDistinctGroups: async () => {
        const { data, error } = await supabase
            .from('sap_maestro_articulos')
            .select('grupo_articulos_descripcion')
            .not('grupo_articulos_descripcion', 'is', null);

        if (error) throw error;
        // Unique values
        return [...new Set(data?.map(item => item.grupo_articulos_descripcion))].sort();
    },

    getDistinctTypes: async () => {
        const { data, error } = await supabase
            .from('sap_maestro_articulos')
            .select('tipo_material')
            .not('tipo_material', 'is', null);

        if (error) throw error;
        return [...new Set(data?.map(item => item.tipo_material))].sort();
    },

    getDistinctStatuses: async () => {
        const { data, error } = await supabase
            .from('sap_almacenes_comerciales')
            .select('status')
            .not('status', 'is', null);

        if (error) throw error;
        return [...new Set(data?.map(item => item.status))].sort();
    },

    getStockRules: async () => {
        const { data, error } = await supabase
            .from('sap_config_reglas_stock')
            .select('*');

        if (error) throw error;
        return data || [];
    },

    upsertStockRule: async (grupo: string, tipo: string, statuses: string[]) => {
        const { data, error } = await supabase
            .from('sap_config_reglas_stock')
            .upsert({
                grupo_articulo: grupo,
                tipo_material: tipo,
                status_permitidos: statuses,
                updated_at: new Date().toISOString()
            }, { onConflict: 'grupo_articulo, tipo_material' })
            .select();

        if (error) throw error;
        return data;
    },

    deleteStockRule: async (id: string) => {
        const { error } = await supabase
            .from('sap_config_reglas_stock')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    getMaterialCombinations: async () => {
        const { data, error } = await supabase
            .from('sap_maestro_articulos')
            .select('grupo_articulos_descripcion, tipo_material');

        if (error) throw error;

        // Deduplicate
        const unique = new Map();
        data?.forEach(item => {
            const key = `${item.grupo_articulos_descripcion}|${item.tipo_material}`;
            if (!unique.has(key)) {
                unique.set(key, item);
            }
        });

        return Array.from(unique.values()).sort((a: any, b: any) =>
            a.grupo_articulos_descripcion.localeCompare(b.grupo_articulos_descripcion) ||
            a.tipo_material.localeCompare(b.tipo_material)
        );
    }
};

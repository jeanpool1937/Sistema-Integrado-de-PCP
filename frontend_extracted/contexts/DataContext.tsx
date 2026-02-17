
import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { SKU, ABCClass, XYZClass } from '../types';
import { MOCK_SKUS } from '../constants';
import { api } from '../services/api';

export interface ConsumptionConfig {
  includeVenta: boolean;
  includeConsumo: boolean;
  includeTraspaso: boolean;
}

export interface DataContextType {
  skus: SKU[];
  importData: (file: File) => Promise<void>;
  resetData: () => Promise<void>;
  isLoading: boolean;
  updateSku: (id: string, updates: Partial<SKU>) => void;
  isBackendOnline: boolean;
  checkConnection: () => Promise<void>;
  uploadStatus: { maestro: boolean; demanda: boolean; movimientos: boolean; stock: boolean; produccion: boolean };
  debugLogs: string[];
  consumptionConfig: ConsumptionConfig;
  updateConsumptionConfig: (config: ConsumptionConfig) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [skus, setSkus] = useState<SKU[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({ maestro: false, demanda: false, movimientos: false, stock: false, produccion: false });

  // Raw Data Storage for rapid recalculation
  const [rawAggregatedConsumption, setRawAggregatedConsumption] = useState<any[]>([]);
  const [rawMaestro, setRawMaestro] = useState<any[]>([]);
  const [rawHybridPlanning, setRawHybridPlanning] = useState<any[]>([]);

  // Consumption Configuration
  const [consumptionConfig, setConsumptionConfig] = useState<ConsumptionConfig>({
    includeVenta: true,
    includeConsumo: true,
    includeTraspaso: true
  });

  // Adapter: Converts Supabase View Item to Frontend SKU
  const adaptMaestroToSKU = (item: any, consumptionStats: any = {}, hybridPlanning: Record<string, any> = {}): SKU => {
    // Normalize codigo for matching: remove leading zeros
    const normId = (item.codigo || '').toString().replace(/^0+/, '');
    const stats = consumptionStats[normId] || {};
    const hybrid = hybridPlanning[normId] || {};

    // SOURCE OF TRUTH: Use hybrid planning data if available
    // Otherwise fallback to stats or maestro
    // Monthly history for validation
    const monthlyConsumption = stats.history || [];

    // Metrics from Hybrid Plan (Backend)
    const adu = hybrid.adu_hibrido_final !== undefined ? Number(hybrid.adu_hibrido_final) : (stats.adu !== undefined ? stats.adu : (Number(item.adu) || 0));
    const stdDev = hybrid.desv_std_diaria !== undefined ? Number(hybrid.desv_std_diaria) : (stats.stdDev !== undefined ? stats.stdDev : (Number(item.std_dev_approx) || 0));
    const adu6m = hybrid.adu_mensual_6m !== undefined ? Number(hybrid.adu_mensual_6m) : (stats.adu6m || 0);
    const aduL30d = hybrid.adu_diario_l30d !== undefined ? Number(hybrid.adu_diario_l30d) : 0;
    const fei = hybrid.factor_fin_mes !== undefined ? Number(hybrid.factor_fin_mes) : 1;

    const cov = adu > 0 ? (stdDev / adu) : 0;

    // SOURCE OF TRUTH: Use backend segmentation from hybrid data
    const abc = hybrid.abc_segment || (item.abc || ABCClass.C);
    const xyz = hybrid.xyz_segment || (item.clase || XYZClass.Z);

    // Performance & Pattern Metrics
    const turnover = hybrid.turnover_ratio !== undefined ? Number(hybrid.turnover_ratio) : 0;
    const periods = hybrid.active_months !== undefined ? Number(hybrid.active_months) : 0;

    // 4. Expert DDMRP Buffer Logic (Refined)
    // Usar Lead Time del maestro si existe (>0), sino default 25
    const leadTime = (item.lead_time && item.lead_time > 0) ? item.lead_time : 25;
    const ltf = 0.2;     // Lead Time Factor (LTF) - Adjusted from 0.3

    // Variability Factor (VF) - Expert Tiers
    let vf = 0.7;
    if (cov <= 0.5) vf = 0.2;
    else if (cov < 0.8) vf = 0.4;

    const yellowZone = adu * leadTime;
    const redBase = adu * leadTime * ltf;
    const redAlert = adu * leadTime * vf; // New formula: ADU * LT * VF
    const redTotal = redBase + redAlert;

    const stockLevel = Number((item.stock || 0).toFixed(2));

    // Ponderar SOURCE OF TRUTH vs Cálculo local para SS y ROP
    const safetyStockValue = hybrid.stock_seguridad !== undefined ? Number(hybrid.stock_seguridad) : redTotal;
    const ropValue = hybrid.punto_reorden !== undefined ? Number(hybrid.punto_reorden) : (redTotal + yellowZone);

    return {
      id: item.codigo,
      name: item.descripcion || `Item ${item.codigo}`,
      category: item.grupo_articulos || 'General',
      abc,
      xyz,
      stockLevel,
      safetyStock: parseFloat(safetyStockValue.toFixed(2)),
      rop: parseFloat(ropValue.toFixed(2)),
      leadTime,
      serviceLevelTarget: 0.95,
      cost: 0, // Campo deprecado - no se usa en cálculos
      lifecycleStatus: 'Mature',
      history: [],
      forecast: [],
      alerts: [],
      monthlyConsumption, // Attached history

      // Segmentation fields
      jerarquia1: item.jerarquia_nivel_1 || 'Sin Jerarquía',
      grupoArticulosDesc: item.grupo_articulos_descripcion || 'Sin Grupo',
      tipoMaterial: item.tipo_material || 'N/A',

      adu: parseFloat(adu.toFixed(2)),
      stdDev: parseFloat(stdDev.toFixed(2)),
      variabilityFactor: vf,
      ddmrpZones: {
        yellow: parseFloat(yellowZone.toFixed(2)),
        redBase: parseFloat(redBase.toFixed(2)),
        redAlert: parseFloat(redAlert.toFixed(2)),
        redTotal: parseFloat(redTotal.toFixed(2))
      },
      // Hybrid Metrics Mapping
      adu6m: parseFloat(adu6m.toFixed(2)),
      aduL30d: parseFloat(aduL30d.toFixed(2)),
      fei: parseFloat(fei.toFixed(2)),
      hybridState: hybrid.estado_critico,
      stockActualHybrid: hybrid.stock_actual !== undefined ? Number(hybrid.stock_actual) : undefined,
      // Performance & Pattern Metrics
      turnover: turnover,
      periods: periods,
      rotationSegment: hybrid.rotation_segment as 'High' | 'Medium' | 'Low',
      periodicitySegment: hybrid.periodicity_segment as 'High' | 'Medium' | 'Low',
      procesos: item.procesos || '',
    };
  };

  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20));
  };

  const isFetching = useRef(false);

  const loadData = async () => {
    if (isFetching.current) return;
    isFetching.current = true;
    try {
      const isOnline = await api.checkHealth();
      setIsBackendOnline(isOnline); // Checks Supabase connection now

      if (isOnline) {
        // 1. Fetch System Status
        try {
          const status = await api.getSystemStatus();
          setUploadStatus(status);
        } catch (e: any) {
          console.warn("Status check failed", e);
        }

        // 2. Fetch Pre-calculated Aggregates (DDMR Snapshot)
        try {
          const aggregates = await api.getConsumoAgregado();
          if (aggregates.length > 0) {
            setRawAggregatedConsumption(aggregates);
            addLog(`Consumo agregado cargado: ${aggregates.length} registros`);
          } else {
            // Fallback or warning if no aggregates exist
            console.warn("No aggregated consumption data found. Please trigger DDMR calculation.");
            addLog("Advertencia: No hay datos de consumo pre-calculados.");
          }
        } catch (e: any) {
          console.error("Error loading consumption aggregates", e);
          addLog("Error cargando agregados: " + e.message);
        }

        // 3. Fetch Maestro Data Raw with Pagination
        let allMaestro: any[] = [];
        let mPage = 0;
        const mPageSize = 1000;
        let mHasMore = true;

        while (mHasMore) {
          const mResponse = await api.getMaestro(mPage * mPageSize, mPageSize);
          if (mResponse.items && mResponse.items.length > 0) {
            allMaestro = [...allMaestro, ...mResponse.items];
            if (mResponse.items.length < mPageSize) mHasMore = false;
            mPage++;
          } else {
            mHasMore = false;
          }
        }

        // 4. Fetch Master Hybrid Planning Data
        try {
          const hybridData = await api.getHybridPlanningData();
          if (hybridData.length > 0) {
            setRawHybridPlanning(hybridData);
            addLog(`Planificación híbrida cargada: ${hybridData.length} registros`);
          }
        } catch (e: any) {
          console.warn("Error loading hybrid planning data", e);
          addLog("Error cargando plan híbrido: " + e.message);
        }

        if (allMaestro.length > 0) {
          setRawMaestro(allMaestro);
          addLog(`Maestro cargado: ${allMaestro.length} items`);
        } else {
          console.warn("Maestro load returned 0 items. Falling back to mock data.");
          setSkus(MOCK_SKUS);
          addLog("Maestro vacío: cargando datos de ejemplo.");
        }
      } else {
        console.warn("Backend offline. Loading mock data.");
        setSkus(MOCK_SKUS);
        addLog("Modo offline: Cargados SKUs de ejemplo");
      }
    } catch (e: any) {
      console.error("Critical error in loadData", e);
      addLog(`Error crítico: ${e.message}`);
      setSkus(MOCK_SKUS); // Final fallback to avoid black screen
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  };

  // Recalculate Metrics whenever Aggregates or Maestro changes
  useEffect(() => {
    if (rawMaestro.length === 0) return;

    const calculate = () => {
      // Group aggregates by SKU (they are already grouped by SKU, month, type in the DB)
      const skuAggregates: Record<string, any[]> = {};
      rawAggregatedConsumption.forEach((agg: any) => {
        // Normalize SKU ID: ensure string and remove leading zeros
        const rawId = (agg.sku_id || '').toString();
        const skuId = rawId.replace(/^0+/, '');
        if (!skuAggregates[skuId]) skuAggregates[skuId] = [];
        skuAggregates[skuId].push(agg);
      });

      if (skuAggregates["400011"]) {
        console.log("TRACE 400011: Found in Aggregates", skuAggregates["400011"].length, "records");
      } else {
        console.warn("TRACE 400011: NOT found in Aggregates map keys:", Object.keys(skuAggregates).slice(0, 5));
      }

      const consumptionMap: any = {};

      Object.keys(skuAggregates).forEach(skuId => {
        const items = skuAggregates[skuId];
        const monthlyTotals: Record<string, number> = {};

        items.forEach((item: any) => {
          const type = (item.tipo2 || '').toLowerCase();
          const isVenta = type.includes('venta');
          const isConsumo = type.includes('consumo');
          const isTraspaso = type.includes('traspaso');

          let include = false;
          if (consumptionConfig.includeVenta && isVenta) include = true;
          if (consumptionConfig.includeConsumo && isConsumo) include = true;
          if (consumptionConfig.includeTraspaso && isTraspaso) include = true;

          if (include) {
            const month = item.mes.substring(0, 7); // "YYYY-MM"
            monthlyTotals[month] = (monthlyTotals[month] || 0) + Number(item.cantidad_total_tn);
          }
        });

        // Get last 6 months (up to the previous month)
        const today = new Date();
        const monthsToCheck: string[] = [];
        for (let i = 6; i >= 1; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const monthStr = `${yyyy}-${mm}`;
          monthsToCheck.push(monthStr);
        }

        const values = monthsToCheck.map(m => monthlyTotals[m] || 0);
        const sum = values.reduce((a, b) => a + b, 0);
        const avgMonthly = sum / 6;
        const adu = avgMonthly / 30;

        if (skuId === "400011") {
          console.log("TRACE 400011: Details", { monthsToCheck, values, sum, adu });
        }

        const mean = avgMonthly;
        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / 6;
        const monthlyStdDev = Math.sqrt(variance);
        const dailyStdDev = monthlyStdDev / Math.sqrt(30);

        consumptionMap[skuId] = {
          adu,
          adu6m: adu, // Local calculation of 6m ADU
          stdDev: dailyStdDev,
          history: monthsToCheck.map((m, i) => ({ month: m, quantity: values[i] }))
        };
      });

      // Build Hybrid Planning Map for fast lookup
      const hybridMap: Record<string, any> = {};
      console.log(`Building hybridMap from ${rawHybridPlanning.length} items`);
      rawHybridPlanning.forEach((item, idx) => {
        const sid = (item.sku_id || '').toString().replace(/^0+/, '');
        if (sid === "400011") console.log("DEBUG 400011 in rawHybridPlanning:", item);
        hybridMap[sid] = item;
      });
      console.log("HybridMap Keys for 400011:", hybridMap["400011"] ? "FOUND" : "NOT FOUND");

      try {
        const realSkus = rawMaestro.map((item: any) => adaptMaestroToSKU(item, consumptionMap, hybridMap));

        // Debug specific problematic SKU
        const traceSku = realSkus.find(s => s.id === "400011");
        if (traceSku) {
          console.log("TRACE 400011: Mapped Metrics", {
            id: traceSku.id,
            adu6m: traceSku.adu6m,
            aduL30d: traceSku.aduL30d,
            adu: traceSku.adu
          });
        }

        setSkus(realSkus);
        addLog("Motor Híbrido: Métricas sincronizadas con Master Plan");
      } catch (err: any) {
        console.error("Crash during metrics calculation:", err);
        addLog("Error en cálculo: " + err.message);
        // Don't crash the whole app, keep previous skus or mock?
        if (skus.length === 0) setSkus(MOCK_SKUS);
      }
    };

    calculate();
  }, [rawAggregatedConsumption, rawMaestro, rawHybridPlanning, consumptionConfig]);

  useEffect(() => {
    addLog("Iniciando DataProvider...");
    loadData();
    const interval = setInterval(() => loadData(), 60000); // Polling cada 60s para estabilidad
    return () => clearInterval(interval);
  }, []);

  const importData = async (file: File) => {
    alert("La carga manual ha sido deshabilitada. Los datos se sincronizan automáticamente desde OneDrive cada mañana.");
    addLog("Intento de carga manual bloqueado (Feature Deprecated)");
  };

  const resetData = async () => {
    alert("El reinicio de base de datos no está permitido en la versión web/conectada. Contacte al administrador si requiere re-sincronización total.");
  };

  const updateSku = (id: string, updates: Partial<SKU>) => {
    setSkus(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const checkConnection = async () => {
    await loadData();
  };

  const updateConsumptionConfig = (newConfig: ConsumptionConfig) => {
    setConsumptionConfig(newConfig);
  };


  return (
    <DataContext.Provider value={{
      skus,
      importData,
      resetData,
      isLoading,
      updateSku,
      isBackendOnline,
      checkConnection,
      uploadStatus,
      debugLogs,
      consumptionConfig,
      updateConsumptionConfig,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};

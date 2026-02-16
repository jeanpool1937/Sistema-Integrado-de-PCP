
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
  triggerDDMR: () => Promise<void>;
  isCalculatingDdmr: boolean;
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
  const [isCalculatingDdmr, setIsCalculatingDdmr] = useState(false);

  // Consumption Configuration
  const [consumptionConfig, setConsumptionConfig] = useState<ConsumptionConfig>({
    includeVenta: true,
    includeConsumo: true,
    includeTraspaso: true
  });

  // Adapter: Converts Supabase View Item to Frontend SKU
  const adaptMaestroToSKU = (item: any, consumptionStats: any = {}): SKU => {
    // Normalize codigo for matching: remove leading zeros
    const normId = (item.codigo || '').toString().replace(/^0+/, '');
    const stats = consumptionStats[normId] || {};
    // Use calculated ADU/StdDev if available, otherwise fallback to view data
    const adu = stats.adu !== undefined ? stats.adu : (Number(item.adu) || 0);
    const stdDev = stats.stdDev !== undefined ? stats.stdDev : (Number(item.std_dev_approx) || 0);

    // Monthly history for validation
    const monthlyConsumption = stats.history || [];

    const cov = adu > 0 ? (stdDev / adu) : 0;

    // 2. Real ABC Classification (Heuristic based on ADU volume)
    let abc = ABCClass.C;
    if (adu > 20) abc = ABCClass.A;
    else if (adu > 5) abc = ABCClass.B;

    // 3. Real XYZ Classification (Based on CoV / Variability)
    let xyz = XYZClass.Z;
    if (cov <= 0.3) xyz = XYZClass.X;
    else if (cov <= 0.8) xyz = XYZClass.Y;

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

    return {
      id: item.codigo,
      name: item.descripcion || `Item ${item.codigo}`,
      category: item.grupo_articulos || 'General',
      abc,
      xyz,
      stockLevel,
      safetyStock: redTotal,
      rop: redTotal + yellowZone,
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
      }
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
          stdDev: dailyStdDev,
          history: monthsToCheck.map((m, i) => ({ month: m, quantity: values[i] }))
        };
      });

      try {
        const realSkus = rawMaestro.map((item: any) => adaptMaestroToSKU(item, consumptionMap));
        setSkus(realSkus);
        addLog("Recálculo de métricas completado");
      } catch (err: any) {
        console.error("Crash during metrics calculation:", err);
        addLog("Error en cálculo: " + err.message);
        // Don't crash the whole app, keep previous skus or mock?
        if (skus.length === 0) setSkus(MOCK_SKUS);
      }
    };

    calculate();
  }, [rawAggregatedConsumption, rawMaestro, consumptionConfig]);

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

  const triggerDDMR = async () => {
    setIsCalculatingDdmr(true);
    addLog("Iniciando actualización masiva DDMR (Snapshot)");
    try {
      const result = await api.triggerDDMRUpdate(12); // horizonte de 12 meses
      addLog(`DDMR Actualizado: ${result.message} (${result.rows_processed} filas)`);
      await loadData(); // Refrescar agregados cargados
    } catch (e: any) {
      addLog(`Error en DDMR: ${e.message}`);
      alert("Error al ejecutar DDMR: " + e.message);
    } finally {
      setIsCalculatingDdmr(false);
    }
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
      triggerDDMR,
      isCalculatingDdmr
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

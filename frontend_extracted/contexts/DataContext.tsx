
import React, { createContext, useContext, useState, useEffect } from 'react';
import { SKU, ABCClass, XYZClass } from '../types';
import { MOCK_SKUS } from '../constants';
import { api } from '../services/api';

interface DataContextType {
  skus: SKU[];
  importData: (file: File) => Promise<void>;
  resetData: () => void;
  isLoading: boolean;
  updateSku: (id: string, updates: Partial<SKU>) => void;
  isBackendOnline: boolean;
  checkConnection: () => Promise<void>;
  uploadStatus: { maestro: boolean; demanda: boolean; movimientos: boolean; stock: boolean; produccion: boolean };
  debugLogs: string[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [skus, setSkus] = useState<SKU[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({ maestro: false, demanda: false, movimientos: false, stock: false, produccion: false });

  // Adapter: Converts Supabase View Item to Frontend SKU
  const adaptMaestroToSKU = (item: any, consumptionStats: any = {}): SKU => {
    // 1. Stats from Consumption History (Preferred) or View (Fallback)
    const stats = consumptionStats[item.codigo] || {};
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

  const loadData = async () => {
    // setIsLoading(true); // Don't block UI on background refresh
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

        // 2. Fetch Consumption History & Calculate Metrics
        let consumptionMap: any = {};
        try {
          const movements = await api.getAllMovimientos(210); // Fetch last 7 months to be safe for 6 full months
          if (movements.length > 0) {
            // Group by SKU
            const skuMovements: Record<string, any[]> = {};
            movements.forEach((m: any) => {
              if (!skuMovements[m.material_clave]) skuMovements[m.material_clave] = [];
              skuMovements[m.material_clave].push(m);
            });

            // Calculate stats for each SKU
            Object.keys(skuMovements).forEach(skuId => {
              const movs = skuMovements[skuId];
              // Group by YYYY-MM
              const monthlyTotals: Record<string, number> = {};
              movs.forEach((m: any) => {
                const month = m.fecha.substring(0, 7); // "2024-08"
                // Include Venta, Consumo, Traspaso (assuming positive is usage)
                // User mentioned Traspaso should be included.
                const qty = Number(m.cantidad_final_tn);
                monthlyTotals[month] = (monthlyTotals[month] || 0) + qty;
              });

              // Get last 6 months (excluding current)
              const today = new Date();
              const monthsToCheck: string[] = [];
              for (let i = 1; i <= 6; i++) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const monthStr = d.toISOString().substring(0, 7);
                monthsToCheck.push(monthStr);
              }

              const values = monthsToCheck.map(m => monthlyTotals[m] || 0);

              // Avg Monthly
              const sum = values.reduce((a, b) => a + b, 0);
              const avgMonthly = sum / 6;

              // ADU = AvgMonthly / 30
              const adu = avgMonthly / 30;

              // Monthly StdDev
              const mean = avgMonthly;
              const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / 6;
              const monthlyStdDev = Math.sqrt(variance);

              // Daily StdDev = Monthly / sqrt(30)
              const dailyStdDev = monthlyStdDev / Math.sqrt(30);

              consumptionMap[skuId] = {
                adu,
                stdDev: dailyStdDev,
                history: monthsToCheck.map((m, i) => ({ month: m, quantity: values[i] }))
              };
            });
            addLog(`Cálculos realizados sobre ${Object.keys(skuMovements).length} SKUs con movimiento`);
          }
        } catch (e: any) {
          console.error("Error calculating consumption metrics", e);
          addLog("Error calculando métricas de consumo: " + e.message);
        }

        // 3. Fetch Maestro Data from View (merged with calcs)
        const response = await api.getMaestro(0, 1000);
        if (response.items && response.items.length > 0) {
          const realSkus = response.items.map((item: any) => adaptMaestroToSKU(item, consumptionMap));
          // Simple diff to avoid re-renders if same count and first ID
          if (realSkus.length !== skus.length || (realSkus.length > 0 && realSkus[0].id !== skus[0]?.id)) {
            setSkus(realSkus);
            addLog(`Datos actualizados: ${realSkus.length} SKUs desde Supabase`);
          }
        } else {
          if (skus.length > 0) setSkus([]);
        }
      }
    } catch (e: any) {
      console.warn("Error loading data", e);
      addLog(`Error carga: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    addLog("Iniciando DataProvider...");
    loadData();
    const interval = setInterval(() => loadData(), 15000);
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

  return (
    <DataContext.Provider value={{ skus, importData, resetData, isLoading, updateSku, isBackendOnline, checkConnection, uploadStatus, debugLogs }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};

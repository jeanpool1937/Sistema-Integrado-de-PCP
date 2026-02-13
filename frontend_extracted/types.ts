
export enum ABCClass {
  A = 'A',
  B = 'B',
  C = 'C',
}

export enum XYZClass {
  X = 'X', // Estable
  Y = 'Y', // Variable
  Z = 'Z', // Volátil
}

export interface SKU {
  id: string;
  name: string;
  category: string; // grupo_articulos_codigo
  abc: ABCClass;
  xyz: XYZClass;
  stockLevel: number;
  safetyStock: number;
  rop: number; // Reorder Point
  leadTime: number; // Days
  serviceLevelTarget: number; // 0.95, 0.99 etc
  cost: number;
  lifecycleStatus: 'New' | 'Mature' | 'End of Life';
  forecast: number[]; // Next 6 months
  history: { date: string; value: number }[]; // Past 6 months
  alerts: string[];

  // Segmentation fields from Maestro
  jerarquia1: string;          // Jerarquía Nivel 1 (e.g., "Barras de Constr.", "Clavos")
  grupoArticulosDesc: string;  // Grupo Artículos Descripción (e.g., "BARRA CONSTRUCCIÓN NTC")
  tipoMaterial: string;        // Tipo Material (e.g., "FERT", "HALB")

  // DDMRP Specifics
  adu: number;
  stdDev: number;
  variabilityFactor: number;
  ddmrpZones: {
    yellow: number;
    redBase: number;
    redAlert: number;
    redTotal: number;
  };
}

export interface ForecastDataPoint {
  month: string;
  history: number | null;
  forecastStat: number | null;
  forecastAI: number | null;
  cleanedHistory: number | null;
}

export interface DatabaseStats {
  totalSkus: number;
  lastSync: string;
  dataHealth: number; // 0-100
  totalValue: number;
}

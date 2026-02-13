import { SKU, ABCClass, XYZClass } from './types';

const CATEGORIES = ['Electrónica', 'Mecánica', 'Plásticos', 'Embalaje', 'Químicos'];
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Helper to generate random integer
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

// Helper to generate representative 500 SKUs
export const generateSKUs = (count: number): SKU[] => {
  return Array.from({ length: count }, (_, i) => {
    const id = `SKU-${(1000 + i).toString()}`;
    const category = CATEGORIES[randomInt(0, CATEGORIES.length - 1)];

    // Assign ABC/XYZ based on a probability distribution to mimic reality
    const abcRand = Math.random();
    const abc = abcRand < 0.2 ? ABCClass.A : abcRand < 0.5 ? ABCClass.B : ABCClass.C;

    const xyzRand = Math.random();
    const xyz = xyzRand < 0.4 ? XYZClass.X : xyzRand < 0.7 ? XYZClass.Y : XYZClass.Z;

    const leadTime = randomInt(5, 45);
    const avgDemand = randomInt(50, 5000);
    const variability = xyz === XYZClass.X ? 0.1 : xyz === XYZClass.Y ? 0.3 : 0.6;



    // Original simplified formula removed in favor of DDMRP logic below

    // Simulate history as {date, value}[]
    const today = new Date();
    const history = Array.from({ length: 6 }, (_, idx) => {
      const d = new Date(today);
      d.setMonth(d.getMonth() - (6 - idx));
      return { date: d.toISOString().split('T')[0], value: Math.floor(avgDemand * (1 + (Math.random() - 0.5) * variability)) };
    });
    const forecast = Array.from({ length: 6 }, () => Math.floor(avgDemand * (1 + (Math.random() - 0.5) * variability)));

    // DDMRP Calculations
    const adu = Math.floor(avgDemand / 30); // Average Daily Usage
    const historyStdDev = avgDemand * variability * 0.2; // Mock std dev (20% of var)
    const stdDev = parseFloat(historyStdDev.toFixed(2));
    const cov = stdDev / (adu || 1);

    // Variability Factor Logic
    let vf = 0.7;
    if (cov <= 0.5) vf = 0.2;
    else if (cov < 0.8) vf = 0.4;

    // Zone Calculations
    // Zona Amarilla = ADU x Lead time
    const yellowZone = Math.floor(adu * leadTime);

    // Base Roja = ADU x Lead time x Lead Time Factor (0.3 typically, using 0.3 as default)
    const ltf = 0.3;
    const redBase = Math.floor(adu * leadTime * ltf);

    // Alerta Roja = ADU x Variability Factor (VF)
    const redAlert = Math.floor(adu * vf);

    // Zona Roja Total = Base Roja + Alerta Roja
    const redTotal = redBase + redAlert;

    // Safety Stock is effectively the Red Zone in DDMRP often, or close to it. 
    // Updating mock safety stock to match DDMRP Red Total for consistency
    const safetyStock = redTotal;
    const rop = redTotal + yellowZone; // Reorder Point usually Top of Yellow

    const stockLevel = randomInt(0, rop * 1.5);

    const alerts = [];
    if (stockLevel < redTotal) alerts.push('Stock Crítico (Zona Roja)');
    if (stockLevel > rop + yellowZone) alerts.push('Exceso (Zona Verde)');

    return {
      id,
      name: `${category} Componente ${i + 1}`,
      category,
      abc,
      xyz,
      stockLevel,
      safetyStock,
      rop,
      leadTime,
      serviceLevelTarget: abc === ABCClass.A ? 0.99 : 0.95,
      cost: randomInt(1, 500),
      lifecycleStatus: i < 20 ? 'New' : i > 480 ? 'End of Life' : 'Mature',
      history,
      forecast,
      alerts,

      // Segmentation fields (mock)
      jerarquia1: category,
      grupoArticulosDesc: `Grupo ${category}`,
      tipoMaterial: 'FERT',

      adu,
      stdDev,
      variabilityFactor: vf,
      ddmrpZones: {
        yellow: yellowZone,
        redBase: redBase,
        redAlert: redAlert,
        redTotal: redTotal
      }
    };
  });
};

export const MOCK_SKUS = generateSKUs(500);

// Data for Forecast Chart
export const FORECAST_CHART_DATA = [
  { month: 'Ene', history: 1200, forecastStat: null, forecastAI: null, cleanedHistory: 1200 },
  { month: 'Feb', history: 1350, forecastStat: null, forecastAI: null, cleanedHistory: 1300 }, // outlier in history
  { month: 'Mar', history: 1100, forecastStat: null, forecastAI: null, cleanedHistory: 1100 },
  { month: 'Abr', history: 1250, forecastStat: null, forecastAI: null, cleanedHistory: 1250 },
  { month: 'May', history: 1400, forecastStat: null, forecastAI: null, cleanedHistory: 1400 },
  { month: 'Jun', history: 1300, forecastStat: null, forecastAI: null, cleanedHistory: 1300 },
  { month: 'Jul', history: null, forecastStat: 1320, forecastAI: 1350, cleanedHistory: null },
  { month: 'Ago', history: null, forecastStat: 1340, forecastAI: 1420, cleanedHistory: null },
  { month: 'Sep', history: null, forecastStat: 1300, forecastAI: 1500, cleanedHistory: null }, // Seasonal spike detected by AI
  { month: 'Oct', history: null, forecastStat: 1280, forecastAI: 1380, cleanedHistory: null },
];

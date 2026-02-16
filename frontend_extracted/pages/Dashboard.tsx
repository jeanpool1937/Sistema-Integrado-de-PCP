
import React, { useState, useEffect } from 'react';
import { StatCard } from '../components/StatCard';
import { useData } from '../contexts/DataContext';
import { SKU } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  Treemap, ComposedChart, Line, Area
} from 'recharts';
import { api } from '../services/api';

interface DashboardProps {
  onViewChange: (view: any) => void;
  filteredSkus: SKU[];
}

import { ServiceLevelDetailModal } from '../components/ServiceLevelDetailModal';
import { CriticalStockDetailModal } from '../components/CriticalStockDetailModal';
import { CoverageDetailModal } from '../components/CoverageDetailModal';
import { ExcessStockDetailModal } from '../components/ExcessStockDetailModal';

const COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6',
  '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4',
  '#84cc16', '#e11d48', '#0ea5e9', '#d946ef', '#64748b'
];

export const Dashboard: React.FC<DashboardProps> = ({ onViewChange, filteredSkus }) => {
  const { skus } = useData();
  const [demandData, setDemandData] = useState<any[]>([]);
  const [showServiceDetail, setShowServiceDetail] = useState(false);
  const [showCriticalDetail, setShowCriticalDetail] = useState(false);
  const [showCoverageDetail, setShowCoverageDetail] = useState(false);
  const [showExcessDetail, setShowExcessDetail] = useState(false);

  useEffect(() => {
    api.getAllDemanda().then(setDemandData).catch(console.error);
  }, []);

  // Computed KPIs from real data
  const criticalStock = filteredSkus.filter(s => s.stockLevel < s.safetyStock).length;
  const excessStock = filteredSkus.filter(s => s.stockLevel > s.rop * 1.5).length;
  const healthyStock = filteredSkus.filter(s => s.stockLevel >= s.safetyStock && s.stockLevel <= s.rop * 1.5).length;

  const avgServiceLevel = filteredSkus.length > 0
    ? ((healthyStock / filteredSkus.length) * 100).toFixed(1)
    : '0';

  // Stock coverage (days of stock based on ADU)
  const avgCoverage = filteredSkus.filter(s => s.adu > 0).length > 0
    ? (filteredSkus.filter(s => s.adu > 0).reduce((acc, s) => acc + (s.stockLevel / s.adu), 0) / filteredSkus.filter(s => s.adu > 0).length).toFixed(0)
    : '∞';

  // DDMRP Zone Distribution
  const ddmrpDistribution = [
    { name: 'Zona Roja', value: filteredSkus.filter(s => s.stockLevel < (s.ddmrpZones?.redTotal || 0)).length, fill: '#ef4444' },
    { name: 'Zona Amarilla', value: filteredSkus.filter(s => s.stockLevel >= (s.ddmrpZones?.redTotal || 0) && s.stockLevel < ((s.ddmrpZones?.redTotal || 0) + (s.ddmrpZones?.yellow || 0))).length, fill: '#f59e0b' },
    { name: 'Zona Verde', value: filteredSkus.filter(s => s.stockLevel >= ((s.ddmrpZones?.redTotal || 0) + (s.ddmrpZones?.yellow || 0))).length, fill: '#22c55e' },
  ];

  // Inventory Health
  const inventoryHealth = [
    { name: 'Crítico (< SS)', value: criticalStock, fill: '#ef4444' },
    { name: 'Exceso (> 1.5x ROP)', value: excessStock, fill: '#3b82f6' },
    { name: 'Saludable', value: healthyStock, fill: '#22c55e' },
  ];

  // Stock by Jerarquía 1
  type JerarquiaGroup = { name: string; stock: number; count: number; critical: number };
  const stockByJerarquia = Object.values<JerarquiaGroup>(
    filteredSkus.reduce((acc, s) => {
      const key = s.jerarquia1 || 'Sin Jerarquía';
      if (!acc[key]) acc[key] = { name: key, stock: 0, count: 0, critical: 0 };
      acc[key].stock += s.stockLevel;
      acc[key].count += 1;
      if (s.stockLevel < s.safetyStock) acc[key].critical += 1;
      return acc;
    }, {} as Record<string, JerarquiaGroup>)
  ).sort((a, b) => b.stock - a.stock).slice(0, 10);

  // Stock by Grupo Artículos
  type GrupoGroup = { name: string; stock: number; count: number };
  const stockByGrupo = Object.values<GrupoGroup>(
    filteredSkus.reduce((acc, s) => {
      const key = s.grupoArticulosDesc || 'Sin Grupo';
      if (!acc[key]) acc[key] = { name: key, stock: 0, count: 0 };
      acc[key].stock += s.stockLevel;
      acc[key].count += 1;
      return acc;
    }, {} as Record<string, GrupoGroup>)
  ).sort((a, b) => b.stock - a.stock).slice(0, 12);

  // Demand by Month (aggregated)
  const demandByMonth = Object.entries(
    (demandData || []).reduce((acc, d) => {
      const mes = d.mes?.substring(0, 7); // YYYY-MM
      if (!mes) return acc;
      if (!acc[mes]) acc[mes] = 0;
      acc[mes] += Number(d.cantidad) || 0;
      return acc;
    }, {} as Record<string, number>)
  ).map(([month, cantidad]) => {
    try {
      const date = new Date(month + '-02'); // Using 02 to avoid timezone shifts to previous month
      return {
        month,
        label: date.toLocaleDateString('es', { month: 'short', year: '2-digit' }),
        cantidad: Math.round(cantidad as number)
      };
    } catch (e) {
      return { month, label: month, cantidad: Math.round(cantidad as number) };
    }
  }).sort((a, b) => a.month.localeCompare(b.month)).slice(-8);

  return (
    <div className="space-y-6">
      {/* Execution Control Header */}
      <div className="flex items-center justify-between bg-dark-900/50 border border-slate-800 p-4 rounded-xl">
        <div>
          <h2 className="text-xl font-bold text-white">Dashboard General</h2>
          <p className="text-xs text-slate-400">Análisis inteligente basado en Hybrid Engine V3.0 (Estabilidad + Reactividad)</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => setShowServiceDetail(true)} className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]">
          <StatCard
            title="Nivel de Servicio"
            value={`${avgServiceLevel}%`}
            trend={`${healthyStock} saludables`}
            trendUp={Number(avgServiceLevel) > 80}
            icon="verified"
            color="bg-indigo-600"
          />
        </div>

        <div onClick={() => setShowCriticalDetail(true)} className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]">
          <StatCard
            title="SKUs Críticos"
            value={criticalStock.toString()}
            trend={`${((criticalStock / (filteredSkus.length || 1)) * 100).toFixed(1)}% del total`}
            trendUp={criticalStock < 50}
            icon="warning"
            color="bg-red-600"
          />
        </div>
        <div onClick={() => setShowCoverageDetail(true)} className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]">
          <StatCard
            title="Cobertura Media"
            value={`${avgCoverage}d`}
            trend="Días de stock promedio"
            trendUp={Number(avgCoverage) > 15}
            icon="schedule"
            color="bg-blue-600"
          />
        </div>
        <div onClick={() => setShowExcessDetail(true)} className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]">
          <StatCard
            title="Exceso Stock"
            value={excessStock.toString()}
            trend={`${((excessStock / (filteredSkus.length || 1)) * 100).toFixed(1)}% del total`}
            trendUp={excessStock < 30}
            icon="inventory_2"
            color="bg-amber-600"
          />
        </div>
      </div>

      {/* Row 2: DDMRP Zone + Inventory Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DDMRP Zone Distribution */}
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-rounded text-indigo-400 text-lg">donut_large</span>
            Distribución DDMRP
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ddmrpDistribution}
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                >
                  {ddmrpDistribution.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                  formatter={(value: number, name: string) => [`${value} SKUs`, name]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px' }}
                  formatter={(value, entry: any) => (
                    <span className="text-slate-300">{value}: <span className="font-bold text-white">{entry.payload.value}</span></span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inventory Health Bar */}
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-rounded text-green-400 text-lg">monitor_heart</span>
            Salud del Inventario
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventoryHealth} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" width={120} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: '#1e293b' }}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Alerts */}
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-6 overflow-hidden flex flex-col">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-rounded text-red-400 text-lg">notifications_active</span>
            Alertas de Stock Crítico
          </h3>
          <div className="space-y-2 flex-1 overflow-auto">
            {filteredSkus.filter(s => s.stockLevel < s.safetyStock).slice(0, 6).map(sku => (
              <div key={sku.id} className="flex items-center justify-between p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg group hover:bg-red-500/20 transition-all">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-rounded text-red-500 text-sm">priority_high</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{sku.id}</p>
                    <p className="text-[10px] text-red-300 truncate">{sku.name} · Stock: {sku.stockLevel.toFixed(1)}</p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 bg-red-600/50 text-white rounded font-bold whitespace-nowrap">
                  {sku.jerarquia1}
                </span>
              </div>
            ))}
            {criticalStock === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <span className="material-symbols-rounded text-4xl mb-2">check_circle</span>
                <p>Sin quiebres detectados</p>
              </div>
            )}
          </div>
          <button
            onClick={() => onViewChange('inventory')}
            className="w-full text-center text-xs text-slate-500 hover:text-white mt-3 pt-3 border-t border-slate-800 transition-colors"
          >
            Ver auditoría completa &rarr;
          </button>
        </div>
      </div>

      {/* Row 3: Segmentation Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock by Jerarquía */}
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-rounded text-blue-400 text-lg">account_tree</span>
            Stock por Jerarquía 1
            <span className="text-xs text-slate-500 font-normal ml-auto">{stockByJerarquia.length} categorías</span>
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockByJerarquia} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()} />
                <YAxis dataKey="name" type="category" width={140} stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <Tooltip
                  cursor={{ fill: '#1e293b' }}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString()} TN`,
                    name === 'stock' ? 'Stock Total' : name === 'critical' ? 'Críticos' : name
                  ]}
                />
                <Bar dataKey="stock" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={18} name="Stock Total" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stock by Grupo Artículos */}
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-rounded text-purple-400 text-lg">category</span>
            Stock por Grupo de Artículos
            <span className="text-xs text-slate-500 font-normal ml-auto">{stockByGrupo.length} grupos</span>
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockByGrupo} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()} />
                <YAxis dataKey="name" type="category" width={170} stroke="#94a3b8" tick={{ fontSize: 9 }} />
                <Tooltip
                  cursor={{ fill: '#1e293b' }}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                  formatter={(value: number) => [`${value.toLocaleString()} TN`, 'Stock']}
                />
                <Bar dataKey="stock" radius={[0, 4, 4, 0]} barSize={16}>
                  {stockByGrupo.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 4: Demand Trend */}
      {demandByMonth.length > 0 && (
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-rounded text-emerald-400 text-lg">trending_up</span>
            Tendencia de Demanda Proyectada (Mensual)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={demandByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                  formatter={(value: number) => [`${value.toLocaleString()} TN`, 'Demanda']}
                />
                <Area type="monotone" dataKey="cantidad" fill="#22c55e" fillOpacity={0.15} stroke="#22c55e" strokeWidth={2} />
                <Bar dataKey="cantidad" fill="#22c55e" opacity={0.6} barSize={30} radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {/* Modals */}
      {showServiceDetail && (
        <ServiceLevelDetailModal
          filteredSkus={filteredSkus}
          onClose={() => setShowServiceDetail(false)}
        />
      )}

      {showCriticalDetail && (
        <CriticalStockDetailModal
          filteredSkus={filteredSkus}
          onClose={() => setShowCriticalDetail(false)}
        />
      )}

      {showCoverageDetail && (
        <CoverageDetailModal
          filteredSkus={filteredSkus}
          onClose={() => setShowCoverageDetail(false)}
        />
      )}

      {showExcessDetail && (
        <ExcessStockDetailModal
          filteredSkus={filteredSkus}
          onClose={() => setShowExcessDetail(false)}
        />
      )}
    </div>
  );
};

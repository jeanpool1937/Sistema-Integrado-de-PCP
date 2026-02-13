
import React, { useState, useEffect, useMemo } from 'react';
import { SKU } from '../types';
import { api } from '../services/api';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ComposedChart, Line, Area, Cell
} from 'recharts';

interface SupplyPlanningProps {
  filteredSkus: SKU[];
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316'];

export const SupplyPlanning: React.FC<SupplyPlanningProps> = ({ filteredSkus }) => {
  const [prodData, setProdData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getProduccionSummary().then(data => {
      setProdData(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Producir resumen mensual
  const productionByMonth = useMemo(() => {
    const grouped: Record<string, number> = {};
    prodData.forEach(d => {
      const date = d.fecha_contabilizacion?.substring(0, 7);
      if (!date) return;
      grouped[date] = (grouped[date] || 0) + (Number(d.cantidad_tn) || 0);
    });
    return Object.entries(grouped)
      .map(([month, cantidad]) => ({
        month,
        label: new Date(month + '-01').toLocaleDateString('es', { month: 'short', year: '2-digit' }),
        cantidad: Math.round(cantidad),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [prodData]);

  // Producción por tipo de orden (clase_orden)
  const productionByClass = useMemo(() => {
    const grouped: Record<string, number> = {};
    prodData.forEach(d => {
      const key = d.clase_orden || 'Sin Clase';
      grouped[key] = (grouped[key] || 0) + (Number(d.cantidad_tn) || 0);
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [prodData]);

  // Top materiales producidos
  const topMaterials = useMemo(() => {
    const grouped: Record<string, { cantidad: number; name: string }> = {};
    prodData.forEach(d => {
      if (!d.material) return;
      if (!grouped[d.material]) grouped[d.material] = { cantidad: 0, name: d.material };
      grouped[d.material].cantidad += Number(d.cantidad_tn) || 0;
    });
    return Object.values(grouped)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 15)
      .map(m => {
        const sku = filteredSkus.find(s => s.id === m.name);
        return { ...m, sku_name: sku?.name || m.name, jerarquia: sku?.jerarquia1 || '-', grupo: sku?.grupoArticulosDesc || '-' };
      });
  }, [prodData, filteredSkus]);

  // KPIs
  const totalProduction = prodData.reduce((acc, d) => acc + (Number(d.cantidad_tn) || 0), 0);
  const uniqueMaterials = new Set(prodData.map(d => d.material)).size;
  const totalOrders = prodData.length;
  const avgPerDay = prodData.length > 0 ? totalProduction / 180 : 0;

  // Capacity Utilization computed from SKU list + production
  const capacityUtilization = useMemo(() => {
    const skusWithDemand = filteredSkus.filter(s => s.adu > 0);
    const totalDailyDemand = skusWithDemand.reduce((acc, s) => acc + s.adu, 0);
    const ratio = avgPerDay > 0 ? (totalDailyDemand / avgPerDay) * 100 : 0;
    return Math.min(ratio, 120);
  }, [filteredSkus, avgPerDay]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400">
        <span className="material-symbols-rounded animate-spin text-4xl mr-3">progress_activity</span>
        Cargando datos de producción...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Producción Total (6M)</p>
          <p className="text-2xl font-bold text-white mt-1">{(totalProduction / 1000).toFixed(0)}K <span className="text-sm text-slate-400">TN</span></p>
        </div>
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Órdenes Procesadas</p>
          <p className="text-2xl font-bold text-white mt-1">{totalOrders.toLocaleString()}</p>
        </div>
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Materiales Únicos</p>
          <p className="text-2xl font-bold text-white mt-1">{uniqueMaterials}</p>
        </div>
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Promedio/Día</p>
          <p className="text-2xl font-bold text-white mt-1">{avgPerDay.toFixed(0)} <span className="text-sm text-slate-400">TN</span></p>
        </div>
      </div>

      {/* Capacity Indicator */}
      <div className="bg-dark-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-rounded text-amber-400 text-lg">speed</span>
          Balance Demanda vs Producción
        </h3>
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">Ratio Demanda/Producción</span>
              <span className={`font-bold ${capacityUtilization > 100 ? 'text-red-400' : capacityUtilization > 85 ? 'text-amber-400' : 'text-green-400'}`}>
                {capacityUtilization.toFixed(1)}%
              </span>
            </div>
            <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${capacityUtilization > 100 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                    capacityUtilization > 85 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                      'bg-gradient-to-r from-green-500 to-green-600'
                  }`}
                style={{ width: `${Math.min(capacityUtilization, 100)}%` }}
              />
            </div>
          </div>
          <div className={`p-3 rounded-lg border ${capacityUtilization > 100 ? 'bg-red-500/10 border-red-500/30' :
              capacityUtilization > 85 ? 'bg-amber-500/10 border-amber-500/30' :
                'bg-green-500/10 border-green-500/30'
            }`}>
            <span className="material-symbols-rounded text-2xl">
              {capacityUtilization > 100 ? 'priority_high' : capacityUtilization > 85 ? 'warning' : 'check_circle'}
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          {capacityUtilization > 100
            ? '⚠️ La demanda diaria supera la capacidad de producción promedio. Considere incrementar turnos o externalizar.'
            : capacityUtilization > 85
              ? '⚡ Producción cerca de capacidad máxima. Prestar atención a cuellos de botella.'
              : '✅ Capacidad de producción suficiente para cubrir la demanda actual.'}
        </p>
      </div>

      {/* Production Trend */}
      <div className="bg-dark-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-rounded text-blue-400 text-lg">factory</span>
          Producción Mensual (Últimos 6 Meses)
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={productionByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                formatter={(value: number) => [`${value.toLocaleString()} TN`, 'Producción']}
              />
              <Area type="monotone" dataKey="cantidad" fill="#3b82f6" fillOpacity={0.15} stroke="transparent" />
              <Bar dataKey="cantidad" fill="#3b82f6" opacity={0.8} barSize={30} radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="cantidad" stroke="#93c5fd" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Production by Order Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-rounded text-purple-400 text-lg">assignment</span>
            Producción por Clase de Orden
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productionByClass} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()} />
                <YAxis type="category" dataKey="name" width={100} stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <Tooltip
                  cursor={{ fill: '#1e293b' }}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                  formatter={(value: number) => [`${value.toLocaleString()} TN`, 'Producción']}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                  {productionByClass.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Produced Materials */}
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-6 overflow-auto max-h-[450px]">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-rounded text-emerald-400 text-lg">leaderboard</span>
            Top 15 Materiales Producidos
          </h3>
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                <th className="pb-2 px-2">#</th>
                <th className="pb-2 px-2">Material</th>
                <th className="pb-2 px-2">Jerarquía</th>
                <th className="pb-2 px-2 text-right">Producido (TN)</th>
              </tr>
            </thead>
            <tbody>
              {topMaterials.map((m, i) => (
                <tr key={m.name} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 px-2 text-xs text-slate-500">{i + 1}</td>
                  <td className="py-2 px-2">
                    <p className="text-xs font-mono text-white">{m.name}</p>
                    <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{m.sku_name}</p>
                  </td>
                  <td className="py-2 px-2">
                    <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded">{m.jerarquia}</span>
                  </td>
                  <td className="py-2 px-2 text-sm text-right font-medium text-white">{m.cantidad.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


import React, { useState, useEffect, useMemo } from 'react';
import { SKU } from '../types';
import { api } from '../services/api';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, BarChart, PieChart, Pie, Cell
} from 'recharts';

interface DemandPlanningProps {
  filteredSkus: SKU[];
  selectedJerarquia: string;
  selectedGrupo: string;
  selectedProceso: string[];
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4'];

export const DemandPlanning: React.FC<DemandPlanningProps> = ({ filteredSkus, selectedJerarquia, selectedGrupo, selectedProceso }) => {
  const [demandData, setDemandData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewBy, setViewBy] = useState<'monthly' | 'j1' | 'grupo'>('monthly');

  useEffect(() => {
    setLoading(true);
    api.getAllDemanda().then(data => {
      setDemandData(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Set de IDs filtrados para búsqueda rápida
  const filteredIds = useMemo(() => new Set(filteredSkus.map(s => s.id)), [filteredSkus]);

  // Filtrar demanda según los filtros globales activos
  const filteredDemand = useMemo(() => {
    return demandData.filter(d => {
      // Si hay filtros activos, el SKU debe estar en la lista de filteredSkus
      if (selectedJerarquia || selectedGrupo || selectedProceso.length > 0) {
        return filteredIds.has(d.sku_id);
      }
      return true;
    });
  }, [demandData, filteredIds, selectedJerarquia, selectedGrupo, selectedProceso]);

  // Demanda por mes
  const demandByMonth = useMemo(() => {
    const grouped: Record<string, number> = {};
    filteredDemand.forEach(d => {
      const mes = d.mes?.substring(0, 7);
      if (!mes) return;
      grouped[mes] = (grouped[mes] || 0) + (Number(d.cantidad) || 0);
    });
    return Object.entries(grouped)
      .map(([month, cantidad]) => ({
        month,
        label: new Date(month + '-01').toLocaleDateString('es', { month: 'short', year: '2-digit' }),
        cantidad: Math.round(cantidad),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredDemand]);

  // Demanda por Jerarquía 1 (top 10)
  const demandByJ1 = useMemo(() => {
    const grouped: Record<string, number> = {};
    filteredDemand.forEach(d => {
      const key = d.j1 || 'Sin Jerarquía';
      grouped[key] = (grouped[key] || 0) + (Number(d.cantidad) || 0);
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredDemand]);

  // Demanda por Product Group (top 12)
  const demandByGrupo = useMemo(() => {
    const grouped: Record<string, number> = {};
    filteredDemand.forEach(d => {
      const key = d.product_group || 'Sin Grupo';
      grouped[key] = (grouped[key] || 0) + (Number(d.cantidad) || 0);
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [filteredDemand]);

  // Stats
  const totalDemand = filteredDemand.reduce((acc, d) => acc + (Number(d.cantidad) || 0), 0);
  const uniqueSkus = new Set(filteredDemand.map(d => d.sku_id)).size;
  const months = new Set(filteredDemand.map(d => d.mes?.substring(0, 7))).size;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400">
        <span className="material-symbols-rounded animate-spin text-4xl mr-3">progress_activity</span>
        Cargando datos de demanda...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Demanda Total</p>
          <p className="text-2xl font-bold text-white mt-1">{(totalDemand / 1000).toFixed(0)}K <span className="text-sm text-slate-400">TN</span></p>
        </div>
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">SKUs con Demanda</p>
          <p className="text-2xl font-bold text-white mt-1">{uniqueSkus}</p>
        </div>
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Horizonte</p>
          <p className="text-2xl font-bold text-white mt-1">{months} <span className="text-sm text-slate-400">meses</span></p>
        </div>
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Promedio/Mes</p>
          <p className="text-2xl font-bold text-white mt-1">{months > 0 ? (totalDemand / months / 1000).toFixed(1) : '0'}K <span className="text-sm text-slate-400">TN</span></p>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center gap-2 bg-dark-900 border border-slate-800 rounded-xl p-2 w-fit">
        {[
          { key: 'monthly', label: 'Por Mes', icon: 'calendar_month' },
          { key: 'j1', label: 'Por Jerarquía', icon: 'account_tree' },
          { key: 'grupo', label: 'Por Grupo', icon: 'category' },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setViewBy(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewBy === key ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
          >
            <span className="material-symbols-rounded text-sm">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Main Chart Area */}
      {viewBy === 'monthly' && (
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-rounded text-emerald-400 text-lg">trending_up</span>
            Demanda Proyectada por Mes
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={demandByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                  formatter={(value: number) => [`${value.toLocaleString()} TN`, 'Demanda']}
                />
                <Area type="monotone" dataKey="cantidad" fill="#22c55e" fillOpacity={0.15} stroke="transparent" />
                <Bar dataKey="cantidad" fill="#22c55e" opacity={0.8} barSize={28} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="cantidad" stroke="#86efac" strokeWidth={2} dot={{ fill: '#22c55e', r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {viewBy === 'j1' && (
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-rounded text-blue-400 text-lg">account_tree</span>
            Demanda por Jerarquía 1
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={demandByJ1} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()} />
                <YAxis type="category" dataKey="name" width={160} stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <Tooltip
                  cursor={{ fill: '#1e293b' }}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                  formatter={(value: number) => [`${value.toLocaleString()} TN`, 'Demanda Total']}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                  {demandByJ1.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {viewBy === 'grupo' && (
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-rounded text-purple-400 text-lg">category</span>
            Demanda por Grupo de Artículos
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={demandByGrupo} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()} />
                <YAxis type="category" dataKey="name" width={180} stroke="#94a3b8" tick={{ fontSize: 9 }} />
                <Tooltip
                  cursor={{ fill: '#1e293b' }}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                  formatter={(value: number) => [`${value.toLocaleString()} TN`, 'Demanda Total']}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                  {demandByGrupo.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top SKUs by Demand */}
      <div className="bg-dark-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-rounded text-amber-400 text-lg">leaderboard</span>
          Top 20 SKUs con Mayor Demanda
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                <th className="pb-3 px-3">#</th>
                <th className="pb-3 px-3">SKU</th>
                <th className="pb-3 px-3">Descripción</th>
                <th className="pb-3 px-3">Jerarquía</th>
                <th className="pb-3 px-3">Grupo</th>
                <th className="pb-3 px-3 text-right">Demanda Total (TN)</th>
                <th className="pb-3 px-3 text-right">Stock Actual</th>
                <th className="pb-3 px-3 text-right">Cobertura</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Aggregate demand by SKU
                const demandBySku: Record<string, number> = {};
                filteredDemand.forEach(d => {
                  demandBySku[d.sku_id] = (demandBySku[d.sku_id] || 0) + (Number(d.cantidad) || 0);
                });
                return Object.entries(demandBySku)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 20)
                  .map(([skuId, demand], idx) => {
                    const sku = filteredSkus.find(s => s.id === skuId);
                    const coverage = sku && sku.adu > 0 ? (sku.stockLevel / sku.adu) : null;
                    return (
                      <tr key={skuId} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 text-xs text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 text-sm font-mono text-white">{skuId}</td>
                        <td className="py-2.5 px-3 text-xs text-slate-300 truncate max-w-[200px]">{sku?.name || '-'}</td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full">{sku?.jerarquia1 || '-'}</span>
                        </td>
                        <td className="py-2.5 px-3 text-[10px] text-slate-400 truncate max-w-[120px]">{sku?.grupoArticulosDesc || '-'}</td>
                        <td className="py-2.5 px-3 text-sm text-right font-medium text-white">{demand.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-sm text-right text-slate-300">{sku ? sku.stockLevel.toFixed(1) : '-'}</td>
                        <td className="py-2.5 px-3 text-right">
                          {coverage !== null ? (
                            <span className={`text-sm font-medium ${coverage < 15 ? 'text-red-400' : coverage < 30 ? 'text-amber-400' : 'text-green-400'}`}>
                              {coverage.toFixed(0)}d
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { api } from '../services/api'; // Ensure api is imported
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const DeviationAnalysisPage: React.FC = () => {
    const { isBackendOnline } = useData();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        production: { plan: any[], real: any[] },
        sales: { plan: any[], real: any[] },
        consumption: { plan: any[], real: any[] }
    } | null>(null);

    const [monthOffset, setMonthOffset] = useState(0); // 0 = Current Month

    const currentMonthLabel = useMemo(() => {
        const date = new Date();
        date.setMonth(date.getMonth() + monthOffset);
        return date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    }, [monthOffset]);

    const monthStr = useMemo(() => {
        const date = new Date();
        date.setMonth(date.getMonth() + monthOffset);
        return date.toISOString().slice(0, 7); // YYYY-MM
    }, [monthOffset]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [prod, sales, cons] = await Promise.all([
                    api.getProductionDeviation(monthStr),
                    api.getSalesDeviation(monthStr),
                    api.getConsumptionDeviation(monthStr)
                ]);
                setData({ production: prod, sales: sales, consumption: cons });
            } catch (e) {
                console.error("Error fetching deviation data", e);
            } finally {
                setLoading(false);
            }
        };

        if (isBackendOnline) {
            fetchData();
        }
    }, [isBackendOnline, monthStr]);

    // Data Processing for Charts
    const productionChartData = useMemo(() => {
        if (!data) return [];
        // Group by 'clase_proceso' (Plan) vs 'clase_orden' (Real - closest equivalent or hardcode map)
        // Ideally we map both to a common "Process Family"
        // Simplified Logic: Total
        const planTotal = data.production.plan.reduce((sum, item) => sum + (Number(item.cantidad_programada) || 0), 0);
        const realTotal = data.production.real.reduce((sum, item) => sum + (Number(item.cantidad_tn) || 0), 0);

        return [
            { name: 'Producción Total (TN)', Plan: Math.round(planTotal), Real: Math.round(realTotal) }
        ];
    }, [data]);

    const salesChartData = useMemo(() => {
        if (!data) return [];
        const planTotal = data.sales.plan.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0); // cantidad in demanda projected
        const realTotal = data.sales.real.reduce((sum, item) => sum + (Number(item.cantidad_final_tn) || 0), 0);
        return [
            { name: 'Ventas Totales (TN)', Plan: Math.round(planTotal), Real: Math.round(realTotal) }
        ];
    }, [data]);

    const deviationExceptions = useMemo(() => {
        if (!data) return [];
        // Combine by SKU to find biggest deviations
        const deviations: any[] = [];
        const skuMap = new Map();

        // 1. Production Plan
        data.production.plan.forEach(p => {
            const skuId = p.sku_produccion; // Make sure this matches field name
            if (!skuMap.has(skuId)) skuMap.set(skuId, { sku: skuId, prodPlan: 0, prodReal: 0 });
            skuMap.get(skuId).prodPlan += (Number(p.cantidad_programada) || 0);
        });

        // 2. Production Real
        data.production.real.forEach(r => {
            const skuId = r.material; // Make sure this matches field name
            if (!skuMap.has(skuId)) skuMap.set(skuId, { sku: skuId, prodPlan: 0, prodReal: 0 });
            skuMap.get(skuId).prodReal += (Number(r.cantidad_tn) || 0);
        });

        skuMap.forEach((val) => {
            const diff = val.prodReal - val.prodPlan;
            const pct = val.prodPlan > 0 ? (diff / val.prodPlan) * 100 : (val.prodReal > 0 ? 100 : 0);
            if (Math.abs(diff) > 10) { // arbitrary threshold to filter noise
                deviations.push({
                    id: val.sku,
                    type: 'Producción',
                    plan: val.prodPlan,
                    real: val.prodReal,
                    diff: diff,
                    pct: pct
                });
            }
        });

        // 3. Sales Logic (Optional to mix in same table or separate)
        // ... (can add similar logic for sales if requested)

        return deviations.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 50); // Top 50
    }, [data]);


    if (loading) return <div className="p-8 text-slate-400">Cargando análisis de desviación...</div>;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-dark-900 border border-slate-700 p-3 rounded-lg shadow-xl">
                    <p className="font-bold text-slate-200 mb-2">{label}</p>
                    {payload.map((p: any) => (
                        <p key={p.name} className="text-sm font-mono" style={{ color: p.color }}>
                            {p.name}: <span className="font-bold">{p.value.toLocaleString()}</span>
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center bg-dark-900/50 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-4">
                    <button onClick={() => setMonthOffset(prev => prev - 1)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
                        <span className="material-symbols-rounded">chevron_left</span>
                    </button>
                    <h2 className="text-xl font-bold text-white min-w-[200px] text-center capitalize">{currentMonthLabel}</h2>
                    <button onClick={() => setMonthOffset(prev => prev + 1)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
                        <span className="material-symbols-rounded">chevron_right</span>
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setMonthOffset(0)} className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700">
                        Mes Actual
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors shadow-lg shadow-primary-600/20 font-medium text-sm">
                        <span className="material-symbols-rounded text-lg">refresh</span>
                        Actualizar DB
                    </button>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-dark-900 border border-slate-800 p-6 rounded-xl shadow-lg">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <span className="material-symbols-rounded text-indigo-400">factory</span>
                        Cumplimiento de Producción (TN)
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={productionChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b', opacity: 0.4 }} />
                                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                <Bar dataKey="Plan" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} animationDuration={1000} />
                                <Bar dataKey="Real" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} animationDuration={1000} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-dark-900 border border-slate-800 p-6 rounded-xl shadow-lg">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <span className="material-symbols-rounded text-pink-400">point_of_sale</span>
                        Cumplimiento de Ventas (TN)
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={salesChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b', opacity: 0.4 }} />
                                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                <Bar dataKey="Plan" fill="#f472b6" radius={[4, 4, 0, 0]} barSize={40} animationDuration={1000} />
                                <Bar dataKey="Real" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} animationDuration={1000} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Exceptions Table */}
            <div className="bg-dark-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="material-symbols-rounded text-amber-500">warning</span>
                        Top Excepciones de Desviación (Producción)
                    </h3>
                    <span className="text-xs text-slate-500">Ordenado por impacto %</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-dark-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                                <th className="p-4 font-bold">Fecha (Ref)</th>
                                <th className="p-4 font-bold text-right">Plan</th>
                                <th className="p-4 font-bold text-right">Ejecutado</th>
                                <th className="p-4 font-bold text-right">Desviación</th>
                                <th className="p-4 font-bold text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {deviationExceptions.map((item, idx) => (
                                <tr key={`${item.id}-${idx}`} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="p-4">
                                        <div className="font-mono font-bold text-slate-200">{item.id}</div>
                                        {/* Ideally fetch description here or map it */}
                                    </td>
                                    <td className="p-4 text-right font-mono text-slate-400">
                                        {item.plan.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-right font-mono text-slate-200">
                                        {item.real.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className={`font-mono font-bold ${item.diff < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                            {item.diff > 0 ? '+' : ''}{item.diff.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-[10px] text-slate-500 text-right">
                                            {item.pct.toFixed(1)}%
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${Math.abs(item.pct) > 20 ? 'text-red-500 border-red-500/30 bg-red-500/10' : 'text-slate-400 border-slate-700 bg-slate-800'}`}>
                                            {Math.abs(item.pct) > 20 ? 'CRÍTICO' : 'NORMAL'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {deviationExceptions.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">
                                        No se encontraron desviaciones significativas para este periodo.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

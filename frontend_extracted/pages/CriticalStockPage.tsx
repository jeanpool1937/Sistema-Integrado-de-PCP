import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { SKU, ABCClass } from '../types';
import { FilterBar } from '../components/FilterBar';

export const CriticalStockPage: React.FC = () => {
    const { skus, isLoading, updateSku } = useData();
    const [filterText, setFilterText] = useState('');
    const [selectedArea, setSelectedArea] = useState('Todos');

    // Derived Logic
    const criticalItems = useMemo(() => {
        return skus.filter(sku => {
            const isCritical = sku.stockLevel <= 0;
            const isRisk = sku.stockLevel > 0 && sku.stockLevel < sku.safetyStock;
            return isCritical || isRisk;
        });
    }, [skus]);

    // Apply UI Filters
    const filteredItems = useMemo(() => {
        return criticalItems.filter(item => {
            const matchText = item.name.toLowerCase().includes(filterText.toLowerCase()) ||
                item.id.includes(filterText);
            const matchArea = selectedArea === 'Todos' || item.category === selectedArea; // Using category as proxy for Area/Process if needed
            return matchText && matchArea;
        });
    }, [criticalItems, filterText, selectedArea]);

    const stats = useMemo(() => {
        const total = filteredItems.length;
        const critical = filteredItems.filter(i => i.stockLevel <= 0).length;
        const risk = total - critical;
        return { total, critical, risk };
    }, [filteredItems]);

    const getStatusColor = (sku: SKU) => {
        if (sku.stockLevel <= 0) return 'text-red-500 bg-red-500/10 border-red-500/20';
        if (sku.stockLevel < sku.safetyStock) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    };

    const getStatusLabel = (sku: SKU) => {
        if (sku.stockLevel <= 0) return 'AGOTADO';
        if (sku.stockLevel < sku.safetyStock) return 'RIESGO';
        return 'OK';
    };

    const calculateDaysCoverage = (sku: SKU) => {
        if (sku.adu <= 0) return 999;
        return (sku.stockLevel / sku.adu).toFixed(1);
    };

    if (isLoading) return <div className="p-8 text-slate-400">Cargando análisis de quiebres...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-dark-800/50 border border-red-900/30 p-4 rounded-xl shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-rounded text-6xl text-red-500">warning</span>
                    </div>
                    <p className="text-slate-400 text-xs uppercase tracking-wider font-bold">Total Críticos</p>
                    <h3 className="text-3xl font-bold text-white mt-1">{stats.critical}</h3>
                    <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                        <span className="material-symbols-rounded text-sm">trending_up</span>
                        Requieren acción inmediata
                    </p>
                </div>

                <div className="bg-dark-800/50 border border-amber-900/30 p-4 rounded-xl shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-rounded text-6xl text-amber-500">notification_important</span>
                    </div>
                    <p className="text-slate-400 text-xs uppercase tracking-wider font-bold">En Riesgo</p>
                    <h3 className="text-3xl font-bold text-white mt-1">{stats.risk}</h3>
                    <p className="text-amber-400 text-xs mt-2 flex items-center gap-1">
                        <span className="material-symbols-rounded text-sm">timelapse</span>
                        Quiebre proyectado &lt; Lead Time
                    </p>
                </div>

                <div className="bg-dark-800/50 border border-slate-700 p-4 rounded-xl shadow-lg relative overflow-hidden group">
                    {/* Placeholder for resolved count or other metric */}
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-rounded text-6xl text-emerald-500">check_circle</span>
                    </div>
                    <p className="text-slate-400 text-xs uppercase tracking-wider font-bold">Resueltos Hoy</p>
                    <h3 className="text-3xl font-bold text-slate-500 mt-1">0</h3>
                    <p className="text-slate-600 text-xs mt-2">Sin actividad reciente</p>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-dark-900/50 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <span className="material-symbols-rounded absolute left-3 top-2.5 text-slate-500">search</span>
                        <input
                            type="text"
                            placeholder="Buscar SKU o descripción..."
                            className="w-full bg-dark-950 border border-slate-700 text-slate-200 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-primary-500 transition-colors"
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                        />
                    </div>
                    <select
                        className="bg-dark-950 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg focus:outline-none focus:border-primary-500"
                        value={selectedArea}
                        onChange={(e) => setSelectedArea(e.target.value)}
                    >
                        <option value="Todos">Todas las Áreas</option>
                        {/* Populate uniquely from skus if needed */}
                        <option value="Materia Prima">Materia Prima</option>
                        <option value="Producto Terminado">Producto Terminado</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors shadow-lg shadow-primary-600/20 font-medium text-sm">
                        <span className="material-symbols-rounded text-lg">send</span>
                        Exportar Alertas
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-dark-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-dark-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                                <th className="p-4 font-bold">SKU / Descripción</th>
                                <th className="p-4 font-bold text-center">Clasificación</th>
                                <th className="p-4 font-bold text-right">Stock Actual</th>
                                <th className="p-4 font-bold text-right">Stock Seguridad</th>
                                <th className="p-4 font-bold text-center">Cobertura (Días)</th>
                                <th className="p-4 font-bold text-center">Estado</th>
                                <th className="p-4 font-bold text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredItems.map(sku => (
                                <tr key={sku.id} className="hover:bg-slate-800/30 transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-10 rounded-full ${sku.stockLevel <= 0 ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                                            <div>
                                                <div className="font-mono text-xs text-slate-500">{sku.id}</div>
                                                <div className="font-medium text-slate-200">{sku.name}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">{sku.jerarquia1} • {sku.grupoArticulosDesc}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
                                            {sku.abc}{sku.xyz}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className={`font-mono font-bold ${sku.stockLevel <= 0 ? 'text-red-400' : 'text-slate-200'}`}>
                                            {sku.stockLevel.toLocaleString()}
                                        </span>
                                        <div className="text-[10px] text-slate-500 text-right">Unidades</div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className="font-mono text-slate-400">
                                            {Math.round(sku.safetyStock).toLocaleString()}
                                        </span>
                                        <div className="text-[10px] text-slate-500 text-right">Meta</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="font-bold text-slate-300">{calculateDaysCoverage(sku)}d</span>
                                            {sku.adu > 0 && (
                                                <span className="text-[10px] text-slate-500">ADU: {sku.adu.toFixed(1)}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(sku)}`}>
                                            {getStatusLabel(sku)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button className="text-slate-400 hover:text-primary-400 transition-colors bg-slate-800 hover:bg-slate-700 p-2 rounded-lg border border-slate-700">
                                            <span className="material-symbols-rounded text-lg">visibility</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <span className="material-symbols-rounded text-4xl text-slate-600">check_circle</span>
                                            <p>No se encontraron SKUs críticos con los filtros actuales.</p>
                                        </div>
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

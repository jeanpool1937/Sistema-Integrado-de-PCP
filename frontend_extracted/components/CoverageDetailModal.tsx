import React, { useState, useMemo } from 'react';
import { SKU } from '../types';

interface CoverageDetailModalProps {
    filteredSkus: SKU[];
    onClose: () => void;
}

type SortKey = 'id' | 'name' | 'stockLevel' | 'adu' | 'adu6m' | 'aduL30d' | 'fei' | 'coverage' | 'status';
type SortDir = 'asc' | 'desc';

export const CoverageDetailModal: React.FC<CoverageDetailModalProps> = ({ filteredSkus, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('coverage');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const calcMonths = useMemo(() => {
        const today = new Date();
        const months: string[] = [];
        for (let i = 6; i >= 1; i--) { // Chronological
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            months.push(d.toLocaleString('es-ES', { month: 'short', year: '2-digit' }).replace('.', ''));
        }
        return months;
    }, []);
    const [coverageFilter, setCoverageFilter] = useState<'all' | 'low' | 'optimal' | 'high' | 'no-demand'>('all');

    // Solo consideramos items con ADU > 0 para el promedio general mostrado en el dashboard
    const skusWithDemand = filteredSkus.filter(s => s.adu > 0);
    const avgCoverage = skusWithDemand.length > 0
        ? (skusWithDemand.reduce((acc, s) => acc + (s.stockLevel / s.adu), 0) / skusWithDemand.length).toFixed(0)
        : '∞';

    const processedSkus = useMemo(() => {
        let result = filteredSkus.filter(s => {
            const matchesSearch = searchTerm === '' ||
                s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.name.toLowerCase().includes(searchTerm.toLowerCase());

            const coverage = s.adu > 0 ? s.stockLevel / s.adu : Infinity;
            let matchesFilter = true;

            if (coverageFilter === 'low') matchesFilter = coverage < 15; // < 15 días (configurable)
            else if (coverageFilter === 'optimal') matchesFilter = coverage >= 15 && coverage <= 45;
            else if (coverageFilter === 'high') matchesFilter = coverage > 45 && s.adu > 0;
            else if (coverageFilter === 'no-demand') matchesFilter = s.adu === 0;

            return matchesSearch && matchesFilter;
        });

        result.sort((a, b) => {
            let valA: number | string;
            let valB: number | string;

            const getCov = (s: SKU) => s.adu > 0 ? s.stockLevel / s.adu : 999999;

            switch (sortKey) {
                case 'id': valA = a.id; valB = b.id; break;
                case 'name': valA = a.name; valB = b.name; break;
                case 'stockLevel': valA = a.stockLevel; valB = b.stockLevel; break;
                case 'adu': valA = a.adu; valB = b.adu; break;
                case 'adu6m': valA = a.adu6m || 0; valB = b.adu6m || 0; break;
                case 'aduL30d': valA = a.aduL30d || 0; valB = b.aduL30d || 0; break;
                case 'fei': valA = a.fei || 1; valB = b.fei || 1; break;
                case 'coverage': valA = getCov(a); valB = getCov(b); break;
                case 'status': valA = getCov(a); valB = getCov(b); break; // Sort by coverage for status
                default: valA = 0; valB = 0;
            }

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
        });

        return result;
    }, [filteredSkus, searchTerm, coverageFilter, sortKey, sortDir]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const SortIcon = ({ column }: { column: SortKey }) => {
        if (sortKey !== column) return <span className="material-symbols-rounded text-[14px] text-slate-600 ml-1">unfold_more</span>;
        return <span className="material-symbols-rounded text-[14px] text-primary-400 ml-1">{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>;
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ animation: 'fadeIn 0.2s ease-out' }}
        >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            <div
                className="relative w-[95vw] max-w-[1400px] h-[90vh] bg-dark-950 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                style={{ animation: 'slideUp 0.25s ease-out' }}
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-800 flex-shrink-0">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
                                    <span className="material-symbols-rounded text-blue-400 text-2xl">schedule</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Análisis de Cobertura</h2>
                                    <p className="text-sm text-slate-400">
                                        Días de stock basados en demanda promedio (ADU) · <span className="text-blue-400 font-semibold">{avgCoverage} días</span> promedio global
                                    </p>
                                </div>
                            </div>

                            {/* Filters */}
                            <div className="flex items-center gap-2 mt-4 text-xs">
                                <button
                                    onClick={() => setCoverageFilter('all')}
                                    className={`px-3 py-1.5 rounded-lg transition-all border ${coverageFilter === 'all' ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-800 text-slate-500 hover:text-white'}`}
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => setCoverageFilter('low')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all border ${coverageFilter === 'low' ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'border-slate-800 text-slate-500 hover:text-red-400'}`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    Baja (&lt;15d)
                                </button>
                                <button
                                    onClick={() => setCoverageFilter('optimal')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all border ${coverageFilter === 'optimal' ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'border-slate-800 text-slate-500 hover:text-green-400'}`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    Óptima (15-45d)
                                </button>
                                <button
                                    onClick={() => setCoverageFilter('high')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all border ${coverageFilter === 'high' ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400' : 'border-slate-800 text-slate-500 hover:text-yellow-400'}`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                    Alta (&gt;45d)
                                </button>
                                <button
                                    onClick={() => setCoverageFilter('no-demand')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all border ${coverageFilter === 'no-demand' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'border-slate-800 text-slate-500 hover:text-slate-300'}`}
                                >
                                    <span className="material-symbols-rounded text-xs">block</span>
                                    Sin Demanda
                                </button>
                            </div>
                        </div>

                        <button onClick={onClose} className="ml-4 p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all">
                            <span className="material-symbols-rounded text-2xl">close</span>
                        </button>
                    </div>

                    <div className="mt-4 relative">
                        <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">search</span>
                        <input
                            type="text"
                            placeholder="Buscar SKU..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-dark-900 border border-slate-700 text-sm text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 placeholder-slate-500 transition-all"
                        />
                    </div>
                </div>

                {/* Formula */}
                <div className="px-8 py-3 bg-slate-800/30 border-b border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="material-symbols-rounded text-sm text-blue-400">function</span>
                        <span className="font-medium text-slate-300">Cobertura:</span>
                        <code className="px-2 py-0.5 bg-slate-800 rounded text-blue-300 font-mono">
                            Stock Actual / ADU
                        </code>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-dark-950 z-10">
                            <tr className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                                <th className="p-4 border-b border-slate-800 cursor-pointer hover:text-white select-none" onClick={() => handleSort('id')}>
                                    <div className="flex items-center">SKU<SortIcon column="id" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 cursor-pointer hover:text-white select-none" onClick={() => handleSort('name')}>
                                    <div className="flex items-center">Descripción<SortIcon column="name" /></div>
                                </th>

                                {/* Dynamic Headers */}
                                {calcMonths.map((m, i) => (
                                    <th key={i} className="p-4 border-b border-slate-800 text-right text-slate-500 font-normal">
                                        {m.charAt(0).toUpperCase() + m.slice(1)}
                                    </th>
                                ))}
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort('stockLevel')}>
                                    <div className="flex items-center justify-end">Stock Actual<SortIcon column="stockLevel" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort('adu6m')} title="Promedio mensual histórico de 6 meses dividido entre 30 días">
                                    <div className="flex items-center justify-end">ADU (6m)<SortIcon column="adu6m" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort('aduL30d')} title="Demanda diaria promedio de los últimos 30 días naturales">
                                    <div className="flex items-center justify-end">ADU (L30d)<SortIcon column="aduL30d" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort('adu')} title="40% Histórico (6m) + 60% Tendencia Reciente (L30d)">
                                    <div className="flex items-center justify-end">ADU Híbrido<SortIcon column="adu" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort('fei')} title="Factor de Estacionalidad e Incremento (Cierre de Mes)">
                                    <div className="flex items-center justify-end">FEI<SortIcon column="fei" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort('coverage')}>
                                    <div className="flex items-center justify-end">Cobertura<SortIcon column="coverage" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-800/50">
                            {processedSkus.map(sku => {
                                const coverage = sku.adu > 0 ? sku.stockLevel / sku.adu : Infinity;
                                let statusColor = 'text-slate-400';
                                let statusLabel = 'Indefinido';
                                let statusBg = 'bg-slate-500/10';

                                if (sku.adu === 0) {
                                    statusLabel = 'Sin Demanda';
                                    statusBg = 'bg-slate-500/10';
                                    statusColor = 'text-slate-500';
                                } else if (coverage < 15) {
                                    statusLabel = 'Baja';
                                    statusBg = 'bg-red-500/10';
                                    statusColor = 'text-red-400';
                                } else if (coverage <= 45) {
                                    statusLabel = 'Óptima';
                                    statusBg = 'bg-green-500/10';
                                    statusColor = 'text-green-400';
                                } else {
                                    statusLabel = 'Alta';
                                    statusBg = 'bg-yellow-500/10';
                                    statusColor = 'text-yellow-400';
                                }

                                return (
                                    <tr key={sku.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4 font-mono text-xs text-white">{sku.id}</td>
                                        <td className="p-4 text-xs text-slate-300">
                                            <div className="truncate max-w-[300px]" title={sku.name}>{sku.name}</div>
                                            <div className="text-[10px] text-slate-500">{sku.jerarquia1}</div>
                                        </td>

                                        {/* Dynamic Monthly Columns */}
                                        {calcMonths.map((m, idx) => {
                                            const val = sku.monthlyConsumption?.[idx]?.quantity || 0;
                                            return (
                                                <td key={idx} className="p-4 text-right">
                                                    <span className={`font-mono text-xs ${val > 0 ? 'text-slate-300' : 'text-slate-600'}`}>
                                                        {val > 0 ? val.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                        <td className="p-4 text-right font-mono text-white">{sku.stockLevel.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                                        <td className="p-4 text-right font-mono text-slate-400 text-[10px]">{(sku.adu6m || 0).toFixed(1)}</td>
                                        <td className="p-4 text-right font-mono text-slate-400 text-[10px]">{(sku.aduL30d || 0).toFixed(1)}</td>
                                        <td className="p-4 text-right font-mono text-slate-300">{(sku.adu || 0).toFixed(1)}</td>
                                        <td className="p-4 text-right font-mono text-indigo-400 text-[10px]">{(sku.fei || 1).toFixed(2)}</td>
                                        <td className="p-4 text-right font-mono text-blue-300">
                                            {coverage === Infinity ? '∞' : coverage.toFixed(1)}d
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${statusBg} ${statusColor}`}>
                                                {statusLabel}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {processedSkus.length === 0 && (
                                <tr>
                                    <td colSpan={12} className="p-12 text-center text-slate-500">
                                        No se encontraron resultados
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-8 py-3 border-t border-slate-800 bg-dark-950 text-xs text-slate-500">
                    Mostrando {processedSkus.length} de {filteredSkus.length} SKUs
                </div>
            </div>
            <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
        </div>
    );
};

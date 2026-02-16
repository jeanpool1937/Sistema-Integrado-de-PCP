import React, { useState, useMemo } from 'react';
import { SKU } from '../types';

interface CriticalStockDetailModalProps {
    filteredSkus: SKU[];
    onClose: () => void;
}

type SortKey = 'id' | 'name' | 'stockLevel' | 'safetyStock' | 'rop' | 'deficit' | 'adu' | 'adu6m' | 'aduL30d' | 'fei' | 'coverage';
type SortDir = 'asc' | 'desc';

export const CriticalStockDetailModal: React.FC<CriticalStockDetailModalProps> = ({ filteredSkus, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('deficit');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [showOnlyCritical, setShowOnlyCritical] = useState(true);

    const calcMonths = useMemo(() => {
        const today = new Date();
        const months: string[] = [];
        for (let i = 6; i >= 1; i--) { // Chronological
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            months.push(d.toLocaleString('es-ES', { month: 'short', year: '2-digit' }).replace('.', ''));
        }
        return months;
    }, []);

    const criticalCount = filteredSkus.filter(s => s.stockLevel < s.safetyStock).length;
    const totalCount = filteredSkus.length;
    const criticalPct = totalCount > 0 ? ((criticalCount / totalCount) * 100).toFixed(1) : '0';

    const processedSkus = useMemo(() => {
        let result = filteredSkus.filter(s => {
            const matchesSearch = searchTerm === '' ||
                s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCritical = showOnlyCritical ? s.stockLevel < s.safetyStock : true;
            return matchesSearch && matchesCritical;
        });

        result.sort((a, b) => {
            let valA: number | string;
            let valB: number | string;

            switch (sortKey) {
                case 'id': valA = a.id; valB = b.id; break;
                case 'name': valA = a.name; valB = b.name; break;
                case 'stockLevel': valA = a.stockLevel; valB = b.stockLevel; break;
                case 'safetyStock': valA = a.safetyStock; valB = b.safetyStock; break;
                case 'rop': valA = a.rop; valB = b.rop; break;
                case 'deficit': valA = a.safetyStock - a.stockLevel; valB = b.safetyStock - b.stockLevel; break;
                case 'adu': valA = a.adu; valB = b.adu; break;
                case 'adu6m': valA = a.adu6m || 0; valB = b.adu6m || 0; break;
                case 'aduL30d': valA = a.aduL30d || 0; valB = b.aduL30d || 0; break;
                case 'fei': valA = a.fei || 1; valB = b.fei || 1; break;
                case 'coverage': valA = a.adu > 0 ? a.stockLevel / a.adu : 9999; valB = b.adu > 0 ? b.stockLevel / b.adu : 9999; break;
                default: valA = 0; valB = 0;
            }

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
        });

        return result;
    }, [filteredSkus, searchTerm, showOnlyCritical, sortKey, sortDir]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir(key === 'deficit' ? 'desc' : 'asc');
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
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div
                className="relative w-[95vw] max-w-[1400px] h-[90vh] bg-dark-950 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                style={{ animation: 'slideUp 0.25s ease-out' }}
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-800 flex-shrink-0">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-red-600/20 flex items-center justify-center">
                                    <span className="material-symbols-rounded text-red-400 text-2xl">warning</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Detalle de SKUs Críticos</h2>
                                    <p className="text-sm text-slate-400">
                                        Stock por debajo del nivel de seguridad · <span className="text-red-400 font-semibold">{criticalCount}</span> de {totalCount} SKUs ({criticalPct}%)
                                    </p>
                                </div>
                            </div>

                            {/* Summary cards */}
                            <div className="flex items-center gap-3 mt-4">
                                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                                    <span className="material-symbols-rounded text-red-500 text-lg">priority_high</span>
                                    <div>
                                        <div className="text-lg font-bold text-red-400">{criticalCount}</div>
                                        <div className="text-[10px] text-red-300/60 uppercase tracking-wider">Críticos</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                                    <span className="material-symbols-rounded text-green-500 text-lg">check_circle</span>
                                    <div>
                                        <div className="text-lg font-bold text-green-400">{totalCount - criticalCount}</div>
                                        <div className="text-[10px] text-green-300/60 uppercase tracking-wider">OK</div>
                                    </div>
                                </div>

                                {/* Toggle */}
                                <button
                                    onClick={() => setShowOnlyCritical(!showOnlyCritical)}
                                    className={`ml-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${showOnlyCritical
                                        ? 'bg-red-500/20 border-red-500/40 text-red-400'
                                        : 'bg-slate-800 border-slate-700 text-slate-300'
                                        }`}
                                >
                                    <span className="material-symbols-rounded text-sm">{showOnlyCritical ? 'filter_alt' : 'filter_alt_off'}</span>
                                    {showOnlyCritical ? 'Solo Críticos' : 'Todos los SKUs'}
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="ml-4 p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
                        >
                            <span className="material-symbols-rounded text-2xl">close</span>
                        </button>
                    </div>

                    {/* Buscador */}
                    <div className="mt-4 relative">
                        <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">search</span>
                        <input
                            type="text"
                            placeholder="Buscar por código SKU o descripción..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-dark-900 border border-slate-700 text-sm text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 placeholder-slate-500 transition-all"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                <span className="material-symbols-rounded text-lg">close</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Fórmula */}
                <div className="px-8 py-3 bg-slate-800/30 border-b border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="material-symbols-rounded text-sm text-red-400">function</span>
                        <span className="font-medium text-slate-300">Condición Crítica:</span>
                        <code className="px-2 py-0.5 bg-slate-800 rounded text-red-300 font-mono">
                            stockActual &lt; stockSeguridad (redTotal DDMRP)
                        </code>
                        <span className="mx-2 text-slate-600">|</span>
                        <span className="font-medium text-slate-300">Déficit:</span>
                        <code className="px-2 py-0.5 bg-slate-800 rounded text-yellow-300 font-mono">
                            stockSeguridad − stockActual
                        </code>
                    </div>
                </div>

                {/* Tabla */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-dark-950 z-10">
                            <tr className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                                <th className="p-4 border-b border-slate-800 cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('id')}>
                                    <div className="flex items-center">SKU<SortIcon column="id" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('name')}>
                                    <div className="flex items-center">Descripción<SortIcon column="name" /></div>
                                </th>

                                {/* Dynamic Headers */}
                                {calcMonths.map((m, i) => (
                                    <th key={i} className="p-4 border-b border-slate-800 text-right text-slate-500 font-normal">
                                        {m.charAt(0).toUpperCase() + m.slice(1)}
                                    </th>
                                ))}
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('adu6m')} title="Promedio mensual histórico de 6 meses dividido entre 30 días">
                                    <div className="flex items-center justify-end">ADU (6m)<SortIcon column="adu6m" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('aduL30d')} title="Demanda diaria promedio de los últimos 30 días naturales">
                                    <div className="flex items-center justify-end">ADU (L30d)<SortIcon column="aduL30d" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('adu')} title="40% Histórico (6m) + 60% Tendencia Reciente (L30d)">
                                    <div className="flex items-center justify-end">ADU Híbrido<SortIcon column="adu" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('fei')} title="Factor de Estacionalidad e Incremento (Cierre de Mes)">
                                    <div className="flex items-center justify-end">FEI<SortIcon column="fei" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('safetyStock')} title="Stock de Seguridad: (ADU * LT * LTF) + (ADU * LT * VF)">
                                    <div className="flex items-center justify-end">SS<SortIcon column="safetyStock" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('rop')} title="Punto de Reorden: Stock de Seguridad + (ADU * LT)">
                                    <div className="flex items-center justify-end">ROP<SortIcon column="rop" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('stockLevel')}>
                                    <div className="flex items-center justify-end">Stock Actual<SortIcon column="stockLevel" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('deficit')}>
                                    <div className="flex items-center justify-end">Déficit<SortIcon column="deficit" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('coverage')}>
                                    <div className="flex items-center justify-end">Cob. (d)<SortIcon column="coverage" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-800/50">
                            {processedSkus.map(sku => {
                                const isCritical = sku.stockLevel < sku.safetyStock;
                                const deficit = sku.safetyStock - sku.stockLevel;
                                const coverage = sku.adu > 0 ? (sku.stockLevel / sku.adu) : Infinity;
                                // Barra visual de stock vs safety stock
                                const fillPct = sku.safetyStock > 0 ? Math.min((sku.stockLevel / sku.safetyStock) * 100, 100) : 100;

                                return (
                                    <tr key={sku.id} className={`transition-colors ${isCritical ? 'hover:bg-red-500/5' : 'hover:bg-slate-800/30'}`}>
                                        <td className="p-4">
                                            <span className="font-medium text-white font-mono text-xs">{sku.id}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-slate-300 text-xs truncate block max-w-[220px]" title={sku.name}>{sku.name}</span>
                                            <span className="text-[10px] text-slate-500">{sku.jerarquia1} · {sku.grupoArticulosDesc}</span>
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
                                        <td className="p-4 text-right font-mono text-slate-400 text-[10px]">{(sku.adu6m || 0).toFixed(1)}</td>
                                        <td className="p-4 text-right font-mono text-slate-400 text-[10px]">{(sku.aduL30d || 0).toFixed(1)}</td>
                                        <td className="p-4 text-right font-mono text-slate-300">{(sku.adu || 0).toFixed(1)}</td>
                                        <td className="p-4 text-right font-mono text-indigo-400 text-[10px]">{(sku.fei || 1).toFixed(2)}</td>
                                        <td className="p-4 text-right font-mono text-yellow-500/80">{sku.safetyStock.toFixed(0)}</td>
                                        <td className="p-4 text-right font-mono text-orange-400/80">{sku.rop.toFixed(0)}</td>
                                        <td className="p-4 text-right">
                                            <div className={`font-bold font-mono ${isCritical ? 'text-red-400' : 'text-green-400'}`}>
                                                {sku.stockLevel.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                            </div>
                                            {/* Mini barra */}
                                            <div className="w-full h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${isCritical ? 'bg-red-500' : 'bg-green-500'}`}
                                                    style={{ width: `${fillPct}%` }}
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            {isCritical ? (
                                                <span className="font-bold font-mono text-red-400">-{deficit.toFixed(1)}</span>
                                            ) : (
                                                <span className="font-mono text-slate-600">—</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className={`font-mono ${coverage < 3 ? 'text-red-400 font-bold' : coverage < 7 ? 'text-yellow-400' : 'text-slate-400'}`}>
                                                {coverage === Infinity ? '∞' : coverage.toFixed(1)}d
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            {isCritical ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/15 border border-red-500/30 text-red-400">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                                    Crítico
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-500/15 border border-green-500/30 text-green-400">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                    OK
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {processedSkus.length === 0 && (
                                <tr>
                                    <td colSpan={14} className="p-12 text-center text-slate-500">
                                        <span className="material-symbols-rounded text-4xl mb-2 block">check_circle</span>
                                        {showOnlyCritical ? 'No hay SKUs con stock crítico' : 'No se encontraron resultados'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="px-8 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 flex-shrink-0 bg-dark-950">
                    <span>
                        Mostrando <span className="text-white font-bold">{processedSkus.length}</span> de <span className="text-white font-bold">{totalCount}</span> SKUs
                    </span>
                    <span className="text-slate-600">
                        Los datos respetan los filtros de segmentación del Dashboard
                    </span>
                </div>
            </div>

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
        </div>
    );
};

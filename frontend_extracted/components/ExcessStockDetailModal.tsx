import React, { useState, useMemo } from 'react';
import { SKU } from '../types';

interface ExcessStockDetailModalProps {
    filteredSkus: SKU[];
    onClose: () => void;
}

type SortKey = 'id' | 'name' | 'stockLevel' | 'rop' | 'excess' | 'status';
type SortDir = 'asc' | 'desc';

export const ExcessStockDetailModal: React.FC<ExcessStockDetailModalProps> = ({ filteredSkus, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('excess');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const calcMonths = useMemo(() => {
        const today = new Date();
        const months: string[] = [];
        for (let i = 6; i >= 1; i--) { // Chronological
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            months.push(d.toLocaleString('es-ES', { month: 'short', year: '2-digit' }).replace('.', ''));
        }
        return months;
    }, []);
    const [excessFilter, setExcessFilter] = useState<'all' | 'high' | 'moderate'>('all');

    const excessCount = filteredSkus.filter(s => s.stockLevel > s.rop * 1.5).length;
    const excessPct = filteredSkus.length > 0 ? ((excessCount / filteredSkus.length) * 100).toFixed(1) : '0';

    const processedSkus = useMemo(() => {
        let result = filteredSkus.filter(s => {
            const matchesSearch = searchTerm === '' ||
                s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.name.toLowerCase().includes(searchTerm.toLowerCase());

            const upperLimit = s.rop * 1.5;
            const isExcess = s.stockLevel > upperLimit;
            const excessAmount = s.stockLevel - upperLimit;

            let matchesFilter = isExcess; // By default show only excess items

            if (excessFilter === 'high') matchesFilter = isExcess && excessAmount > 1000; // Arbitrary threshold for 'high'
            else if (excessFilter === 'moderate') matchesFilter = isExcess && excessAmount <= 1000;

            return matchesSearch && matchesFilter;
        });

        result.sort((a, b) => {
            let valA: number | string;
            let valB: number | string;

            const getExcess = (s: SKU) => Math.max(0, s.stockLevel - (s.rop * 1.5));

            switch (sortKey) {
                case 'id': valA = a.id; valB = b.id; break;
                case 'name': valA = a.name; valB = b.name; break;
                case 'stockLevel': valA = a.stockLevel; valB = b.stockLevel; break;
                case 'rop': valA = a.rop; valB = b.rop; break;
                case 'excess': valA = getExcess(a); valB = getExcess(b); break;
                case 'status': valA = getExcess(a); valB = getExcess(b); break;
                default: valA = 0; valB = 0;
            }

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
        });

        return result;
    }, [filteredSkus, searchTerm, excessFilter, sortKey, sortDir]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir(key === 'excess' ? 'desc' : 'asc');
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
                                <div className="w-10 h-10 rounded-xl bg-amber-600/20 flex items-center justify-center">
                                    <span className="material-symbols-rounded text-amber-400 text-2xl">inventory_2</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Detalle de Exceso de Stock</h2>
                                    <p className="text-sm text-slate-400">
                                        Stock superior a 1.5x ROP · <span className="text-amber-400 font-semibold">{excessCount} SKUs</span> ({excessPct}%) con exceso
                                    </p>
                                </div>
                            </div>

                            {/* Filters */}
                            <div className="flex items-center gap-2 mt-4 text-xs">
                                <button
                                    onClick={() => setExcessFilter('all')}
                                    className={`px-3 py-1.5 rounded-lg transition-all border ${excessFilter === 'all' ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-800 text-slate-500 hover:text-white'}`}
                                >
                                    Todos los Excesos
                                </button>
                                {/* Simplified filters for now, can be expanded */}
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
                        <span className="material-symbols-rounded text-sm text-amber-400">function</span>
                        <span className="font-medium text-slate-300">Condición Exceso:</span>
                        <code className="px-2 py-0.5 bg-slate-800 rounded text-amber-300 font-mono">
                            Stock Actual &gt; 1.5 × ROP
                        </code>
                        <span className="mx-2 text-slate-600">|</span>
                        <span className="font-medium text-slate-300">Cantidad Excedente:</span>
                        <code className="px-2 py-0.5 bg-slate-800 rounded text-amber-300 font-mono">
                            Stock Actual - (1.5 × ROP)
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
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort('rop')}>
                                    <div className="flex items-center justify-end">Umbral (1.5x ROP)<SortIcon column="rop" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white select-none" onClick={() => handleSort('excess')}>
                                    <div className="flex items-center justify-end">Excedente<SortIcon column="excess" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-800/50">
                            {processedSkus.map(sku => {
                                const upperLimit = sku.rop * 1.5;
                                const excess = sku.stockLevel - upperLimit;
                                // Calculate excess percentage over the limit
                                const excessPct = upperLimit > 0 ? (excess / upperLimit) * 100 : 0;

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
                                        <td className="p-4 text-right font-mono text-white text-lg">{sku.stockLevel.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                                        <td className="p-4 text-right font-mono text-slate-400">{upperLimit.toFixed(1)}</td>
                                        <td className="p-4 text-right font-mono font-bold text-amber-400">
                                            +{excess.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400">
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                Exceso
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {processedSkus.length === 0 && (
                                <tr>
                                    <td colSpan={12} className="p-12 text-center text-slate-500">
                                        No se encontraron SKUs con exceso de stock
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

import React, { useState, useMemo } from 'react';
import { SKU } from '../types';
import { useData } from '../contexts/DataContext';

interface ServiceLevelDetailModalProps {
    filteredSkus: SKU[];
    onClose: () => void;
}

type SortKey = 'id' | 'name' | 'adu' | 'adu6m' | 'aduL30d' | 'fei' | 'stdDev' | 'safetyStock' | 'rop' | 'stockLevel' | 'upperLimit' | 'status';
type SortDir = 'asc' | 'desc';

// Estado del SKU según la lógica del Dashboard
const getSkuHealthStatus = (sku: SKU): 'healthy' | 'critical' | 'excess' => {
    if (sku.stockLevel < sku.safetyStock) return 'critical';
    if (sku.stockLevel > sku.rop * 1.5) return 'excess';
    return 'healthy';
};

const statusConfig = {
    healthy: { label: 'Saludable', color: 'text-green-400', bg: 'bg-green-500/15', border: 'border-green-500/30', icon: 'check_circle', dot: 'bg-green-500' },
    critical: { label: 'Crítico', color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', icon: 'error', dot: 'bg-red-500' },
    excess: { label: 'Exceso', color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', icon: 'inventory_2', dot: 'bg-blue-500' },
};

export const ServiceLevelDetailModal: React.FC<ServiceLevelDetailModalProps> = ({ filteredSkus, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('status');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [statusFilter, setStatusFilter] = useState<'all' | 'healthy' | 'critical' | 'excess'>('all');
    const { consumptionConfig, updateConsumptionConfig } = useData();
    const [showConfig, setShowConfig] = useState(false);

    // Get last 6 months (chronological order)
    const calcMonths = useMemo(() => {
        const today = new Date();
        const months: string[] = [];
        for (let i = 6; i >= 1; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            months.push(d.toLocaleString('es-ES', { month: 'short', year: '2-digit' }).replace('.', ''));
        }
        return months;
    }, []);

    // Cálculo de KPIs (misma lógica que Dashboard)
    const healthyCount = filteredSkus.filter(s => getSkuHealthStatus(s) === 'healthy').length;
    const criticalCount = filteredSkus.filter(s => getSkuHealthStatus(s) === 'critical').length;
    const excessCount = filteredSkus.filter(s => getSkuHealthStatus(s) === 'excess').length;
    const totalCount = filteredSkus.length;
    const serviceLevel = totalCount > 0 ? ((healthyCount / totalCount) * 100).toFixed(1) : '0';

    // Filtrado y ordenamiento
    const processedSkus = useMemo(() => {
        let result = filteredSkus.filter(s => {
            const matchesSearch = searchTerm === '' ||
                s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || getSkuHealthStatus(s) === statusFilter;
            return matchesSearch && matchesStatus;
        });

        result.sort((a, b) => {
            let valA: number | string;
            let valB: number | string;

            switch (sortKey) {
                case 'id': valA = a.id; valB = b.id; break;
                case 'name': valA = a.name; valB = b.name; break;
                case 'adu': valA = a.adu; valB = b.adu; break;
                case 'adu6m': valA = a.adu6m || 0; valB = b.adu6m || 0; break;
                case 'aduL30d': valA = a.aduL30d || 0; valB = b.aduL30d || 0; break;
                case 'fei': valA = a.fei || 0; valB = b.fei || 0; break;
                case 'stdDev': valA = a.stdDev; valB = b.stdDev; break;
                case 'safetyStock': valA = a.safetyStock; valB = b.safetyStock; break;
                case 'rop': valA = a.rop; valB = b.rop; break;
                case 'stockLevel': valA = a.stockLevel; valB = b.stockLevel; break;
                case 'upperLimit': valA = a.rop * 1.5; valB = b.rop * 1.5; break;
                case 'status': {
                    const priority = { critical: 0, excess: 1, healthy: 2 };
                    valA = priority[getSkuHealthStatus(a)];
                    valB = priority[getSkuHealthStatus(b)];
                    break;
                }
                default: valA = 0; valB = 0;
            }

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
        });

        return result;
    }, [filteredSkus, searchTerm, statusFilter, sortKey, sortDir]);

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

    // Barra de distribución porcentual
    const healthyPct = totalCount > 0 ? (healthyCount / totalCount) * 100 : 0;
    const criticalPct = totalCount > 0 ? (criticalCount / totalCount) * 100 : 0;
    const excessPct = totalCount > 0 ? (excessCount / totalCount) * 100 : 0;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ animation: 'fadeIn 0.2s ease-out' }}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

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
                                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
                                    <span className="material-symbols-rounded text-indigo-400 text-2xl">verified</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Detalle del Nivel de Servicio</h2>
                                    <p className="text-sm text-slate-400">
                                        Validación del cálculo · <span className="text-white font-semibold">{serviceLevel}%</span> nivel de servicio
                                    </p>
                                </div>
                            </div>

                            {/* Distribución visual */}
                            <div className="flex items-center gap-4 mt-4">
                                {/* Barra de progreso */}
                                <div className="flex-1 h-3 rounded-full bg-slate-800 overflow-hidden flex">
                                    {criticalPct > 0 && (
                                        <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${criticalPct}%` }} />
                                    )}
                                    {excessPct > 0 && (
                                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${excessPct}%` }} />
                                    )}
                                    {healthyPct > 0 && (
                                        <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${healthyPct}%` }} />
                                    )}
                                </div>
                                {/* Leyenda y Configuración */}
                                <div className="flex items-center gap-4 text-xs flex-shrink-0 relative">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setStatusFilter(statusFilter === 'healthy' ? 'all' : 'healthy')}
                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${statusFilter === 'healthy' ? 'bg-green-500/20 ring-1 ring-green-500/50' : 'hover:bg-slate-800'}`}
                                        >
                                            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                            <span className="text-green-400 font-bold">{healthyCount}</span>
                                            <span className="text-slate-500">Saludables</span>
                                        </button>
                                        <button
                                            onClick={() => setStatusFilter(statusFilter === 'critical' ? 'all' : 'critical')}
                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${statusFilter === 'critical' ? 'bg-red-500/20 ring-1 ring-red-500/50' : 'hover:bg-slate-800'}`}
                                        >
                                            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                            <span className="text-red-400 font-bold">{criticalCount}</span>
                                            <span className="text-slate-500">Críticos</span>
                                        </button>
                                        <button
                                            onClick={() => setStatusFilter(statusFilter === 'excess' ? 'all' : 'excess')}
                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${statusFilter === 'excess' ? 'bg-blue-500/20 ring-1 ring-blue-500/50' : 'hover:bg-slate-800'}`}
                                        >
                                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                            <span className="text-blue-400 font-bold">{excessCount}</span>
                                            <span className="text-slate-500">Exceso</span>
                                        </button>
                                    </div>

                                    {/* Config Button */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowConfig(!showConfig)}
                                            className={`p-2 rounded-lg transition-all ${showConfig ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-800/50'}`}
                                            title="Configuración de Cálculo"
                                        >
                                            <span className="material-symbols-rounded text-lg">settings</span>
                                        </button>

                                        {showConfig && (
                                            <div className="absolute right-0 top-full mt-2 w-64 bg-dark-900 border border-slate-700 rounded-xl shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                                                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Cálculo de Consumo</h3>
                                                    <button onClick={() => setShowConfig(false)} className="text-slate-500 hover:text-white">
                                                        <span className="material-symbols-rounded text-sm">close</span>
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-slate-500 mb-3">
                                                    Selecciona los tipos de movimiento a considerar como consumo (salida).
                                                </p>
                                                <div className="space-y-3">
                                                    <label className="flex items-center gap-3 cursor-pointer group">
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${consumptionConfig.includeVenta ? 'bg-primary-600 border-primary-600' : 'border-slate-600 group-hover:border-slate-500'}`}>
                                                            {consumptionConfig.includeVenta && <span className="material-symbols-rounded text-[10px] text-white">check</span>}
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            checked={consumptionConfig.includeVenta}
                                                            onChange={e => updateConsumptionConfig({ ...consumptionConfig, includeVenta: e.target.checked })}
                                                        />
                                                        <span className={`text-xs ${consumptionConfig.includeVenta ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>Ventas (Tipo 2)</span>
                                                    </label>
                                                    <label className="flex items-center gap-3 cursor-pointer group">
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${consumptionConfig.includeConsumo ? 'bg-primary-600 border-primary-600' : 'border-slate-600 group-hover:border-slate-500'}`}>
                                                            {consumptionConfig.includeConsumo && <span className="material-symbols-rounded text-[10px] text-white">check</span>}
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            checked={consumptionConfig.includeConsumo}
                                                            onChange={e => updateConsumptionConfig({ ...consumptionConfig, includeConsumo: e.target.checked })}
                                                        />
                                                        <span className={`text-xs ${consumptionConfig.includeConsumo ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>Consumo (Tipo 2)</span>
                                                    </label>
                                                    <label className="flex items-center gap-3 cursor-pointer group">
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${consumptionConfig.includeTraspaso ? 'bg-primary-600 border-primary-600' : 'border-slate-600 group-hover:border-slate-500'}`}>
                                                            {consumptionConfig.includeTraspaso && <span className="material-symbols-rounded text-[10px] text-white">check</span>}
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            checked={consumptionConfig.includeTraspaso}
                                                            onChange={e => updateConsumptionConfig({ ...consumptionConfig, includeTraspaso: e.target.checked })}
                                                        />
                                                        <span className={`text-xs ${consumptionConfig.includeTraspaso ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>Traspasos (Tipo 2)</span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
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
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                            >
                                <span className="material-symbols-rounded text-lg">close</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Fórmula explicativa */}
                <div className="px-8 py-3 bg-slate-800/30 border-b border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="material-symbols-rounded text-sm text-indigo-400">function</span>
                        <span className="font-medium text-slate-300">Fórmula:</span>
                        <code className="px-2 py-0.5 bg-slate-800 rounded text-indigo-300 font-mono">
                            NS = (SKUs saludables / Total SKUs filtrados) × 100
                        </code>
                        <span className="mx-2 text-slate-600">|</span>
                        <span className="font-medium text-slate-300">SKU saludable:</span>
                        <code className="px-2 py-0.5 bg-slate-800 rounded text-green-300 font-mono">
                            stockActual ≥ stockSeguridad AND stockActual ≤ ROP × 1.5
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
                                {/* Since we can't easily map dynamic headers here without extracting the logic, 
                                    I'll hardcode Month placeholders or refactor. 
                                    Better to refactor to a variable outside. 
                                    Let's generate them in the body and use a state/memo for headers? 
                                    Actually I'll just calculate them here. */}
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
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('stdDev')}>
                                    <div className="flex items-center justify-end">Desv.Std<SortIcon column="stdDev" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('safetyStock')} title="Stock de Seguridad: (ADU * LT * LTF) + (ADU * LT * VF)">
                                    <div className="flex items-center justify-end">SS<SortIcon column="safetyStock" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('rop')} title="Punto de Reorden: Stock de Seguridad + (ADU * LT)">
                                    <div className="flex items-center justify-end">ROP<SortIcon column="rop" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('stockLevel')}>
                                    <div className="flex items-center justify-end">Stock<SortIcon column="stockLevel" /></div>
                                </th>
                                <th className="p-4 border-b border-slate-800 text-center cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('status')}>
                                    <div className="flex items-center justify-center">Estado<SortIcon column="status" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-800/50">
                            {processedSkus.map(sku => {
                                const status = getSkuHealthStatus(sku);
                                const cfg = statusConfig[status];

                                return (
                                    <tr key={sku.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4">
                                            <span className="font-medium text-white font-mono text-xs">{sku.id}</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="text-slate-300 text-xs truncate block max-w-[200px]" title={sku.name}>{sku.name}</span>
                                                <span className="text-[10px] text-slate-500">{sku.jerarquia1}</span>
                                            </div>
                                        </td>

                                        {/* Dynamic Monthly Columns */}
                                        {calcMonths.map((m, idx) => {
                                            // history is stored as [{month: "YYYY-MM", quantity: 123}]
                                            // DataContext generated it in order Mes-1 to Mes-6.
                                            // So idx 0 corresponds to Mes-1.
                                            const val = sku.monthlyConsumption?.[idx]?.quantity || 0;

                                            return (
                                                <td key={idx} className="p-4 text-right">
                                                    <span className={`font-mono text-xs ${val > 0 ? 'text-slate-300' : 'text-slate-600'}`}>
                                                        {val > 0 ? val.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}
                                                    </span>
                                                </td>
                                            );
                                        })}

                                        <td className="p-4 text-right font-mono text-slate-400 text-xs">{(sku.adu6m || 0).toFixed(1)}</td>
                                        <td className="p-4 text-right font-mono text-slate-400 text-xs">{(sku.aduL30d || 0).toFixed(1)}</td>
                                        <td className="p-4 text-right font-mono text-white font-bold bg-slate-800/20">{sku.adu.toFixed(1)}</td>
                                        <td className="p-4 text-right font-mono text-indigo-400 text-xs">{(sku.fei || 1).toFixed(2)}</td>
                                        <td className="p-4 text-right font-mono text-slate-400">{sku.stdDev.toFixed(1)}</td>
                                        <td className="p-4 text-right font-mono text-yellow-500/80">{sku.safetyStock.toFixed(0)}</td>
                                        <td className="p-4 text-right font-mono text-orange-400/80">{sku.rop.toFixed(0)}</td>
                                        <td className="p-4 text-right">
                                            <span className={`font-bold font-mono ${status === 'critical' ? 'text-red-400' : status === 'excess' ? 'text-blue-400' : 'text-green-400'}`}>
                                                {sku.stockLevel.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.border} border ${cfg.color}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                {cfg.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {processedSkus.length === 0 && (
                                <tr>
                                    <td colSpan={14} className="p-12 text-center text-slate-500">
                                        <span className="material-symbols-rounded text-4xl mb-2 block">search_off</span>
                                        No se encontraron SKUs con los filtros aplicados
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
                        {statusFilter !== 'all' && <span className="text-primary-400 ml-2">· Filtro: {statusConfig[statusFilter].label}</span>}
                    </span>
                    <span className="text-slate-600">
                        Los datos respetan los filtros de segmentación del Dashboard
                    </span>
                </div>
            </div>

            {/* Animations */}
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

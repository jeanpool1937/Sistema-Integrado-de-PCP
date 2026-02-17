import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useData } from '../contexts/DataContext';

interface StockRule {
    id?: string;
    grupo_articulo: string;
    tipo_material: string;
    status_permitidos: string[];
}

interface Combination {
    grupo_articulo: string;
    tipo_material: string;
    status_permitidos: string[]; // From DB or default
    rule_id?: string;
    is_modified?: boolean;
}

export const Configuration: React.FC = () => {
    const [combinations, setCombinations] = useState<Combination[]>([]);
    const [allStatuses, setAllStatuses] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const { selectedCountry, setSelectedCountry, availableCountries } = useData();

    // Default statuses as per requirement
    const DEFAULT_STATUSES = ['COMERCIAL', 'SEMI', 'PISO'];

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch distinct statuses for the columns
            const statuses = await api.getDistinctStatuses();
            setAllStatuses(statuses || []);

            // 2. Fetch all combinations in local data
            const materialCombinations = await api.getMaterialCombinations();

            // 3. Fetch existing rules
            const rules = await api.getStockRules();
            const rulesMap = new Map();
            rules.forEach((r: any) => {
                const key = `${r.grupo_articulo}|${r.tipo_material}`;
                rulesMap.set(key, r);
            });

            // 4. Merge
            const merged: Combination[] = materialCombinations.map((item: any) => {
                const key = `${item.grupo_articulos_descripcion}|${item.tipo_material}`;
                const existingRule = rulesMap.get(key);

                return {
                    grupo_articulo: item.grupo_articulos_descripcion,
                    tipo_material: item.tipo_material,
                    status_permitidos: existingRule ? existingRule.status_permitidos : DEFAULT_STATUSES,
                    rule_id: existingRule?.id,
                    is_modified: false
                };
            });

            setCombinations(merged);
        } catch (error) {
            console.error("Error loading config:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusToggle = (index: number, status: string) => {
        const newCombinations = [...combinations];
        const item = newCombinations[index];
        const currentStatuses = new Set(item.status_permitidos);

        if (currentStatuses.has(status)) {
            currentStatuses.delete(status);
        } else {
            currentStatuses.add(status);
        }

        item.status_permitidos = Array.from(currentStatuses);
        item.is_modified = true;
        setCombinations(newCombinations);
    };

    const saveChanges = async () => {
        setIsSaving(true);
        try {
            const modified = combinations.filter(c => c.is_modified);

            // Process sequentially to avoid race conditions/conflicts
            for (const item of modified) {
                await api.upsertStockRule(item.grupo_articulo, item.tipo_material, item.status_permitidos);
            }

            // Reload to refresh IDs and clear modified flags
            await loadData();
            alert('Configuración guardada correctamente.');
        } catch (error) {
            console.error("Error saving:", error);
            alert('Error al guardar cambios.');
        } finally {
            setIsSaving(false);
        }
    };

    const filteredCombinations = combinations.filter(c =>
        c.grupo_articulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.tipo_material.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) return <div className="text-white p-8">Cargando configuración...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-800/60 shadow-inner">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <span className="material-symbols-rounded text-primary-400">settings</span>
                        Configuración Global
                    </h2>
                    <p className="text-slate-400 text-sm">Gestiona el contexto regional y las reglas de disponibilidad de stock.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Country Selector */}
                    <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700/50 pr-3">
                        <div className="bg-primary-500/10 p-2 rounded-lg">
                            <span className="material-symbols-rounded text-primary-400 text-xl">public</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-500 leading-none mb-1">País Seleccionado</span>
                            <select
                                value={selectedCountry}
                                onChange={(e) => setSelectedCountry(e.target.value)}
                                className="bg-transparent border-none text-white font-semibold focus:ring-0 p-0 text-sm cursor-pointer hover:text-primary-400 transition-colors"
                            >
                                {availableCountries.map(c => (
                                    <option key={c} value={c} className="bg-slate-900">{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="h-10 w-px bg-slate-800 hidden md:block" />

                    <div className="relative flex-grow md:flex-grow-0">
                        <span className="material-symbols-rounded absolute left-3 top-2.5 text-slate-500 text-sm">search</span>
                        <input
                            type="text"
                            placeholder="Buscar grupo o tipo..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="bg-slate-800/50 border border-slate-700/50 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-primary-500 w-full"
                        />
                    </div>

                    <button
                        onClick={saveChanges}
                        disabled={isSaving || !combinations.some(c => c.is_modified)}
                        className="bg-primary-600 hover:bg-primary-500 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-bold transition-all shadow-lg shadow-primary-900/20 flex items-center gap-2"
                    >
                        {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                        <span className="material-symbols-rounded text-lg">save</span>
                    </button>
                </div>
            </div>

            <div className="bg-dark-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-900/50 text-slate-400 uppercase font-bold text-xs">
                            <tr>
                                <th className="p-4 border-b border-slate-800">Grupo de Artículos</th>
                                <th className="p-4 border-b border-slate-800">Tipo Material</th>
                                <th className="p-4 border-b border-slate-800 text-center" colSpan={allStatuses.length}>
                                    Estatus Permitidos
                                </th>
                            </tr>
                            <tr>
                                <th className="p-4 border-b border-slate-800"></th>
                                <th className="p-4 border-b border-slate-800"></th>
                                {allStatuses.map(status => (
                                    <th key={status} className="p-2 border-b border-slate-800 text-center text-[10px] text-slate-500">
                                        {status}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filteredCombinations.map((item, idx) => {
                                // Find original index in master list to update correct item
                                const originalIndex = combinations.indexOf(item);

                                return (
                                    <tr key={`${item.grupo_articulo}-${item.tipo_material}`} className={`hover:bg-slate-800/30 transition-colors ${item.is_modified ? 'bg-primary-900/10' : ''}`}>
                                        <td className="p-4 font-mono text-slate-300">{item.grupo_articulo}</td>
                                        <td className="p-4 text-slate-400">{item.tipo_material}</td>
                                        {allStatuses.map(status => {
                                            const isChecked = item.status_permitidos.includes(status);
                                            return (
                                                <td key={status} className="p-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => handleStatusToggle(originalIndex, status)}
                                                        className="w-4 h-4 rounded border-slate-600 text-primary-600 focus:ring-primary-500 focus:ring-offset-dark-900 cursor-pointer"
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="p-4 text-slate-500 text-xs text-center">
                Mostrando {filteredCombinations.length} combinaciones. Los cambios no guardados se perderán al salir.
            </div>
        </div>
    );
};

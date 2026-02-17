import React from 'react';

interface FilterBarProps {
    skus: any[];
    selectedJerarquia: string;
    setSelectedJerarquia: (val: string) => void;
    selectedGrupo: string;
    setSelectedGrupo: (val: string) => void;
    selectedProceso: string;
    setSelectedProceso: (val: string) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
    skus,
    selectedJerarquia,
    setSelectedJerarquia,
    selectedGrupo,
    setSelectedGrupo,
    selectedProceso,
    setSelectedProceso,
}) => {
    // Extraer valores únicos de la lista de SKUs
    const jerarquias = Array.from(new Set(skus.map(s => s.jerarquia1).filter(Boolean))).sort();

    // Procesos únicos: Un SKU puede tener varios procesos en string separado por comas
    const procesos = Array.from(
        new Set(
            skus
                .flatMap(s => (s.procesos || '').split(',').map((p: string) => p.trim()))
                .filter(Boolean)
        )
    ).sort();

    const grupos = Array.from(
        new Set(
            skus
                .filter(s =>
                    (!selectedJerarquia || s.jerarquia1 === selectedJerarquia) &&
                    (!selectedProceso || (s.procesos || '').includes(selectedProceso))
                )
                .map(s => s.grupoArticulosDesc)
                .filter(Boolean)
        )
    ).sort();

    const activeCount = (selectedJerarquia ? 1 : 0) + (selectedGrupo ? 1 : 0) + (selectedProceso ? 1 : 0);

    return (
        <div className="flex flex-wrap items-center gap-3 bg-dark-900 border border-slate-800 rounded-xl px-4 py-3 mb-6">
            <div className="flex items-center gap-2 text-slate-400 mr-2">
                <span className="material-symbols-rounded text-lg">filter_alt</span>
                <span className="text-xs font-bold uppercase tracking-wider">Segmentación</span>
                {activeCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {activeCount}
                    </span>
                )}
            </div>

            {/* Jerarquía 1 */}
            <div className="relative">
                <select
                    value={selectedJerarquia}
                    onChange={e => {
                        setSelectedJerarquia(e.target.value);
                        setSelectedGrupo(''); // Reset grupo when hierarchy changes
                    }}
                    className="bg-slate-800 border border-slate-700 text-sm text-white rounded-lg pl-3 pr-8 py-1.5 appearance-none cursor-pointer focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                >
                    <option value="">Todas las Jerarquías</option>
                    {jerarquias.map(j => (
                        <option key={j} value={j}>{j}</option>
                    ))}
                </select>
                <span className="material-symbols-rounded absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">
                    expand_more
                </span>
            </div>

            {/* Proceso Productivo */}
            <div className="relative">
                <select
                    value={selectedProceso}
                    onChange={e => {
                        setSelectedProceso(e.target.value);
                        setSelectedGrupo('');
                    }}
                    className="bg-slate-800 border border-slate-700 text-sm text-white rounded-lg pl-3 pr-8 py-1.5 appearance-none cursor-pointer focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                >
                    <option value="">Todos los Procesos</option>
                    {procesos.map(p => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
                <span className="material-symbols-rounded absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">
                    expand_more
                </span>
            </div>

            {/* Grupo Artículos */}
            <div className="relative">
                <select
                    value={selectedGrupo}
                    onChange={e => setSelectedGrupo(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-sm text-white rounded-lg pl-3 pr-8 py-1.5 appearance-none cursor-pointer focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                >
                    <option value="">Todos los Grupos</option>
                    {grupos.map(g => (
                        <option key={g} value={g}>{g}</option>
                    ))}
                </select>
                <span className="material-symbols-rounded absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">
                    expand_more
                </span>
            </div>

            {/* Clear Filters */}
            {activeCount > 0 && (
                <button
                    onClick={() => {
                        setSelectedJerarquia('');
                        setSelectedGrupo('');
                        setSelectedProceso('');
                    }}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 bg-red-500/10 rounded-lg border border-red-500/20 transition-colors"
                >
                    <span className="material-symbols-rounded text-sm">close</span>
                    Limpiar
                </button>
            )}

            {/* Count indicator */}
            <div className="ml-auto text-xs text-slate-500">
                <span className="text-white font-bold">
                    {skus.filter(s =>
                        (!selectedJerarquia || s.jerarquia1 === selectedJerarquia) &&
                        (!selectedGrupo || s.grupoArticulosDesc === selectedGrupo) &&
                        (!selectedProceso || (s.procesos || '').includes(selectedProceso))
                    ).length}
                </span>
                <span> de {skus.length} SKUs</span>
            </div>
        </div>
    );
};

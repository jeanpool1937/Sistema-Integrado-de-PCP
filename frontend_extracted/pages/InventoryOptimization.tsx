import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useInventoryViewModel } from '../hooks/useInventoryViewModel';
import { useInventoryObserver } from '../hooks/useInventoryObserver';
import { SKU } from '../types';

interface InventoryOptimizationProps {
  filteredSkus: SKU[];
}

export const InventoryOptimization: React.FC<InventoryOptimizationProps> = ({ filteredSkus }) => {
  const {
    isLoading,
    simLTF,
    setSimLTF,
    selectedSegment,
    setSelectedSegment,
    matrixType,
    setMatrixType,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    matrixData,
    sortedSkus,
    getSkuStatus
  } = useInventoryViewModel(filteredSkus);

  const { alerts, setAlerts } = useInventoryObserver();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const MatrixCell = ({ rowClass, colClass, color, label }: { rowClass: string, colClass: string, color: string, label: string }) => {
    const count = matrixData[`${rowClass}${colClass}`] || 0;
    const isSelected = selectedSegment === `${rowClass}${colClass}`;

    return (
      <div
        onClick={() => setSelectedSegment(isSelected ? null : `${rowClass}${colClass}`)}
        className={`
          p-4 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col items-center justify-center h-32
          ${isSelected ? 'ring-2 ring-white border-transparent shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'border-slate-800 hover:border-slate-600'}
          ${color} bg-opacity-10
        `}
      >
        <span className={`text-2xl font-bold ${color.replace('bg-', 'text-')}`}>{count}</span>
        <span className="text-xs text-slate-400 mt-1 font-medium">{rowClass}-{colClass}</span>
        <span className="text-[10px] text-slate-500 mt-1 text-center hidden xl:block">
          {label}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Real-time Alerts Banner (Observer Pattern) */}
      {alerts.length > 0 && (
        <div className="animate-in slide-in-from-top duration-500">
          <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
                <span className="material-symbols-rounded text-white">warning</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-500">Alerta de Inventario Crítico (En Tiempo Real)</h4>
                <p className="text-xs text-slate-400">El SKU {alerts[0].sku_id} ha entrado en zona roja con {alerts[0].stock_level} TN.</p>
              </div>
            </div>
            <button
              onClick={() => setAlerts([])}
              className="text-xs text-slate-500 hover:text-white transition-colors"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Matrix Visualization */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-dark-900 border border-slate-800 rounded-xl p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Matriz Dinámica</h3>
                <p className="text-sm text-slate-400">
                  {matrixType === 'ABC-XYZ' && 'Valor (ABC) vs Variabilidad (XYZ)'}
                  {matrixType === 'ABC-Rot' && 'Valor (ABC) vs Rotación (H/M/L)'}
                  {matrixType === 'ABC-Per' && 'Valor (ABC) vs Periodicidad'}
                </p>
              </div>
              <select
                value={matrixType}
                onChange={(e) => {
                  setMatrixType(e.target.value as any);
                  setSelectedSegment(null);
                }}
                className="bg-dark-800 border border-slate-700 text-xs rounded-lg px-2 py-1 text-white focus:outline-none focus:border-primary-500"
              >
                <option value="ABC-XYZ">Variabilidad (XYZ)</option>
                <option value="ABC-Rot">Rotación</option>
                <option value="ABC-Per">Periodicidad</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 grid grid-cols-3 text-center text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-bold">
                <span>{matrixType === 'ABC-XYZ' ? 'Estable (X)' : 'Alta (H)'}</span>
                <span>{matrixType === 'ABC-XYZ' ? 'Variable (Y)' : 'Media (M)'}</span>
                <span>{matrixType === 'ABC-XYZ' ? 'Volátil (Z)' : 'Baja (L)'}</span>
              </div>
              <MatrixCell rowClass="A" colClass={matrixType === 'ABC-XYZ' ? 'X' : 'High'} color="bg-green-500" label="Prio. Alta" />
              <MatrixCell rowClass="A" colClass={matrixType === 'ABC-XYZ' ? 'Y' : 'Medium'} color="bg-yellow-500" label="Alerta" />
              <MatrixCell rowClass="A" colClass={matrixType === 'ABC-XYZ' ? 'Z' : 'Low'} color="bg-red-500" label="Crítico" />
              <MatrixCell rowClass="B" colClass={matrixType === 'ABC-XYZ' ? 'X' : 'High'} color="bg-green-600" label="Estable" />
              <MatrixCell rowClass="B" colClass={matrixType === 'ABC-XYZ' ? 'Y' : 'Medium'} color="bg-yellow-600" label="Regular" />
              <MatrixCell rowClass="B" colClass={matrixType === 'ABC-XYZ' ? 'Z' : 'Low'} color="bg-orange-600" label="Riesgo" />
              <MatrixCell rowClass="C" colClass={matrixType === 'ABC-XYZ' ? 'X' : 'High'} color="bg-blue-600" label="Baja Rot" />
              <MatrixCell rowClass="C" colClass={matrixType === 'ABC-XYZ' ? 'Y' : 'Medium'} color="bg-blue-700" label="Lento" />
              <MatrixCell rowClass="C" colClass={matrixType === 'ABC-XYZ' ? 'Z' : 'Low'} color="bg-slate-600" label="Obsoleto" />
            </div>
          </div>

          <div className="bg-dark-900 border border-slate-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-bold text-white mb-4">Simulador DDMRP Experto</h3>
            <div className="space-y-6">
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <p className="text-xs text-slate-400 mb-1">Lead Time</p>
                <p className="text-sm font-bold text-white italic">Variable por SKU</p>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-slate-300">Factor Lead Time (LTF)</label>
                  <span className="text-sm font-bold text-primary-500">{simLTF.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={simLTF}
                  onChange={(e) => setSimLTF(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
              </div>
              <div className="p-4 bg-primary-500/5 rounded-lg border border-primary-500/20 text-center">
                <p className="text-xs text-primary-400">Modificando parámetros globales del sistema</p>
              </div>
            </div>
          </div>
        </div>

        {/* SKU Table */}
        <div className="lg:col-span-7 bg-dark-900 border border-slate-800 rounded-xl flex flex-col h-[700px] shadow-lg overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-dark-900/50 backdrop-blur-md">
            <h3 className="text-lg font-bold text-white whitespace-nowrap">
              {selectedSegment ? `Fragmento ${selectedSegment}` : 'Inventario Detallado'}
              <span className="ml-2 text-xs font-normal text-slate-500">[{sortedSkus.length} items]</span>
            </h3>

            <div className="flex gap-1 bg-dark-800 p-1 rounded-lg border border-slate-700/50">
              {(['ALL', 'RED', 'YELLOW', 'GREEN'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`
                    px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all
                    ${filterStatus === status ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}
                    ${status === 'RED' ? 'hover:bg-red-500/10' : ''}
                  `}
                >
                  {status === 'ALL' ? 'Todos' : status}
                </button>
              ))}
            </div>

            <div className="relative group w-full xl:w-48">
              <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-500 transition-colors text-[18px]">search</span>
              <input
                type="text"
                placeholder="Filtrar SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-dark-800 border border-slate-700 text-xs text-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-primary-500 placeholder-slate-600 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-dark-900 z-10 shadow-sm border-b border-slate-800">
                <tr className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                  <th className="p-4">SKU / Segmento</th>
                  <th className="p-4 text-right">ADU</th>
                  <th className="p-4 text-right">Variabilidad</th>
                  <th className="p-4 text-right text-yellow-500">Z. Amarilla</th>
                  <th className="p-4 text-right text-red-500">Z. Roja</th>
                  <th className="p-4 text-right">Stock</th>
                  <th className="p-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-800/50">
                {sortedSkus.slice(0, 50).map((sku) => {
                  const dyYellow = parseFloat((sku.adu * sku.leadTime).toFixed(2));
                  const dyRedTotal = Math.floor((sku.adu * sku.leadTime * simLTF) + (sku.adu * sku.leadTime * sku.variabilityFactor));
                  const status = getSkuStatus(sku);

                  return (
                    <tr key={sku.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="p-4">
                        <div className="font-bold text-white group-hover:text-primary-400 transition-colors">{sku.id}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-1 rounded-[4px] text-[9px] font-bold border ${sku.abc === 'A' ? 'border-primary-500/30 text-primary-400 bg-primary-500/5' : 'border-slate-700 text-slate-500'}`}>
                            {sku.abc}{sku.xyz}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{sku.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right text-slate-300 font-mono">{sku.adu}</td>
                      <td className="p-4 text-right text-slate-400 font-mono text-[10px]">
                        {(sku.adu > 0 ? sku.stdDev / sku.adu : 0).toFixed(2)}
                        <span className="block text-[8px] text-slate-600 italic">VF: {sku.variabilityFactor}</span>
                      </td>
                      <td className="p-4 text-right font-mono text-yellow-500/80">
                        {dyYellow}
                        <div className="text-[9px] text-slate-600">LT: {sku.leadTime}d</div>
                      </td>
                      <td className="p-4 text-right font-mono text-red-500">
                        {dyRedTotal}
                      </td>
                      <td className="p-4 text-right">
                        <div className={`font-bold ${status === 'RED' ? 'text-red-500' : 'text-slate-200'}`}>
                          {sku.stockLevel.toLocaleString()}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className={`
                          w-2.5 h-2.5 rounded-full mx-auto shadow-sm transition-all duration-300
                          ${status === 'RED' ? 'bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]' :
                            status === 'YELLOW' ? 'bg-yellow-500' : 'bg-green-500'}
                        `}></div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

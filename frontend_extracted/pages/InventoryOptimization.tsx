import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ABCClass, XYZClass, SKU } from '../types';
import { useData } from '../contexts/DataContext';

interface InventoryOptimizationProps {
  filteredSkus: SKU[];
}

export const InventoryOptimization: React.FC<InventoryOptimizationProps> = ({ filteredSkus }) => {
  const { isLoading } = useData();
  const skus = filteredSkus;
  const [simLTF, setSimLTF] = useState(0.2); // Only LTF is simulatable now
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [matrixType, setMatrixType] = useState<'ABC-XYZ' | 'ABC-Rot' | 'ABC-Per'>('ABC-XYZ');
  const [searchTerm, setSearchTerm] = useState('');
  type DDMRPStatus = 'ALL' | 'RED' | 'YELLOW' | 'GREEN';
  const [filterStatus, setFilterStatus] = useState<DDMRPStatus>('ALL');

  const getSkuStatus = (sku: any) => {
    // Usa el Lead Time REAL del SKU
    const redBase = sku.adu * sku.leadTime * simLTF;
    const redAlert = sku.adu * sku.leadTime * sku.variabilityFactor;
    const redTotal = redBase + redAlert;
    const yellowZone = sku.adu * sku.leadTime;

    if (sku.stockLevel < redTotal) return 'RED';
    if (sku.stockLevel < (redTotal + yellowZone)) return 'YELLOW';
    return 'GREEN';
  };
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Matrix Logic
  const getSegmentCount = (rowClass: string, colClass: string) => {
    return skus.filter(s => {
      if (matrixType === 'ABC-XYZ') return s.abc === rowClass && s.xyz === colClass;
      if (matrixType === 'ABC-Rot') return s.abc === rowClass && s.rotationSegment === colClass;
      if (matrixType === 'ABC-Per') return s.abc === rowClass && s.periodicitySegment === colClass;
      return false;
    }).length;
  };

  const MatrixCell = ({ rowClass, colClass, color, label }: { rowClass: string, colClass: string, color: string, label: string }) => {
    const count = getSegmentCount(rowClass, colClass);
    const isSelected = selectedSegment === `${rowClass}${colClass}`;

    return (
      <div
        onClick={() => setSelectedSegment(isSelected ? null : `${rowClass}${colClass}`)}
        className={`
          p-4 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col items-center justify-center h-32
          ${isSelected ? 'ring-2 ring-white border-transparent' : 'border-slate-800 hover:border-slate-600'}
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

  const displaySkus = skus.filter(s => {
    let matchesSegment = true;
    if (selectedSegment) {
      if (matrixType === 'ABC-XYZ') matchesSegment = `${s.abc}${s.xyz}` === selectedSegment;
      else if (matrixType === 'ABC-Rot') matchesSegment = `${s.abc}${s.rotationSegment}` === selectedSegment;
      else if (matrixType === 'ABC-Per') matchesSegment = `${s.abc}${s.periodicitySegment}` === selectedSegment;
    }
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const status = getSkuStatus(s);
    const matchesStatus = filterStatus === 'ALL' || status === filterStatus;

    return matchesSegment && matchesSearch && matchesStatus;
  });

  // Real-time sorting by health status (Red > Yellow > Green)
  const sortedSkus = [...displaySkus].sort((a, b) => {
    const getStatusPriority = (sku: any) => {
      const status = getSkuStatus(sku);
      if (status === 'RED') return 0; // Red (Critical)
      if (status === 'YELLOW') return 1; // Yellow (Warning)
      return 2; // Green (Healthy)
    };

    return getStatusPriority(a) - getStatusPriority(b);
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Matrix Visualization */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-dark-900 border border-slate-800 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Matriz Dinámica</h3>
                <p className="text-sm text-slate-400">
                  {matrixType === 'ABC-XYZ' && 'Valor (ABC) vs Variabilidad (XYZ)'}
                  {matrixType === 'ABC-Rot' && 'Valor (ABC) vs Rotación (High/Med/Low)'}
                  {matrixType === 'ABC-Per' && 'Valor (ABC) vs Periodicidad (Actividad)'}
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
              {/* Dynamic Headers */}
              <div className="col-span-3 grid grid-cols-3 text-center text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-bold">
                <span>{matrixType === 'ABC-XYZ' ? 'Estable (X)' : 'Alta (H)'}</span>
                <span>{matrixType === 'ABC-XYZ' ? 'Variable (Y)' : 'Media (M)'}</span>
                <span>{matrixType === 'ABC-XYZ' ? 'Volátil (Z)' : 'Baja (L)'}</span>
              </div>

              {/* Row A */}
              <MatrixCell rowClass="A" colClass={matrixType === 'ABC-XYZ' ? 'X' : 'High'} color="bg-green-500" label="Prio. Alta" />
              <MatrixCell rowClass="A" colClass={matrixType === 'ABC-XYZ' ? 'Y' : 'Medium'} color="bg-yellow-500" label="Alerta" />
              <MatrixCell rowClass="A" colClass={matrixType === 'ABC-XYZ' ? 'Z' : 'Low'} color="bg-red-500" label="Crítico" />

              {/* Row B */}
              <MatrixCell rowClass="B" colClass={matrixType === 'ABC-XYZ' ? 'X' : 'High'} color="bg-green-600" label="Estable" />
              <MatrixCell rowClass="B" colClass={matrixType === 'ABC-XYZ' ? 'Y' : 'Medium'} color="bg-yellow-600" label="Regular" />
              <MatrixCell rowClass="B" colClass={matrixType === 'ABC-XYZ' ? 'Z' : 'Low'} color="bg-orange-600" label="Riesgo" />

              {/* Row C */}
              <MatrixCell rowClass="C" colClass={matrixType === 'ABC-XYZ' ? 'X' : 'High'} color="bg-blue-600" label="Baja Rot" />
              <MatrixCell rowClass="C" colClass={matrixType === 'ABC-XYZ' ? 'Y' : 'Medium'} color="bg-blue-700" label="Lento" />
              <MatrixCell rowClass="C" colClass={matrixType === 'ABC-XYZ' ? 'Z' : 'Low'} color="bg-slate-600" label="Obsoleto" />
            </div>

            <div className="mt-4 flex justify-between text-xs text-slate-500 px-2">
              <span>Alta Rotación (A)</span>
              <span>Baja Rotación (C)</span>
            </div>
          </div>

          <div className="bg-dark-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Simulador DDMRP Experto</h3>
            <div className="space-y-6">
              {/* Lead Time Display (Read Only) */}
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Lead Time</p>
                <p className="text-sm font-bold text-white">Variable por SKU</p>
                <p className="text-[10px] text-slate-500 mt-1">Definido en Maestro de Artículos</p>
              </div>

              {/* LTF Slider */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-slate-300">Factor Lead Time (LTF)</label>
                  <span className="text-sm font-bold text-blue-500">{simLTF.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={simLTF}
                  onChange={(e) => setSimLTF(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  title="Ajustar Factor Lead Time"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>0.1</span>
                  <span>0.9</span>
                </div>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-1 text-center">Simulación Activa basada en ADU Real</p>
              </div>
            </div>
          </div>
        </div>

        {/* SKU Table */}
        <div className="lg:col-span-7 bg-dark-900 border border-slate-800 rounded-xl flex flex-col h-[700px]">
          <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <h3 className="text-lg font-bold text-white whitespace-nowrap">
              {selectedSegment ? `SKUs en Segmento ${selectedSegment}` : 'Todos los SKUs'}
              <span className="ml-2 text-sm font-normal text-slate-400">({filteredSkus.length} items)</span>
            </h3>

            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${filterStatus === 'ALL' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterStatus('RED')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${filterStatus === 'RED' ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'text-slate-500 hover:text-red-400'}`}
              >
                <div className="w-2 h-2 rounded-full bg-red-500"></div> Rojo
              </button>
              <button
                onClick={() => setFilterStatus('YELLOW')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${filterStatus === 'YELLOW' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 'text-slate-500 hover:text-yellow-400'}`}
              >
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div> Amarillo
              </button>
              <button
                onClick={() => setFilterStatus('GREEN')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${filterStatus === 'GREEN' ? 'bg-green-500/20 text-green-500 border border-green-500/50' : 'text-slate-500 hover:text-green-400'}`}
              >
                <div className="w-2 h-2 rounded-full bg-green-500"></div> Verde
              </button>
            </div>

            <div className="flex gap-4 items-center w-full sm:w-auto">
              <div className="relative group w-full sm:w-64">
                <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-500 transition-colors text-[20px]">search</span>
                <input
                  type="text"
                  placeholder="Buscar por descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 text-sm text-white rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-primary-500 placeholder-slate-500 transition-all"
                />
              </div>
              <button className="text-sm text-primary-500 font-medium hover:text-primary-400 transition-colors whitespace-nowrap">Exportar DDMRP</button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-dark-900 z-10 shadow-sm">
                <tr className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                  <th className="p-4 border-b border-slate-800">SKU / Clase</th>
                  <th className="p-4 border-b border-slate-800 text-right">ADU</th>
                  <th className="p-4 border-b border-slate-800 text-right">Dev.Std</th>
                  <th className="p-4 border-b border-slate-800 text-right">CoV</th>
                  <th className="p-4 border-b border-slate-800 text-center">Meses</th>
                  <th className="p-4 border-b border-slate-800 text-right">Rotación</th>
                  <th className="p-4 border-b border-slate-800 text-right text-yellow-500">Z.Amarilla</th>
                  <th className="p-4 border-b border-slate-800 text-right text-red-500">Z.Roja</th>
                  <th className="p-4 border-b border-slate-800 text-right">Stock</th>
                  <th className="p-4 border-b border-slate-800 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-800">
                {sortedSkus.slice(0, 50).map((sku, index) => {
                  // Real-time DDMRP Recalculation
                  const dyYellow = parseFloat((sku.adu * sku.leadTime).toFixed(2));
                  const dyRedBase = parseFloat((sku.adu * sku.leadTime * simLTF).toFixed(2));
                  const dyRedAlert = parseFloat((sku.adu * sku.leadTime * sku.variabilityFactor).toFixed(2));
                  const dyRedTotal = Math.floor(dyRedBase + dyRedAlert);

                  // Smart Positioning: Show below for first 2 rows, above for others
                  const chartPositionClass = index < 2 ? 'top-full mt-2' : 'bottom-full mb-2';

                  return (
                    <tr key={sku.id} className="hover:bg-slate-800/50 transition-colors group">
                      <td className="p-4 relative group/sku">
                        {/* Hover Sparkline Chart */}
                        <div className={`absolute left-0 ${chartPositionClass} w-72 h-40 bg-dark-900 border border-slate-700 rounded-lg shadow-xl z-50 hidden group-hover/sku:block p-2 pointer-events-none`}>
                          <p className="text-[10px] text-slate-400 mb-1 pl-1 font-bold">Historial Demanda (90 días)</p>
                          <ResponsiveContainer width="100%" height="90%">
                            <AreaChart data={sku.history}>
                              <defs>
                                <linearGradient id={`grad-${sku.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <XAxis
                                dataKey="date"
                                tickFormatter={(tick) => {
                                  // Mostrar DD/MM
                                  if (!tick) return '';
                                  const d = new Date(tick);
                                  return `${d.getDate()}/${d.getMonth() + 1}`;
                                }}
                                tick={{ fontSize: 9, fill: '#64748b' }}
                                axisLine={false}
                                tickLine={false}
                                interval="preserveStartEnd"
                              />
                              <YAxis
                                tick={{ fontSize: 9, fill: '#64748b' }}
                                axisLine={false}
                                tickLine={false}
                                width={30}
                              />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '10px', padding: '4px' }}
                                labelStyle={{ color: '#94a3b8' }}
                                itemStyle={{ color: '#3b82f6' }}
                                formatter={(value: number) => [value, 'Demanda']}
                                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                              />
                              <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#3b82f6"
                                strokeWidth={1.5}
                                fill={`url(#grad-${sku.id})`}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="font-medium text-white group-hover:text-primary-400 transition-colors cursor-help">{sku.id}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                            {sku.abc}{sku.xyz}
                          </span>
                          <span className="text-[10px] text-slate-500">{sku.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right text-slate-300 font-mono">{sku.adu}</td>
                      <td className="p-4 text-right text-slate-400 font-mono text-xs">{sku.stdDev}</td>
                      <td className="p-4 text-right text-slate-400 font-mono text-xs">{(sku.adu > 0 ? sku.stdDev / sku.adu : 0).toFixed(2)}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${sku.periods && sku.periods >= 4 ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                          {sku.periods || 0}m
                        </span>
                      </td>
                      <td className="p-4 text-right text-slate-300 font-mono text-xs">
                        {sku.turnover ? `${sku.turnover.toFixed(1)}x` : '0x'}
                      </td>
                      <td className="p-4 text-right font-mono text-yellow-500/80">
                        {dyYellow}
                        <div className="text-[9px] text-slate-500">LT: {sku.leadTime}d</div>
                      </td>
                      <td className="p-4 text-right font-mono text-red-500">
                        {dyRedTotal}
                        <div className="text-[9px] text-slate-500">Base: {dyRedBase}</div>
                      </td>
                      <td className="p-4 text-right">
                        <div className={`font-bold ${sku.stockLevel < dyRedTotal ? 'text-red-500' : 'text-green-500'}`}>
                          {sku.stockLevel.toLocaleString()}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {sku.stockLevel < dyRedTotal ? (
                          <div className="w-2 h-2 rounded-full bg-red-500 mx-auto animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                        ) : sku.stockLevel < (dyRedTotal + dyYellow) ? (
                          <div className="w-2 h-2 rounded-full bg-yellow-500 mx-auto"></div>
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-green-500 mx-auto"></div>
                        )}
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


import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';

export const DataManagement: React.FC = () => {
  const { skus, resetData, isLoading, uploadStatus } = useData();


  const allUploaded = uploadStatus?.maestro && uploadStatus?.demanda && uploadStatus?.movimientos && uploadStatus?.stock && uploadStatus?.produccion;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Card */}
        <div className="bg-dark-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Estado de la Base de Datos</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total SKUs</span>
              <span className="text-white font-mono font-bold">{skus.length}</span>
            </div>
            {/* File Checklist */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">1. Maestro de Artículos</span>
                {uploadStatus?.maestro ?
                  <span className="text-green-500 text-xs font-bold px-2 py-0.5 bg-green-500/10 rounded flex items-center gap-1"><span className="material-symbols-rounded text-sm">check_circle</span> CARGADO</span> :
                  <span className="text-slate-600 text-xs font-bold px-2 py-0.5 bg-slate-800 rounded">PENDIENTE</span>
                }
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">2. Plan de Ventas</span>
                {uploadStatus?.demanda ?
                  <span className="text-green-500 text-xs font-bold px-2 py-0.5 bg-green-500/10 rounded flex items-center gap-1"><span className="material-symbols-rounded text-sm">check_circle</span> CARGADO</span> :
                  <span className="text-slate-600 text-xs font-bold px-2 py-0.5 bg-slate-800 rounded">PENDIENTE</span>
                }
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">3. Movimientos Stock</span>
                {uploadStatus?.movimientos ?
                  <span className="text-green-500 text-xs font-bold px-2 py-0.5 bg-green-500/10 rounded flex items-center gap-1"><span className="material-symbols-rounded text-sm">check_circle</span> CARGADO</span> :
                  <span className="text-slate-600 text-xs font-bold px-2 py-0.5 bg-slate-800 rounded">PENDIENTE</span>
                }
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">4. Stock Actual</span>
                {uploadStatus?.stock ?
                  <span className="text-green-500 text-xs font-bold px-2 py-0.5 bg-green-500/10 rounded flex items-center gap-1"><span className="material-symbols-rounded text-sm">check_circle</span> CARGADO</span> :
                  <span className="text-slate-600 text-xs font-bold px-2 py-0.5 bg-slate-800 rounded">PENDIENTE</span>
                }
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">5. Planes de Producción</span>
                {uploadStatus?.produccion ?
                  <span className="text-green-500 text-xs font-bold px-2 py-0.5 bg-green-500/10 rounded flex items-center gap-1"><span className="material-symbols-rounded text-sm">check_circle</span> CARGADO</span> :
                  <span className="text-slate-600 text-xs font-bold px-2 py-0.5 bg-slate-800 rounded">PENDIENTE</span>
                }
              </div>
            </div>

            {allUploaded && (
              <div className="mt-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm text-center font-bold animate-pulse">
                ¡Datos Completos! Dashboard Actualizado
              </div>
            )}

            <button
              onClick={resetData}
              className="w-full mt-4 text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/50 p-2 rounded transition-all"
            >
              Reiniciar Base de Datos REAl
            </button>
          </div>
        </div>

        {/* Sync Status Info Zone */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-dark-900 border border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center h-[300px]">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 text-green-500 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
              <span className="material-symbols-rounded text-5xl">cloud_sync</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Sincronización Automática Activa</h3>
            <p className="text-slate-400 max-w-lg mx-auto mb-6">
              Esta aplicación está conectada directamente a <span className="text-white font-bold">Supabase</span>.
              Los datos se actualizan automáticamente todos los días a las 06:00 AM mediante scripts de servidor.
            </p>

            <div className="flex gap-4">
              <div className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs font-bold text-slate-300">LIVE CONNECTION</span>
              </div>
              <div className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 flex items-center gap-2">
                <span className="material-symbols-rounded text-xs text-primary-400">database</span>
                <span className="text-xs font-bold text-slate-300">READ-ONLY MODE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Console Panel */}
      <div className="lg:col-span-3 bg-black/50 border border-slate-800 rounded-xl p-4 font-mono text-xs">
        <h4 className="text-slate-400 font-bold mb-2 flex items-center gap-2">
          <span className="material-symbols-rounded text-sm">terminal</span>
          Consola de Depuración (Frontend &rarr; Backend)
        </h4>
        <div className="h-32 overflow-y-auto bg-black p-2 rounded text-green-400 space-y-1">
          {isLoading && <div className="animate-pulse">&gt; Procesando solicitud...</div>}
          {(useData().debugLogs || []).map((log, i) => (
            <div key={i} className="border-b border-white/5 pb-1">&gt; {log}</div>
          ))}
          {(!useData().debugLogs || useData().debugLogs.length === 0) && <div className="text-slate-600">Esperando eventos...</div>}
          <div className="text-slate-500 mt-2 border-t border-slate-800 pt-1">
            Estado Uploads: {JSON.stringify(useData().uploadStatus)}
          </div>
        </div>
      </div>

      {/* Raw Data Preview */}
      <div className="bg-dark-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Explorador de Registros Brutos</h3>
          <div className="flex gap-2">
            <div className="relative">
              <span className="material-symbols-rounded absolute left-3 top-2.5 text-slate-500 text-sm">search</span>
              <input
                type="text"
                placeholder="Buscar en DB..."
                className="bg-slate-800 border-none rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto h-[400px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-dark-900 z-10 border-b border-slate-800">
              <tr className="text-slate-500 uppercase font-bold">
                <th className="p-4">SKU</th>
                <th className="p-4">Descripción</th>
                <th className="p-4">Categoría</th>
                <th className="p-4 text-right">Stock</th>
                <th className="p-4 text-center">Lead Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-400">
              {skus.slice(0, 50).map(s => (
                <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-mono text-primary-400">{s.id}</td>
                  <td className="p-4">{s.name}</td>
                  <td className="p-4">{s.category}</td>
                  <td className="p-4 text-right">{s.stockLevel}</td>
                  <td className="p-4 text-center">{s.leadTime}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-900/50 text-center border-t border-slate-800">
          <span className="text-xs text-slate-500">Mostrando primeros 50 de {skus.length} registros</span>
        </div>
      </div>
    </div>
  );
};

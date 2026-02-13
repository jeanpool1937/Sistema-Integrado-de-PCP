
import React, { useState } from 'react';
import { DataProvider, useData } from './contexts/DataContext';
import { Dashboard } from './pages/Dashboard';
import { DemandPlanning } from './pages/DemandPlanning';
import { InventoryOptimization } from './pages/InventoryOptimization';
import { SupplyPlanning } from './pages/SupplyPlanning';
import { DataManagement } from './pages/DataManagement';
import { StockProjection } from './pages/StockProjection';
import { FilterBar } from './components/FilterBar';


enum View {
  DASHBOARD = 'dashboard',
  DEMAND = 'demand',
  INVENTORY = 'inventory',
  SUPPLY = 'supply',
  DATABASE = 'database',
  PROJECTION = 'projection',
}

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const { skus } = useData();

  // Global Segmentation Filters
  const [selectedJerarquia, setSelectedJerarquia] = useState('');
  const [selectedGrupo, setSelectedGrupo] = useState('');

  // Filtered SKUs based on global filters
  const filteredSkus = skus.filter(s =>
    (!selectedJerarquia || s.jerarquia1 === selectedJerarquia) &&
    (!selectedGrupo || s.grupoArticulosDesc === selectedGrupo)
  );

  const showFilterBar = [View.DASHBOARD, View.DEMAND, View.INVENTORY, View.SUPPLY].includes(currentView);

  const renderContent = () => {
    switch (currentView) {
      case View.DASHBOARD: return <Dashboard onViewChange={setCurrentView} filteredSkus={filteredSkus} />;
      case View.DEMAND: return <DemandPlanning filteredSkus={filteredSkus} selectedJerarquia={selectedJerarquia} selectedGrupo={selectedGrupo} />;
      case View.INVENTORY: return <InventoryOptimization filteredSkus={filteredSkus} />;
      case View.SUPPLY: return <SupplyPlanning filteredSkus={filteredSkus} />;
      case View.DATABASE: return <DataManagement />;
      case View.PROJECTION: return <StockProjection />;
      default: return <Dashboard onViewChange={setCurrentView} filteredSkus={filteredSkus} />;
    }
  };

  const NavItem = ({ view, icon, label }: { view: View; icon: string; label: string }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${currentView === view
        ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
    >
      <span className="material-symbols-rounded">{icon}</span>
      {label}
    </button>
  );

  return (
    <div className="flex h-screen bg-dark-950 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary-600/20">
              <span className="material-symbols-rounded">psychology</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">A+I Planning</h1>
              <p className="text-[10px] uppercase tracking-widest text-primary-500 font-bold">Engine v3.0</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 px-2">Análisis</div>
          <NavItem view={View.DASHBOARD} icon="dashboard" label="Dashboard General" />
          <NavItem view={View.DEMAND} icon="trending_up" label="Plan. de Demanda" />

          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 mt-6 px-2">Operaciones</div>
          <NavItem view={View.INVENTORY} icon="inventory_2" label="Opt. Inventario" />
          <NavItem view={View.SUPPLY} icon="conveyor_belt" label="Suministro & Prod." />
          <NavItem view={View.PROJECTION} icon="stacked_line_chart" label="Proyección Stock" />

          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 mt-6 px-2">Sistema</div>
          <NavItem view={View.DATABASE} icon="database" label="Gestión de Datos" />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
              PCP
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">Planificador</p>
              <p className="text-[10px] text-slate-400">Master Planner</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-dark-950 relative">
        <header className="sticky top-0 z-20 bg-dark-950/80 backdrop-blur-md border-b border-slate-800 px-8 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {currentView === View.DASHBOARD && 'Visión General'}
              {currentView === View.DEMAND && 'Planificación de Demanda'}
              {currentView === View.INVENTORY && 'Optimización de Inventario'}
              {currentView === View.SUPPLY && 'Planificación de Suministro'}
              {currentView === View.PROJECTION && 'Proyección de Stock (Daily Bucket)'}
              {currentView === View.DATABASE && 'Base de Datos de Planificación'}
            </h2>
            <p className="text-sm text-slate-400">
              {currentView === View.DATABASE ? 'Sincronización y persistencia de registros' : `Análisis activo sobre ${filteredSkus.length} SKUs${selectedJerarquia ? ` · ${selectedJerarquia}` : ''}`}
            </p>
          </div>

        </header>

        <div className="p-8">
          {/* Global Filter Bar */}
          {showFilterBar && (
            <FilterBar
              skus={skus}
              selectedJerarquia={selectedJerarquia}
              setSelectedJerarquia={setSelectedJerarquia}
              selectedGrupo={selectedGrupo}
              setSelectedGrupo={setSelectedGrupo}
            />
          )}
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <DataProvider>
    <AppContent />
  </DataProvider>
);

export default App;

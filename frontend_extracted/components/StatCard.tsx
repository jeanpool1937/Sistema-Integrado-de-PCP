import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  icon: string;
  color?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, trend, trendUp, icon, color = "bg-primary-600" }) => {
  return (
    <div className="bg-dark-900 border border-slate-800 p-6 rounded-xl shadow-sm hover:border-slate-700 transition-colors">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
        </div>
        <div className={`p-3 rounded-lg ${color} bg-opacity-10 text-white`}>
          <span className="material-symbols-rounded text-2xl" style={{ color: color.replace('bg-', 'text-').replace('-600', '-400') }}>{icon}</span>
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-sm">
          <span className={`flex items-center ${trendUp ? 'text-green-400' : 'text-red-400'}`}>
            <span className="material-symbols-rounded text-base mr-1">
              {trendUp ? 'trending_up' : 'trending_down'}
            </span>
            {trend}
          </span>
          <span className="text-slate-500 ml-2">vs mes anterior</span>
        </div>
      )}
    </div>
  );
};

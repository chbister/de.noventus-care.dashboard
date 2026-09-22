import React, { useState } from 'react';
import { Brain, Bell, Grid3x3, Sliders } from 'lucide-react';
import ForecastPanel from '@/components/dashboard/ForecastPanel';
import AlertsPanel from '@/components/dashboard/AlertsPanel';
import CrossFacilityHeatmap from '@/components/dashboard/CrossFacilityHeatmap';
import WhatIfSimulator from '@/components/dashboard/WhatIfSimulator';

const TABS = [
  { key: 'forecast', label: 'KI-Prognose', icon: Brain, component: ForecastPanel },
  { key: 'alerts', label: 'Alerts', icon: Bell, component: AlertsPanel },
  { key: 'benchmark', label: 'Benchmark', icon: Grid3x3, component: CrossFacilityHeatmap },
  { key: 'simulator', label: 'Prognose-Tool', icon: Sliders, component: WhatIfSimulator },
];

export default function KIAnalyse() {
  const [activeTab, setActiveTab] = useState('forecast');
  const ActiveComponent = TABS.find(t => t.key === activeTab)?.component || ForecastPanel;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">KI-Analyse</h1>
        <p className="text-xs text-slate-500 mt-0.5">Forecasting · Alerts · Benchmarking · What-If-Simulator</p>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      <ActiveComponent />
    </div>
  );
}
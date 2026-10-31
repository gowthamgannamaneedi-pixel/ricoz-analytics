import React from 'react';
import { ShieldCheck, Zap, Layers, Activity, Database, FileText, Calculator } from 'lucide-react';
import { useInView } from './useScrollAnimation';
import Interactive3DCard from './Interactive3DCard';

export default function StatsBanner() {
  const [bannerRef, bannerInView] = useInView({ threshold: 0.1 });

  const stats = [
    {
      displayValue: 'Multi-Source',
      label: 'Data Connectors',
      description: 'PostgreSQL, MongoDB, REST APIs, and CSV/Excel files',
      icon: Database,
      badge: 'Integrated'
    },
    {
      displayValue: 'Automated',
      label: 'Scheduled Reports',
      description: 'Pixel-perfect PDF digests delivered directly to leadership',
      icon: FileText,
      badge: 'Scheduled'
    },
    {
      displayValue: 'Standardized',
      label: 'Governed KPI Studio',
      description: 'Unified gross profit, margin, and per-hub calculation logic',
      icon: Calculator,
      badge: 'Programmatic'
    },
    {
      displayValue: 'Proactive',
      label: 'Threshold Alerts',
      description: 'Configurable metric monitoring and email notifications',
      icon: ShieldCheck,
      badge: 'Active Guard'
    },
  ];

  return (
    <section 
      ref={bannerRef}
      id="stats"
      className="border-y border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F19] py-10 lg:py-14 transition-colors duration-200 overflow-hidden relative"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex flex-col items-center text-center shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-3 shadow-2xs">
                <stat.icon size={22} />
              </div>
              <div className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
                {stat.displayValue}
              </div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                {stat.label}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 max-w-[220px] leading-relaxed">
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

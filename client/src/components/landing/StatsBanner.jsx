import React from 'react';
import { ShieldCheck, Zap, Layers, Activity } from 'lucide-react';

export default function StatsBanner() {
  const stats = [
    {
      value: '99.9%',
      label: 'Pipeline SLA & Uptime',
      description: 'Continuous real-time ingestion with zero data drops',
      icon: Activity,
    },
    {
      value: '10x+',
      label: 'Faster Insight Velocity',
      description: 'From raw event to executive cockpit in seconds',
      icon: Zap,
    },
    {
      value: '50+',
      label: 'Enterprise Connectors',
      description: 'SQL, Cloud Warehouses, Sheets, and Webhooks',
      icon: Layers,
    },
    {
      value: '24/7',
      label: 'Proactive AI Alerting',
      description: 'Intelligent anomaly detection before issues impact revenue',
      icon: ShieldCheck,
    },
  ];

  return (
    <section className="border-y border-slate-200 bg-white py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          {stats.map((stat, idx) => (
            <div
              key={stat.label}
              className={`flex flex-col items-center text-center ${
                idx !== 0 ? 'pt-6 sm:pt-0 sm:pl-6' : ''
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-3">
                <stat.icon size={24} />
              </div>
              <div className="text-4xl lg:text-5xl font-black text-red-600 tracking-tight mb-1">
                {stat.value}
              </div>
              <div className="text-base font-bold text-slate-900 mb-1">
                {stat.label}
              </div>
              <div className="text-xs text-slate-500 max-w-[220px]">
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import React from 'react';
import { ShieldCheck, Zap, Layers, Activity } from 'lucide-react';
import { useInView, useCounter } from './useScrollAnimation';
import Interactive3DCard from './Interactive3DCard';

export default function StatsBanner() {
  const [bannerRef, bannerInView] = useInView({ threshold: 0.1 });

  // Animated counters triggered on scroll into view
  const uptimeCount = useCounter(99.9, 1, bannerInView, 1500);
  const velocityCount = useCounter(10, 0, bannerInView, 1200);
  const connectorsCount = useCounter(50, 0, bannerInView, 1400);

  const stats = [
    {
      displayValue: bannerInView ? `${uptimeCount}%` : '99.9%',
      label: 'Continuous Ingestion Rate',
      description: 'Sub-second streaming pipeline with automated recovery',
      icon: Activity,
      graphic: (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="2.5" />
            <circle
              cx="24"
              cy="24"
              r="21"
              fill="none"
              stroke="#DC2626"
              strokeWidth="2.5"
              strokeDasharray="132"
              style={{
                strokeDashoffset: bannerInView ? 1.3 : 132,
                transition: 'stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              strokeLinecap="round"
            />
          </svg>
        </div>
      )
    },
    {
      displayValue: bannerInView ? `${velocityCount}x+` : '10x+',
      label: 'Faster Insight Velocity',
      description: 'From raw event to executive cockpit in seconds',
      icon: Zap,
      graphic: (
        <div className="absolute -bottom-1 -right-1 w-6 h-6 flex items-center justify-center">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping opacity-60" />
        </div>
      )
    },
    {
      displayValue: bannerInView ? `${connectorsCount}+` : '50+',
      label: 'Enterprise Connectors',
      description: 'SQL, Cloud Warehouses, Sheets, and Webhooks',
      icon: Layers,
      graphic: (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg className="w-16 h-16" viewBox="0 0 48 48">
            <circle cx="24" cy="6" r="2.5" fill="#DC2626" className="animate-pulse" />
            <circle cx="42" cy="24" r="2.5" fill="#DC2626" className="animate-pulse" style={{ animationDelay: '300ms' }} />
            <circle cx="24" cy="42" r="2.5" fill="#DC2626" className="animate-pulse" style={{ animationDelay: '600ms' }} />
            <circle cx="6" cy="24" r="2.5" fill="#DC2626" className="animate-pulse" style={{ animationDelay: '900ms' }} />
          </svg>
        </div>
      )
    },
    {
      displayValue: '24/7',
      label: 'Proactive AI Alerting',
      description: 'Intelligent anomaly detection before issues impact revenue',
      icon: ShieldCheck,
      graphic: (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full border border-red-500/30 animate-ping" style={{ animationDuration: '3s' }} />
        </div>
      )
    },
  ];

  return (
    <section 
      ref={bannerRef}
      id="stats"
      className="border-y border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F19] py-14 lg:py-18 transition-colors duration-200 overflow-hidden relative"
      style={{ perspective: '1200px' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, idx) => (
            <Interactive3DCard
              key={stat.label}
              maxTilt={12}
              scale={1.04}
              glare={true}
              className="p-6 rounded-2xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center text-center shadow-xs hover:border-red-400 dark:hover:border-red-800 transition-colors"
            >
              <div 
                className="relative w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-3.5 shadow-sm"
                style={{ transform: 'translateZ(25px)' }}
              >
                {stat.graphic}
                <stat.icon size={26} className="relative z-10" />
              </div>
              <div 
                className="text-4xl lg:text-5xl font-black text-red-600 dark:text-red-400 tracking-tight mb-1.5 font-mono"
                style={{ transform: 'translateZ(30px)' }}
              >
                {stat.displayValue}
              </div>
              <div 
                className="text-base font-bold text-slate-900 dark:text-white mb-1"
                style={{ transform: 'translateZ(15px)' }}
              >
                {stat.label}
              </div>
              <div 
                className="text-xs text-slate-500 dark:text-slate-400 max-w-[220px] leading-relaxed"
                style={{ transform: 'translateZ(10px)' }}
              >
                {stat.description}
              </div>
            </Interactive3DCard>
          ))}
        </div>
      </div>
    </section>
  );
}

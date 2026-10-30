import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, ShieldCheck, CheckCircle2, Play } from 'lucide-react';
import Interactive3DCard from './Interactive3DCard';

export default function CallToAction({ onOpenDemo }) {
  return (
    <section 
      className="py-20 lg:py-28 bg-slate-50 dark:bg-[#0B0F19] transition-colors duration-200"
      style={{ perspective: '1200px' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Interactive3DCard
          maxTilt={6}
          scale={1.01}
          glare={true}
          className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white p-8 sm:p-14 lg:p-16 border border-slate-800 shadow-2xl overflow-hidden text-center"
        >
          {/* Ambient Red Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-64 bg-red-600/25 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-4xl mx-auto space-y-6" style={{ transformStyle: 'preserve-3d' }}>
            <div 
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-600/20 border border-red-500/30 text-red-400 text-xs sm:text-sm font-bold tracking-wide"
              style={{ transform: 'translateZ(20px)' }}
            >
              <Sparkles size={15} className="text-red-400 animate-pulse" />
              <span>Launch Your Sovereign Analytics Cockpit</span>
            </div>

            <h2 
              className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight"
              style={{ transform: 'translateZ(25px)' }}
            >
              Ready to Turn Fragmented Business Data Into{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-400 to-red-400">
                Measurable Action?
              </span>
            </h2>

            <p 
              className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed"
              style={{ transform: 'translateZ(15px)' }}
            >
              Connect your database in under 3 minutes. Test automated KPI formulas, interactive dashboards, and AI anomaly alerts with your real business data.
            </p>

            <div 
              className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
              style={{ transform: 'translateZ(30px)' }}
            >
              <Link
                to="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-base transition-all shadow-xl shadow-red-600/30 hover:shadow-red-600/50 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer hover:scale-105"
              >
                <span>Start 14-Day Free Trial</span>
                <ArrowRight size={18} />
              </Link>

              <button
                type="button"
                onClick={onOpenDemo}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-white font-semibold text-base transition-all hover:border-slate-500 hover:-translate-y-0.5 cursor-pointer hover:scale-105"
              >
                <Play size={16} className="text-red-500 fill-red-500" />
                <span>Schedule Solutions Demo</span>
              </button>
            </div>

            <div 
              className="pt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-slate-400"
              style={{ transform: 'translateZ(10px)' }}
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-400" /> Free 14-day enterprise trial
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-400" /> No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-400" /> Instant SQL &amp; Sheet Connectors
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-400" /> Enterprise RBAC &amp; Governance
              </span>
            </div>
          </div>
        </Interactive3DCard>
      </div>
    </section>
  );
}

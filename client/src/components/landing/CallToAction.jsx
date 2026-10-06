import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function CallToAction({ onOpenDemo }) {
  return (
    <section className="py-20 lg:py-28 bg-gradient-to-b from-white via-slate-900 to-slate-950 text-white relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs sm:text-sm font-bold tracking-wide shadow-lg shadow-red-600/40 border border-red-400/30">
          <Sparkles size={15} className="text-white shrink-0" />
          <span>Transform Your Business Intelligence Today</span>
        </div>

        <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-tight">
          Ready to Supercharge Your Data With{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-400 to-red-400">
            RicozAnalytics?
          </span>
        </h2>

        <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Join high-growth enterprises and multi-unit franchise leaders making real-time, data-driven decisions with unified BI.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            to="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-base transition-all shadow-xl shadow-red-600/30 hover:shadow-red-600/50 hover:-translate-y-0.5"
          >
            <span>Launch Free Workspace</span>
            <ArrowRight size={18} />
          </Link>

          <Link
            to="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold text-base transition-all hover:border-slate-500"
          >
            <span>Sign In to Existing Portal</span>
          </Link>
        </div>

        <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-400" /> Free 14-day enterprise trial
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-400" /> No credit card required
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-400" /> Instant SQL &amp; Sheet Connectors
          </span>
        </div>
      </div>
    </section>
  );
}

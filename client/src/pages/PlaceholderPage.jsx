import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Layers, ShieldCheck, Database, CheckCircle2 } from 'lucide-react';

/**
 * Professional Light-First Placeholder Component for Scheduled Roadmap Modules
 * @param {{
 *   title: string,
 *   description: string,
 *   phase: string,
 *   plannedFeatures: string[]
 * }} props
 */
export default function PlaceholderPage({
  title = 'Module In Active Development',
  description = 'This feature is part of the scheduled roadmap phases and will be integrated into the analytics telemetry pipeline.',
  phase = 'Upcoming Phase',
  plannedFeatures = []
}) {
  return (
    <div className="space-y-6">
      {/* Header Context Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-mono font-semibold uppercase mb-2">
            <Clock className="h-3.5 w-3.5 text-blue-600" />
            <span>Target: {phase}</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">{description}</p>
        </div>

        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
          <span>Back to Overview</span>
        </Link>
      </div>

      {/* Structured Technical Specifications Preview */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-7 space-y-6 shadow-2xs">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Module Architecture Specifications
              </h3>
              <p className="text-xs text-slate-500">Contract & routing specifications</p>
            </div>
          </div>
          <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            Scheduled Integration
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
          The API routing contracts and UI layout placeholders for <strong className="text-slate-900 font-semibold">{title}</strong> are registered in the core workspace router. Implementation will be executed in accordance with <strong className="text-blue-700 font-mono font-semibold">{phase}</strong>.
        </p>

        {plannedFeatures.length > 0 && (
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Planned Capabilities & Contracts:
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {plannedFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <span className="font-medium leading-relaxed">{feat}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

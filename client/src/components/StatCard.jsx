import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Enterprise Metric Stat Card
 * @param {{
 *   title: string,
 *   value: string,
 *   change?: string,
 *   isPositive?: boolean,
 *   period?: string,
 *   subtext?: string,
 *   isPrimary?: boolean
 * }} props
 */
export default function StatCard({
  title,
  value,
  change,
  isPositive,
  period = 'vs previous period',
  subtext,
  isPrimary = false,
  icon: Icon
}) {
  return (
    <div className={`relative min-w-0 p-4 bg-white border border-slate-200 rounded-lg shadow-xs transition-colors hover:border-slate-300 ${isPrimary ? 'border-brand-200 bg-brand-50/40' : ''}`}>
      {/* Metric Label */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </span>
        {Icon && <span className={`flex h-7 w-7 items-center justify-center rounded-md ${isPrimary ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600'}`}><Icon className="h-3.5 w-3.5" /></span>}
      </div>

      {/* Main Metric Value */}
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl sm:text-[28px] font-semibold tracking-tight text-slate-950">
          {value}
        </span>
      </div>

      {/* Delta & Comparison Period */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1 text-xs">
        {change && (
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono text-[11px] font-bold ${
                isPositive === true
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : isPositive === false
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {isPositive === true ? (
                <TrendingUp className="h-3 w-3 text-emerald-600" />
              ) : isPositive === false ? (
                <TrendingDown className="h-3 w-3 text-rose-600" />
              ) : (
                <Minus className="h-3 w-3 text-slate-500" />
              )}
              {change}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">{period}</span>
          </div>
        )}

        {subtext && (
          <span className="text-[11px] font-mono text-slate-400 font-medium ml-auto">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
}

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
    <div className={`relative min-w-0 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs transition-colors hover:border-slate-300 dark:hover:border-slate-700 ${isPrimary ? 'border-brand-200 dark:border-brand-900/60 bg-brand-50/40 dark:bg-brand-950/20' : ''}`}>
      {/* Metric Label */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </span>
        {Icon && <span className={`flex h-7 w-7 items-center justify-center rounded-md ${isPrimary ? 'bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}><Icon className="h-3.5 w-3.5" /></span>}
      </div>

      {/* Main Metric Value */}
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl sm:text-[28px] font-semibold tracking-tight text-slate-950 dark:text-slate-50">
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
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                  : isPositive === false
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {isPositive === true ? (
                <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              ) : isPositive === false ? (
                <TrendingDown className="h-3 w-3 text-rose-600 dark:text-rose-400" />
              ) : (
                <Minus className="h-3 w-3 text-slate-500 dark:text-slate-400" />
              )}
              {change}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{period}</span>
          </div>
        )}

        {subtext && (
          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 font-medium ml-auto">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
}

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
  isPrimary = false
}) {
  return (
    <div className="relative p-4 sm:p-5 bg-white transition-colors hover:bg-slate-50/50">
      {/* Metric Label */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">
          {title}
        </span>
      </div>

      {/* Main Metric Value */}
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
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

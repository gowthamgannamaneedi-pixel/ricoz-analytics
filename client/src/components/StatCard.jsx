import React from 'react';
import { TrendingUp, TrendingDown, Minus, MoreVertical } from 'lucide-react';

/**
 * Mini Sparkline SVG Generator
 */
function SparklineLine({ points = [], color = '#D91542' }) {
  if (!points || points.length < 2) return null;
  const valid = points.map(Number).filter(v => !isNaN(v));
  if (valid.length < 2) return null;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const width = 76;
  const height = 24;
  const pathD = valid
    .map((val, idx) => {
      const x = (idx / (valid.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0 select-none">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Enterprise Metric Stat Card matching design handoff (Page 2, 5, 29)
 * 
 * Spec:
 * - Red icon (#D91542) on pale red container (#FFF1F3)
 * - 20px card icon, 16-24px internal padding (p-5 sm:p-6)
 * - White surface, subtle border, subtle shadow
 * - Clear numeric value (28-32px), title (12-14px supporting text)
 * - Meaningful status trend badge (green positive, red negative)
 */
export default function StatCard({
  title,
  value,
  change,
  isPositive,
  period = 'vs previous period',
  subtext,
  bottomStrip,
  bottomValue,
  sparklinePoints,
  sparklineColor = '#D91542',
  icon: Icon,
  className = ''
}) {
  return (
    <div
      className={`relative flex flex-col justify-between p-6 sm:p-7 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs hover:shadow-xs hover:border-rose-200 dark:hover:border-rose-900/60 transition-all duration-200 min-h-[180px] ${className}`}
    >
      <div>
        {/* Top Header Row: Red icon on pale red container */}
        <div className="flex items-center justify-between">
          {Icon ? (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF1F3] dark:bg-rose-950/40 text-[#D91542] dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/50 shadow-2xs">
              <Icon className="h-5.5 w-5.5" strokeWidth={2} />
            </div>
          ) : (
            <div className="h-11" />
          )}

          <button
            type="button"
            className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            aria-label="More options"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>

        {/* Title */}
        <div className="mt-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </span>
        </div>

        {/* Main Stat & Sparkline Row */}
        <div className="mt-1.5 flex items-baseline justify-between gap-3">
          <span className="text-2xl sm:text-[28px] font-black tracking-tight text-slate-900 dark:text-slate-100 font-sans">
            {value}
          </span>

          {sparklinePoints && sparklinePoints.length >= 2 && (
            <SparklineLine points={sparklinePoints} color={sparklineColor} />
          )}
        </div>

        {/* Trend Indicator */}
        {change && (
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                isPositive === true
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : isPositive === false
                  ? 'text-[#D91542] dark:text-rose-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {isPositive === true ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : isPositive === false ? (
                <TrendingDown className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
              <span>{change}</span>
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              {period}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Highlight Strip */}
      {(bottomStrip || subtext) && (
        <div className="mt-4.5 flex items-center justify-between px-3.5 py-2 rounded-xl border border-rose-100/70 dark:border-rose-950/40 bg-[#FFF1F3]/60 dark:bg-rose-950/20 text-[#D91542] dark:text-rose-300 text-[11px] font-medium">
          <span>{bottomStrip || subtext}</span>
          {bottomValue && (
            <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
              {bottomValue}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

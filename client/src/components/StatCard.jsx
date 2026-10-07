import React from 'react';
import { TrendingUp, TrendingDown, Minus, MoreVertical } from 'lucide-react';

/**
 * Mini Sparkline SVG Generator
 */
function SparklineLine({ points = [], color = '#E11D48' }) {
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
 * Enterprise Metric Stat Card matching reference design
 * @param {{
 *   title: string,
 *   value: string,
 *   change?: string,
 *   isPositive?: boolean,
 *   period?: string,
 *   subtext?: string,
 *   bottomStrip?: string,
 *   bottomValue?: string,
 *   sparklinePoints?: number[],
 *   sparklineColor?: string,
 *   iconTheme?: 'rose' | 'emerald' | 'amber' | 'purple' | 'blue',
 *   icon: React.ComponentType,
 *   className?: string
 * }} props
 */
export default function StatCard({
  title,
  value,
  change,
  isPositive,
  period = 'from previous period',
  subtext,
  bottomStrip,
  bottomValue,
  sparklinePoints,
  sparklineColor,
  iconTheme = 'rose',
  icon: Icon,
  className = ''
}) {
  const themeMap = {
    rose: {
      iconBg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border-rose-100 dark:border-rose-900/60',
      bottomBg: 'bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 border-rose-100/60 dark:border-rose-900/40',
      sparkColor: '#E11D48'
    },
    emerald: {
      iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/60',
      bottomBg: 'bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border-emerald-100/60 dark:border-emerald-900/40',
      sparkColor: '#10B981'
    },
    amber: {
      iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border-amber-100 dark:border-amber-900/60',
      bottomBg: 'bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-amber-100/60 dark:border-amber-900/40',
      sparkColor: '#F59E0B'
    },
    purple: {
      iconBg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 border-purple-100 dark:border-purple-900/60',
      bottomBg: 'bg-purple-50/50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200 border-purple-100/60 dark:border-purple-900/40',
      sparkColor: '#A855F7'
    },
    blue: {
      iconBg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border-blue-100 dark:border-blue-900/60',
      bottomBg: 'bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 border-blue-100/60 dark:border-blue-900/40',
      sparkColor: '#3B82F6'
    }
  }[iconTheme] || {
    iconBg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    bottomBg: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-100 dark:border-slate-700',
    sparkColor: '#64748B'
  };

  const finalSparkColor = sparklineColor || themeMap.sparkColor;

  return (
    <div className={`relative flex flex-col justify-between p-5 bg-white dark:bg-slate-900 border border-slate-100/90 dark:border-slate-800 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_20px_-4px_rgba(0,0,0,0.02)] transition-all duration-200 hover:shadow-md ${className}`}>
      <div>
        {/* Top Header Row: Icon & 3-Dots */}
        <div className="flex items-center justify-between">
          {Icon ? (
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${themeMap.iconBg} shadow-2xs`}>
              <Icon className="h-4.5 w-4.5" />
            </div>
          ) : (
            <div className="h-9" />
          )}

          <button
            type="button"
            className="p-1 rounded-lg text-slate-300 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            aria-label="More options"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>

        {/* Title */}
        <div className="mt-3">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {title}
          </span>
        </div>

        {/* Main Stat & Sparkline Row */}
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-2xl sm:text-[28px] font-black tracking-tight text-slate-900 dark:text-slate-100">
            {value}
          </span>

          {sparklinePoints && sparklinePoints.length >= 2 && (
            <SparklineLine points={sparklinePoints} color={finalSparkColor} />
          )}
        </div>

        {/* Trend Indicator */}
        {change && (
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                isPositive === true
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : isPositive === false
                  ? 'text-rose-600 dark:text-rose-400'
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
        <div className={`mt-4 flex items-center justify-between px-3 py-1.5 rounded-xl border text-[11px] font-medium ${themeMap.bottomBg}`}>
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

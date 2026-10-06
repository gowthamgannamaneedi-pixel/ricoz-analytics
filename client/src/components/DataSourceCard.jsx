import React from 'react';
import { Database, FileSpreadsheet, FileCode, Layers, Server } from 'lucide-react';

/**
 * Enterprise Metric Summary Card for Data Source Types
 * @param {{
 *   type: 'csv' | 'json' | 'postgresql' | 'rest_api' | 'total',
 *   title: string,
 *   count: number,
 *   subtitle: string,
 *   isActive?: boolean,
 *   onClick?: () => void
 * }} props
 */
export default function DataSourceCard({
  type,
  title,
  count,
  subtitle,
  isActive = false,
  onClick
}) {
  const getIcon = () => {
    switch (type) {
      case 'csv':
        return (
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100/80 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
        );
      case 'json':
        return (
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-100/80 dark:border-amber-800/60 text-amber-600 dark:text-amber-400">
            <FileCode className="h-4 w-4" />
          </div>
        );
      case 'postgresql':
        return (
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-100/80 dark:border-blue-800/60 text-blue-600 dark:text-blue-400">
            <Database className="h-4 w-4" />
          </div>
        );
      case 'rest_api':
      case 'api':
        return (
          <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-100/80 dark:border-purple-800/60 text-purple-600 dark:text-purple-400">
            <Server className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300">
            <Layers className="h-4 w-4" />
          </div>
        );
    }
  };

  const handleKeyDown = (e) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`rounded-xl border p-4 sm:p-5 transition-all text-left outline-none ${
        onClick ? 'cursor-pointer' : ''
      } ${
        isActive
          ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/30 ring-1 ring-blue-500/25 shadow-2xs'
          : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/40 dark:hover:bg-slate-800/50 shadow-2xs'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          {title}
        </span>
        {getIcon()}
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {count}
        </span>
      </div>

      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
        {subtitle}
      </div>
    </div>
  );
}

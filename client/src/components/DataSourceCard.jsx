import React from 'react';
import { Database, FileSpreadsheet, FileCode, Layers } from 'lucide-react';

/**
 * Enterprise Metric Summary Card for Data Source Types
 * @param {{
 *   type: 'csv' | 'json' | 'postgresql' | 'total',
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
        return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
      case 'json':
        return <FileCode className="h-5 w-5 text-amber-600" />;
      case 'postgresql':
        return <Database className="h-5 w-5 text-blue-600" />;
      default:
        return <Layers className="h-5 w-5 text-slate-600" />;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-md border p-4 bg-white transition-all ${
        onClick ? 'cursor-pointer hover:border-slate-300' : ''
      } ${
        isActive
          ? 'border-blue-600 ring-1 ring-blue-600 shadow-2xs'
          : 'border-slate-200 shadow-2xs'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        <div className="p-1.5 rounded bg-slate-50 border border-slate-100">
          {getIcon()}
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-bold tracking-tight text-slate-900">
          {count}
        </span>
      </div>

      <div className="mt-1.5 text-xs text-slate-500">
        {subtitle}
      </div>
    </div>
  );
}

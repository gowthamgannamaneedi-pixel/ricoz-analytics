import React from 'react';

/**
 * Professional Light-First ChartCard Container
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   action?: React.ReactNode,
 *   children: React.ReactNode,
 *   className?: string
 * }} props
 */
export default function ChartCard({
  title,
  subtitle,
  action,
  children,
  className = ''
}) {
  return (
    <div className={`flex flex-col rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && (
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            {action}
          </div>
        )}
      </div>

      {/* Chart Body */}
      <div className="flex-1 w-full min-h-[260px]">
        {children}
      </div>
    </div>
  );
}

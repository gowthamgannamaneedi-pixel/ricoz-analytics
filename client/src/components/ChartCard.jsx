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
    <div className={`flex flex-col rounded-md border border-slate-200 bg-white p-4 sm:p-5 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3.5 border-b border-slate-100">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && (
          <div className="flex items-center gap-2 text-xs">
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

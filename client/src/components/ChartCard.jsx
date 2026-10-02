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
    <div className={`flex flex-col rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-md ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-500 font-normal mt-0.5">{subtitle}</p>
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

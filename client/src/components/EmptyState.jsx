import React from 'react';
import { Database } from 'lucide-react';

/**
 * Reusable Empty State component for when data is empty or unavailable
 */
export default function EmptyState({
  icon: Icon = Database,
  title = 'No Data Available',
  description = 'There are no records to display at this time.',
  actionLabel,
  onAction,
  className = ''
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-12 rounded-xl border border-dashed border-slate-300 bg-white shadow-2xs ${className}`}>
      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 mb-4 shadow-2xs">
        <Icon className="w-6 h-6 text-slate-600" />
      </div>
      <h4 className="text-base font-bold text-slate-900 mb-1">{title}</h4>
      <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">{description}</p>
      {actionLabel && (
        <button
          onClick={onAction}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shadow-xs"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

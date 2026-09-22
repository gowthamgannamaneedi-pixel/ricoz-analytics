import React from 'react';

/**
 * Enterprise Data Source Status Badge
 * @param {{ status: 'active' | 'connected' | 'error' | 'pending' | string }} props
 */
export default function DataSourceStatus({ status = 'active' }) {
  const normalized = (status || 'active').toLowerCase();

  const config = {
    connected: {
      label: 'Connected',
      dot: 'bg-emerald-500',
      pill: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    active: {
      label: 'Active',
      dot: 'bg-blue-500',
      pill: 'bg-blue-50 text-blue-700 border-blue-200'
    },
    pending: {
      label: 'Syncing',
      dot: 'bg-amber-500 animate-pulse',
      pill: 'bg-amber-50 text-amber-700 border-amber-200'
    },
    error: {
      label: 'Error',
      dot: 'bg-rose-500',
      pill: 'bg-rose-50 text-rose-700 border-rose-200'
    }
  }[normalized] || {
    label: normalized.toUpperCase(),
    dot: 'bg-slate-400',
    pill: 'bg-slate-50 text-slate-700 border-slate-200'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border ${config.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
}

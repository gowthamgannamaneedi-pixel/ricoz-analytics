import React from 'react';

/**
 * Enterprise Data Source Status Badge
 * Communicates connection health and ingestion readiness
 * @param {{ status: 'active' | 'connected' | 'error' | 'pending' | string }} props
 */
export default function DataSourceStatus({ status = 'active' }) {
  const normalized = (status || 'active').toLowerCase();

  const config = {
    connected: {
      label: 'Connected',
      dot: 'bg-emerald-500',
      pill: 'bg-emerald-50 text-emerald-700 border-emerald-200/90'
    },
    active: {
      label: 'Active & Ready',
      dot: 'bg-emerald-500',
      pill: 'bg-emerald-50 text-emerald-700 border-emerald-200/90'
    },
    pending: {
      label: 'Syncing...',
      dot: 'bg-amber-500 animate-pulse',
      pill: 'bg-amber-50 text-amber-700 border-amber-200/90'
    },
    syncing: {
      label: 'Syncing...',
      dot: 'bg-amber-500 animate-pulse',
      pill: 'bg-amber-50 text-amber-700 border-amber-200/90'
    },
    error: {
      label: 'Connection Error',
      dot: 'bg-rose-500',
      pill: 'bg-rose-50 text-rose-700 border-rose-200/90'
    }
  }[normalized] || {
    label: normalized.charAt(0).toUpperCase() + normalized.slice(1),
    dot: 'bg-slate-400',
    pill: 'bg-slate-50 text-slate-700 border-slate-200/90'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shadow-2xs whitespace-nowrap ${config.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
}

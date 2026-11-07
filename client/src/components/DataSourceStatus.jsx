import React from 'react';

/**
 * Enterprise Data Source Status Badge
 * Communicates connection health and ingestion readiness with context-specific enterprise status
 * @param {{ status: 'active' | 'connected' | 'error' | 'pending' | string }} props
 */
export default function DataSourceStatus({ status = 'active' }) {
  const normalized = (status || 'active').toLowerCase();

  const config = {
    connected: {
      label: 'Connection Verified',
      dot: 'bg-emerald-500',
      pill: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/90 dark:border-emerald-800/60'
    },
    active: {
      label: 'Active Pipeline',
      dot: 'bg-emerald-500',
      pill: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/90 dark:border-emerald-800/60'
    },
    pending: {
      label: 'Awaiting Ingestion',
      dot: 'bg-amber-500 animate-pulse',
      pill: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/90 dark:border-amber-800/60'
    },
    syncing: {
      label: 'Syncing Pipeline...',
      dot: 'bg-amber-500 animate-pulse',
      pill: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/90 dark:border-amber-800/60'
    },
    error: {
      label: 'Connection Error',
      dot: 'bg-rose-500',
      pill: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200/90 dark:border-rose-800/60'
    }
  }[normalized] || {
    label: normalized.charAt(0).toUpperCase() + normalized.slice(1),
    dot: 'bg-slate-400',
    pill: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-slate-700'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shadow-2xs whitespace-nowrap ${config.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
}

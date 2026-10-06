import React from 'react';
import { CheckCircle2, AlertTriangle, CircleDot, XCircle } from 'lucide-react';

const styles = {
  active: ['bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60', CheckCircle2, 'Active'],
  healthy: ['bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60', CheckCircle2, 'Healthy'],
  success: ['bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60', CheckCircle2, 'Success'],
  warning: ['bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60', AlertTriangle, 'Warning'],
  error: ['bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60', XCircle, 'Error'],
  inactive: ['bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700', CircleDot, 'Inactive'],
  pending: ['bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/60', CircleDot, 'Pending'],
};

export default function StatusBadge({ status = 'pending', children, className = '' }) {
  const [color, Icon, fallback] = styles[String(status).toLowerCase()] || styles.pending;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${color} ${className}`}><Icon className="h-3 w-3" />{children || fallback}</span>;
}

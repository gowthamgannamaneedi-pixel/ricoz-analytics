import React from 'react';
import { CheckCircle2, AlertTriangle, CircleDot, XCircle } from 'lucide-react';

const styles = {
  active: ['bg-emerald-50 text-emerald-700 border-emerald-200', CheckCircle2, 'Active'],
  healthy: ['bg-emerald-50 text-emerald-700 border-emerald-200', CheckCircle2, 'Healthy'],
  success: ['bg-emerald-50 text-emerald-700 border-emerald-200', CheckCircle2, 'Success'],
  warning: ['bg-amber-50 text-amber-700 border-amber-200', AlertTriangle, 'Warning'],
  error: ['bg-rose-50 text-rose-700 border-rose-200', XCircle, 'Error'],
  inactive: ['bg-slate-100 text-slate-600 border-slate-200', CircleDot, 'Inactive'],
  pending: ['bg-blue-50 text-blue-700 border-blue-200', CircleDot, 'Pending'],
};

export default function StatusBadge({ status = 'pending', children, className = '' }) {
  const [color, Icon, fallback] = styles[String(status).toLowerCase()] || styles.pending;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${color} ${className}`}><Icon className="h-3 w-3" />{children || fallback}</span>;
}

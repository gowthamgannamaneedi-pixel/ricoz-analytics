import React from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Shared RefreshButton — RicozAnalytics Enterprise Design System
 *
 * Props:
 *   label     – button text (default "Refresh")
 *   loading   – shows spinning icon when true
 *   size      – 'sm' | 'md' | 'lg' (default 'md')
 *   onClick
 *   className – extra classes
 *   ...rest   – forwarded to <button>
 */
export function RefreshButton({
  label = 'Refresh',
  loading = false,
  size = 'md',
  onClick,
  className = '',
  ...rest
}) {
  const sizeClasses =
    size === 'sm'
      ? 'h-8 px-3 text-xs gap-1.5'
      : size === 'lg'
      ? 'h-11 px-4 text-base gap-2.5'
      : 'h-10 px-3.5 text-sm gap-2';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={[
        'inline-flex items-center justify-center font-semibold rounded-lg',
        'text-slate-700 bg-white border border-slate-300 shadow-2xs',
        'hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900 active:bg-slate-100',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
        'transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none',
        sizeClasses,
        className,
      ].join(' ')}
      {...rest}
    >
      <RefreshCw
        className={`h-4 w-4 shrink-0 transition-transform ${loading ? 'animate-spin text-blue-600' : 'text-slate-500'}`}
        strokeWidth={2}
      />
      <span>{label}</span>
    </button>
  );
}

export default RefreshButton;

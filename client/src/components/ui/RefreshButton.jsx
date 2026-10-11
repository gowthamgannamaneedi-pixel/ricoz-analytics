import React from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Shared RefreshButton — RicozAnalytics Enterprise Design System
 *
 * Spec (Handoff Page 2, 7, 25):
 * - Standard 40px height (h-10) matching primary action buttons
 * - Standard 8px radius (rounded-lg)
 * - Standard 16px horizontal padding (px-4)
 * - Label font 14px font-semibold (text-sm)
 * - Red spinning indicator on active refresh
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
  id = 'shared-refresh-btn',
  ...rest
}) {
  const sizeClasses =
    size === 'sm'
      ? 'h-8 px-3 text-xs gap-1.5 rounded-lg'
      : size === 'lg'
      ? 'h-11 px-5 text-base gap-2.5 rounded-xl'
      : 'h-10 px-4 text-sm gap-2 rounded-lg';

  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      disabled={loading}
      className={[
        'inline-flex items-center justify-center font-semibold select-none shrink-0',
        'text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-2xs',
        'hover:bg-[#FFF1F3]/50 hover:border-rose-300 hover:text-[#D91542] dark:hover:bg-rose-950/40 dark:hover:border-rose-800 dark:hover:text-rose-300',
        'active:bg-rose-100/80 dark:active:bg-rose-900/80',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2',
        'transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        sizeClasses,
        className,
      ].join(' ')}
      {...rest}
    >
      <RefreshCw
        className={`h-4 w-4 shrink-0 transition-transform ${loading ? 'animate-spin text-[#D91542]' : 'text-slate-500 dark:text-slate-400'}`}
        strokeWidth={2}
      />
      <span>{label}</span>
    </button>
  );
}

export default RefreshButton;

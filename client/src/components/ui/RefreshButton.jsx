import React from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Shared RefreshButton — RicozAnalytics Enterprise Design System
 *
 * Spec (Handoff Page 2, 7, 9, 12):
 * - Circular arrow icon: red/rose glyph (#D91542 / #FB7185)
 * - Label: red text (#D91542 / #FB7185)
 * - Border: crimson outline (border-rose-200 / #BE123C)
 * - Background: dark burgundy / soft red (#FFF1F3 / #2B0B1B)
 * - Height: standard 40px (h-10) matching adjacent controls
 * - Standard 8px radius (rounded-lg)
 * - Standard 16px horizontal padding (px-4)
 * - Label font 14px font-semibold (text-sm)
 * - Spinning indicator on active refresh
 *
 * Props:
 *   label     – button text (default "Refresh")
 *   loading   – shows spinning icon when true
 *   isRefreshing – alias for loading
 *   size      – 'sm' | 'md' | 'lg' (default 'md')
 *   onClick
 *   className – extra classes
 *   ...rest   – forwarded to <button>
 */
export function RefreshButton({
  label = 'Refresh',
  loading = false,
  isRefreshing = false,
  size = 'md',
  onClick,
  className = '',
  id = 'shared-refresh-btn',
  ...rest
}) {
  const isLoading = Boolean(loading || isRefreshing);
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
      disabled={isLoading}
      className={[
        'inline-flex items-center justify-center font-semibold select-none shrink-0',
        'border border-rose-200 dark:border-[#BE123C]',
        'bg-[#FFF1F3] dark:bg-[#2B0B1B] text-[#D91542] dark:text-[#FB7185]',
        'hover:bg-rose-100/90 dark:hover:bg-[#3D1026] hover:border-rose-300 dark:hover:border-[#E11D48] hover:text-[#B91036] dark:hover:text-[#FDA4AF]',
        'active:bg-rose-200/80 dark:active:bg-[#1F0713]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2',
        'transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs',
        sizeClasses,
        className,
      ].join(' ')}
      {...rest}
    >
      <RefreshCw
        className={`h-4 w-4 shrink-0 transition-transform text-[#D91542] dark:text-[#FB7185] ${isLoading ? 'animate-spin' : ''}`}
        strokeWidth={2}
      />
      <span>{label}</span>
    </button>
  );
}

export default RefreshButton;

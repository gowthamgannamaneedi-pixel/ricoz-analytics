import React from 'react';
import { RotateCcw } from 'lucide-react';

/**
 * Universal Shared Reset Button — RicozAnalytics Enterprise Design System
 * 
 * Spec (Handoff Page 2, 5, 25):
 * - Visible reset icon (RotateCcw) and label "Reset"
 * - Subtle red-tinted background (#FFF1F3) and visible border (#FECDD3 / border-rose-200)
 * - Red accent text and icon (#D91542)
 * - Standard 40px height (h-10) matching adjacent controls
 * - Standard 8px radius (rounded-lg)
 * - Shared minimum width around 104px (min-w-[104px])
 * - Accessible hover, focus-visible ring, and disabled states
 */
export function ResetButton({
  label = 'Reset',
  onClick,
  disabled = false,
  loading = false,
  title = 'Reset filters to defaults',
  id = 'shared-reset-btn',
  className = '',
  size = 'md',
  ...rest
}) {
  const sizeMap = {
    sm: 'h-8 px-3 text-xs gap-1.5 min-w-[88px] rounded-lg',
    md: 'h-10 px-4 text-sm gap-2 min-w-[104px] rounded-lg',
    lg: 'h-11 px-5 text-base gap-2.5 min-w-[120px] rounded-xl',
  };

  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={[
        'inline-flex items-center justify-center font-semibold select-none',
        'border border-rose-200 dark:border-rose-900/60',
        'bg-[#FFF1F3] dark:bg-rose-950/40 text-[#D91542] dark:text-rose-300',
        'hover:bg-rose-100/90 dark:hover:bg-rose-900/50 hover:border-rose-300 dark:hover:border-rose-700 hover:text-[#B91036]',
        'active:bg-rose-200/80 dark:active:bg-rose-900/80',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        'transition-all duration-150 cursor-pointer shadow-2xs',
        sizeMap[size] || sizeMap.md,
        className,
      ].join(' ')}
      {...rest}
    >
      <RotateCcw
        className={`h-4 w-4 shrink-0 transition-transform ${loading ? 'animate-spin' : 'group-hover:-rotate-45'}`}
        strokeWidth={2}
      />
      <span>{label}</span>
    </button>
  );
}

export default ResetButton;

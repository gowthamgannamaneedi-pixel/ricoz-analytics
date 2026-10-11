import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Enterprise Select/Dropdown — RicozAnalytics Design Tokens
 *
 * Spec (Handoff Page 2, 4, 11, 22, 25):
 * - Standard control height: 40px (h-10 by default)
 * - Standard control radius: 8px (rounded-lg)
 * - Standard horizontal padding: 16px (pl-4 pr-10)
 * - Dedicated chevron vertically centered with 16px right inset (right-4)
 * - Reserved arrow space preventing label overlap
 * - White surface, dark readable text (#0F172A / slate-900), subtle border
 * - Soft red hover / focus highlight (#FFF1F3 / #D91542 ring)
 */
export function Select({
  children,
  className = '',
  size = 'md',
  disabled = false,
  ...rest
}) {
  const sizeMap = {
    sm: 'h-8 text-xs pl-3 pr-8 rounded-lg',
    md: 'h-10 text-sm pl-4 pr-10 rounded-lg',
    lg: 'h-11 text-base pl-4 pr-11 rounded-xl',
  };

  const chevronSizeMap = {
    sm: 'h-3.5 w-3.5 right-2.5',
    md: 'h-4 w-4 right-3.5',
    lg: 'h-4.5 w-4.5 right-4',
  };

  return (
    <div className={`relative inline-flex items-center min-w-[120px] ${className}`}>
      <select
        disabled={disabled}
        className={[
          sizeMap[size] || sizeMap.md,
          'w-full appearance-none',
          'border border-slate-200 dark:border-slate-700',
          'bg-white dark:bg-slate-850',
          'text-slate-900 dark:text-slate-100 font-medium',
          'hover:border-rose-300 dark:hover:border-rose-800 hover:bg-[#FFF1F3]/40 dark:hover:bg-rose-950/20',
          'focus:outline-none focus:border-[#D91542] focus:ring-2 focus:ring-[#D91542]/20',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-900',
          'transition-all duration-150 cursor-pointer shadow-2xs',
        ].join(' ')}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400 shrink-0 ${
          chevronSizeMap[size] || chevronSizeMap.md
        }`}
        strokeWidth={2}
      />
    </div>
  );
}

export default Select;

import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Shared Select/Dropdown — RicozAnalytics P1 Foundation
 *
 * Wraps a native <select> with consistent styling:
 * - Standard height (h-8 by default)
 * - Proper chevron positioned with right padding so it never clips
 * - Border, radius, focus ring matching the rest of the UI
 *
 * Props forwarded to <select> so onChange, value, disabled etc. work normally.
 */
export function Select({
  children,
  className = '',
  size = 'md',
  ...rest
}) {
  const sizeMap = {
    sm: 'h-7  text-xs  pl-3 pr-8',
    md: 'h-8  text-xs  pl-3 pr-8',
    lg: 'h-9  text-sm  pl-3.5 pr-9',
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <select
        className={[
          sizeMap[size] || sizeMap.md,
          'w-full appearance-none',
          'rounded-lg border border-slate-200 bg-white',
          'text-slate-700 font-medium',
          'hover:border-brand-500',
          'focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50',
          'transition cursor-pointer',
        ].join(' ')}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 shrink-0"
        strokeWidth={2}
      />
    </div>
  );
}

export default Select;

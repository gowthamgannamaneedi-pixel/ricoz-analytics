import React from 'react';

/**
 * Universal Shared Card Surface — RicozAnalytics Enterprise Design System
 * 
 * Spec (Handoff Page 2, 6, 25):
 * - Consistent white or neutral surfaces
 * - Predictable internal padding (default 24px: p-6)
 * - Subtle border and shadow treatment
 * - Rounded corners (8px - 16px)
 */
export function Card({
  children,
  className = '',
  padding = 'normal', // 'none' | 'sm' (16px) | 'normal' (24px) | 'lg' (32px)
  variant = 'default', // 'default' | 'subtle' | 'outline'
  ...rest
}) {
  const paddingMap = {
    none: 'p-0',
    sm: 'p-4 sm:p-5',
    normal: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  };

  const variantMap = {
    default: 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs',
    subtle: 'bg-slate-50/70 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-none',
    outline: 'bg-transparent border border-slate-200 dark:border-slate-800',
  };

  return (
    <div
      className={[
        'rounded-2xl transition-all duration-150',
        variantMap[variant] || variantMap.default,
        paddingMap[padding] || paddingMap.normal,
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Card;

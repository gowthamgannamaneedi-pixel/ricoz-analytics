import React from 'react';

/**
 * Universal Shared Icon Container — RicozAnalytics Enterprise Design System
 * 
 * Spec (Handoff Page 2, 5, 25):
 * - Red icon accent: #D91542
 * - Pale-red background container: #FFF1F3
 * - Subtle border matching container
 * - Reusable across metric cards, tiles, page icons, form and modal headers
 */
export function IconContainer({
  icon: Icon,
  children,
  size = 'md',
  className = '',
  ...rest
}) {
  const sizeMap = {
    sm: 'h-8 w-8 rounded-lg p-1.5',
    md: 'h-10 w-10 rounded-lg p-2',
    lg: 'h-12 w-12 rounded-xl p-2.5',
    xl: 'h-14 w-14 rounded-2xl p-3',
  };

  const iconSizeMap = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
    xl: 'h-7 w-7',
  };

  return (
    <div
      className={[
        'inline-flex items-center justify-center shrink-0 select-none',
        'bg-[#FFF1F3] dark:bg-rose-950/40 text-[#D91542] dark:text-rose-400',
        'border border-rose-200/80 dark:border-rose-900/50 shadow-2xs',
        sizeMap[size] || sizeMap.md,
        className,
      ].join(' ')}
      {...rest}
    >
      {Icon ? (
        <Icon className={iconSizeMap[size] || iconSizeMap.md} strokeWidth={2} />
      ) : (
        children
      )}
    </div>
  );
}

export default IconContainer;

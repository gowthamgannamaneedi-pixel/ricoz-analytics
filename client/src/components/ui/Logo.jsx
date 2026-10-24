import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Enterprise Brand Logo Component — RicozAnalytics
 *
 * Implements the official theme-responsive RicozAnalytics branding:
 * - Uses `/ricoz-logo-light-horizontal.png` & `/ricoz-logo-dark-horizontal.png` for horizontal navigation
 * - Uses `/ricoz-logo-light.png` & `/ricoz-logo-dark.png` for stacked display
 * - Uses `/favicon-light.png` & `/favicon-dark.png` for mark-only display
 * - Supports seamless CSS-driven theme toggling (zero hydration flash)
 * - Proportions, colors, and design preserved precisely
 */
const sizeClasses = {
  xs: 'h-6 sm:h-7',
  sm: 'h-8 sm:h-8',
  md: 'h-9 sm:h-10',
  lg: 'h-11 sm:h-12',
  xl: 'h-13 sm:h-14',
  '2xl': 'h-16 sm:h-20',
};

export default function Logo({
  size = 'lg',
  theme, // 'light' | 'dark' | undefined (auto-switches via Tailwind dark class)
  variant = 'horizontal', // 'horizontal' | 'stacked' | 'mark'
  linkTo,
  showLabel = false,
  badge,
  className = '',
  imgClassName = '',
  alt = 'Ricoz Analytics',
  onClick
}) {
  const heightClass = sizeClasses[size] || (size.startsWith('h-') ? size : 'h-11');

  let lightSrc = '/ricoz-logo-light-horizontal.png';
  let darkSrc = '/ricoz-logo-dark-horizontal.png';

  if (variant === 'stacked' || variant === 'full') {
    lightSrc = '/ricoz-logo-light.png';
    darkSrc = '/ricoz-logo-dark.png';
  } else if (variant === 'mark') {
    lightSrc = '/favicon-light.png';
    darkSrc = '/favicon-dark.png';
  }

  const content = (
    <div className={`inline-flex items-center gap-2.5 shrink-0 select-none ${linkTo ? '' : className}`}>
      {theme === 'light' ? (
        <img
          src={lightSrc}
          alt={alt}
          className={`${heightClass} w-auto max-w-full object-contain shrink-0 transition-opacity ${imgClassName}`}
        />
      ) : theme === 'dark' ? (
        <img
          src={darkSrc}
          alt={alt}
          className={`${heightClass} w-auto max-w-full object-contain shrink-0 transition-opacity ${imgClassName}`}
        />
      ) : (
        <>
          <img
            src={lightSrc}
            alt={alt}
            className={`${heightClass} w-auto max-w-full object-contain shrink-0 dark:hidden transition-opacity ${imgClassName}`}
          />
          <img
            src={darkSrc}
            alt={alt}
            className={`${heightClass} w-auto max-w-full object-contain shrink-0 hidden dark:block transition-opacity ${imgClassName}`}
          />
        </>
      )}

      {badge && (
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 shrink-0">
          {badge}
        </span>
      )}

      {showLabel && typeof showLabel === 'string' && (
        <span className="text-[10px] font-semibold tracking-tight text-slate-500 dark:text-slate-400 shrink-0">
          {showLabel}
        </span>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        onClick={onClick}
        className={`inline-flex items-center shrink-0 group transition-transform duration-150 hover:opacity-95 focus:outline-hidden ${className}`}
        aria-label={alt}
      >
        {content}
      </Link>
    );
  }

  return content;
}

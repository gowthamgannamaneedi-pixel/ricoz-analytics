import React from 'react';

/**
 * Enterprise Button System — RicozAnalytics
 *
 * Variants:
 *   primary   – Authoritative blue action button (main actions)
 *   secondary – Neutral outlined button with subtle border & shadow (cancel/secondary)
 *   outline   – Transparent border button
 *   tertiary  – Subtle ghost button with hover background (low emphasis)
 *   ghost     – Minimal text button with hover state
 *   danger    – Restrained semantic red destructive button
 *
 * Sizes:
 *   sm – Compact actions (h-8, 32px, text-xs)
 *   md – Standard enterprise control (h-10, 40px, text-sm) - DEFAULT
 *   lg – Hero or primary landing actions (h-11, 44px, text-base)
 */
const variantMap = {
  primary:
    'bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 hover:border-blue-700 active:bg-blue-800 active:border-blue-800 shadow-xs focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
  secondary:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900 active:bg-slate-100 shadow-2xs focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
  outline:
    'bg-transparent text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
  tertiary:
    'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 border border-transparent focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
  ghost:
    'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 border border-transparent focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
  danger:
    'bg-rose-600 text-white border border-rose-600 hover:bg-rose-700 hover:border-rose-700 active:bg-rose-800 active:border-rose-800 shadow-xs focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2',
};

const sizeMap = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm font-semibold gap-2 rounded-lg',
  lg: 'h-11 px-5 text-base font-semibold gap-2.5 rounded-xl',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  className = '',
  ...rest
}) {
  const base = [
    'inline-flex items-center justify-center select-none font-semibold',
    'transition-all duration-150 cursor-pointer',
    'focus:outline-none',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:pointer-events-none',
    variantMap[variant] || variantMap.primary,
    sizeMap[size] || sizeMap.md,
    className,
  ].join(' ');

  return (
    <button type={type} disabled={disabled || loading} className={base} {...rest}>
      {children}
    </button>
  );
}

export default Button;

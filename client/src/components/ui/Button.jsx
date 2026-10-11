import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Enterprise Button System — RicozAnalytics Design Tokens
 *
 * Spec (Handoff Page 2, 25):
 *   Primary UI accent: #D91542
 *   Pale-red hover / focus: #FFF1F3
 *   Standard control height: 40px (h-10)
 *   Standard control radius: 8px (rounded-lg)
 *   Standard horizontal padding: 16px (px-4)
 *   Standard label font: 14px font-semibold (text-sm)
 *
 * Variants:
 *   primary   – Red accent primary action (#D91542)
 *   secondary – White/neutral outlined button with subtle border & shadow, soft red hover
 *   outline   – Transparent button with visible border and soft red hover
 *   reset     – Dedicated soft-red container with visible border and red glyphs (#FFF1F3)
 *   tertiary  – Subtle ghost button with soft red hover
 *   ghost     – Minimal text button with soft red hover
 *   danger    – Destructive action button
 */
const variantMap = {
  primary:
    'bg-[#D91542] text-white border border-[#D91542] hover:bg-[#BE123C] hover:border-[#BE123C] active:bg-[#9F1239] active:border-[#9F1239] shadow-xs focus-visible:ring-2 focus-visible:ring-[#D91542] focus-visible:ring-offset-2',
  secondary:
    'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-[#FFF1F3] hover:border-rose-300 hover:text-[#D91542] dark:hover:bg-rose-950/40 dark:hover:border-rose-800 dark:hover:text-rose-300 active:bg-rose-100/90 shadow-2xs focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2',
  outline:
    'bg-transparent text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-[#FFF1F3] hover:border-rose-300 hover:text-[#D91542] dark:hover:bg-rose-950/40 dark:hover:border-rose-800 dark:hover:text-rose-300 active:bg-rose-100/90 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2',
  reset:
    'bg-[#FFF1F3] dark:bg-rose-950/40 text-[#D91542] dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100/90 dark:hover:bg-rose-900/50 hover:border-rose-300 active:bg-rose-200 shadow-2xs focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 min-w-[104px]',
  tertiary:
    'bg-transparent text-slate-600 dark:text-slate-300 hover:text-[#D91542] dark:hover:text-rose-300 hover:bg-[#FFF1F3] dark:hover:bg-rose-950/40 active:bg-rose-100/90 border border-transparent focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2',
  ghost:
    'bg-transparent text-slate-600 dark:text-slate-300 hover:text-[#D91542] dark:hover:text-rose-300 hover:bg-[#FFF1F3] dark:hover:bg-rose-950/40 active:bg-rose-100/90 border border-transparent focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2',
  danger:
    'bg-[#D91542] text-white border border-[#D91542] hover:bg-[#BE123C] hover:border-[#BE123C] active:bg-[#9F1239] active:border-[#9F1239] shadow-xs focus-visible:ring-2 focus-visible:ring-[#D91542] focus-visible:ring-offset-2',
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
      {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin mr-1.5" />}
      {children}
    </button>
  );
}

export default Button;

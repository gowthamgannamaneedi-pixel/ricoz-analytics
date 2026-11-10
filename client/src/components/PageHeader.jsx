import React from 'react';

/**
 * Universal Shared PageHeader — RicozAnalytics Enterprise Design System
 * 
 * Spec (Handoff Page 2, 3, 25):
 * - Page title: 28–32px (text-2xl sm:text-[28px] lg:text-[30px] font-bold)
 * - Description: 14–16px (text-sm sm:text-[15px] leading-relaxed)
 * - Action placement: aligned opposite or below description
 * - Breadcrumbs / eyebrow cleanly aligned
 * - 24px content insets and responsive section gaps
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = '',
}) {
  return (
    <section className={`rz-page-header ${className}`}>
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl sm:text-[28px] lg:text-[30px] font-bold tracking-tight text-slate-900 dark:text-slate-100 break-words leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-4xl text-xs sm:text-[15px] leading-relaxed text-slate-500 dark:text-slate-400 break-words">
            {description}
          </p>
        )}
        {children && <div className="mt-3">{children}</div>}
      </div>
      {actions && (
        <div className="flex w-full sm:w-auto flex-wrap items-center gap-2.5 sm:gap-3 self-start sm:self-center shrink-0">
          {actions}
        </div>
      )}
    </section>
  );
}

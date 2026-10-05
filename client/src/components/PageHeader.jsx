import React from 'react';

/**
 * Shared page heading for the application workspace. Keeping the title,
 * context and primary action in one place gives each analytics surface the
 * same visual hierarchy without imposing a data contract on the page.
 */
export default function PageHeader({ eyebrow, title, description, actions, children, className = '' }) {
  return (
    <section className={`rz-page-header ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{eyebrow}</p>}
        <h1 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </section>
  );
}

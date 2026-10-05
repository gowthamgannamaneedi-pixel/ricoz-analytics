import React from 'react';

/**
 * Reusable Ricoz brand logo component.
 * Uses the official logo image located at /ricoz-logo.png.
 * Optional label can be displayed alongside the logo.
 */
export default function Logo({ showLabel = true }) {
  return (
    <div className="flex items-center gap-2">
      <img
        src="/ricoz-logo.png"
        alt="RicoZ"
        className="h-7 w-auto max-w-[130px] object-contain shrink-0"
      />
      {showLabel && (
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
          Analytics
        </span>
      )}
    </div>
  );
}

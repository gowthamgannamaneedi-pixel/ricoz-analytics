import React from 'react';

/**
 * Interactive3DCard — Clean Material Card Container
 * Eliminates all 3D tilt, glare, and hover float for a clean, flat enterprise feel.
 */
export default function Interactive3DCard({
  children,
  className = '',
  maxTilt = 0,
  scale = 1,
  glare = false,
  elevation = true,
  overflowHidden = false,
  onClick,
  style = {},
  ...props
}) {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs transition-colors duration-150 ${overflowHidden ? 'overflow-hidden' : 'overflow-visible'} ${className}`}
      style={{
        ...style,
      }}
      {...props}
    >
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}

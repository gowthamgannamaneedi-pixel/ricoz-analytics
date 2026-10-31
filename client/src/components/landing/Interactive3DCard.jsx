import React from 'react';

/**
 * Interactive3DCard — Polished Enterprise Card Container
 * Eliminates unwanted mouse tilt, viewport edge clipping, and drifting.
 * Provides rock-solid card stability with subtle enterprise hover transitions.
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
      className={`relative transition-all duration-200 ease-out hover:shadow-lg ${overflowHidden ? 'overflow-hidden' : 'overflow-visible'} ${className}`}
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

import React from 'react';

/**
 * Standardized Role Badge Component
 * Consistent typography, padding, and role coloring across the platform.
 */
export default function RoleBadge({ role = 'viewer', size = 'sm', className = '' }) {
  const normRole = (role || 'viewer').toLowerCase();

  const colorStyles = {
    admin: 'bg-purple-50 text-purple-700 border-purple-200/90',
    manager: 'bg-indigo-50 text-indigo-700 border-indigo-200/90',
    analyst: 'bg-blue-50 text-blue-700 border-blue-200/90',
    lead: 'bg-amber-50 text-amber-700 border-amber-200/90',
    viewer: 'bg-slate-100 text-slate-600 border-slate-200/90'
  };

  const sizeStyles = {
    xs: 'text-[9px] px-1.5 py-0.5 tracking-wider',
    sm: 'text-[10px] px-2 py-0.5 tracking-wider',
    md: 'text-xs px-2.5 py-1 tracking-normal font-semibold'
  };

  const chosenColor = colorStyles[normRole] || colorStyles.viewer;
  const chosenSize = sizeStyles[size] || sizeStyles.sm;

  return (
    <span
      className={`inline-flex items-center justify-center font-mono font-bold uppercase rounded-md border shrink-0 select-none leading-none ${chosenColor} ${chosenSize} ${className}`}
    >
      {normRole.toUpperCase()}
    </span>
  );
}

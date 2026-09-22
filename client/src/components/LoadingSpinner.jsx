import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Reusable loading indicator
 * @param {{ size?: 'sm' | 'md' | 'lg', text?: string, className?: string }} props
 */
export default function LoadingSpinner({ size = 'md', text = 'Loading analytics...', className = '' }) {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10'
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 p-8 text-slate-500 ${className}`}>
      <Loader2 className={`${sizeMap[size] || sizeMap.md} animate-spin text-blue-600`} />
      {text && <span className="text-xs font-semibold tracking-wide text-slate-600">{text}</span>}
    </div>
  );
}

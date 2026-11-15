import React from 'react';

/**
 * Hero3DCanvas — Clean Material Ambient Backdrop
 * Replaces heavy 3D WebGL particle lattice with a clean, flat, modern ambient background
 * to deliver a native enterprise application feel with zero CPU/GPU overhead.
 */
export default function Hero3DCanvas() {
  return (
    <div 
      className="absolute inset-0 pointer-events-none overflow-hidden" 
      aria-hidden="true"
    >
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-rose-500/5 dark:bg-rose-500/10 rounded-full blur-3xl" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[250px] bg-slate-400/5 dark:bg-slate-700/10 rounded-full blur-3xl" />
    </div>
  );
}

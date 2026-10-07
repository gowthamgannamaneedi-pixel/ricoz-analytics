import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle({ className = '', variant = 'icon', size = 'md' }) {
  const { isDark, toggleTheme } = useTheme();

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl border transition cursor-pointer select-none text-xs font-semibold ${
          isDark
            ? 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-750 hover:border-slate-600'
            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
        } ${className}`}
        aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        id="theme-toggle-pill"
      >
        <div className="flex items-center gap-2">
          {isDark ? (
            <Sun className="h-4 w-4 text-amber-400 animate-in spin-in-90 duration-300" />
          ) : (
            <Moon className="h-4 w-4 text-indigo-500 animate-in spin-in-90 duration-300" />
          )}
          <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
        </div>
        <span
          className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${
            isDark ? 'bg-rose-600 justify-end' : 'bg-slate-300 justify-start'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
        </span>
      </button>
    );
  }

  const sizeClasses = {
    sm: 'h-8 w-8 p-1.5',
    md: 'h-10 w-10 p-2.5',
    lg: 'h-11 w-11 p-3',
  }[size] || 'h-10 w-10 p-2.5';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center rounded-xl border transition cursor-pointer select-none shadow-2xs ${sizeClasses} ${
        isDark
          ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700 hover:border-slate-600 hover:text-amber-300'
          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300'
      } ${className}`}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      id="theme-toggle-btn"
    >
      {isDark ? (
        <Sun className="h-4.5 w-4.5 animate-in spin-in-90 duration-300" />
      ) : (
        <Moon className="h-4.5 w-4.5 animate-in -spin-in-90 duration-300" />
      )}
    </button>
  );
}

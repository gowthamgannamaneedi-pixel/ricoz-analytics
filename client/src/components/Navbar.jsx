import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Menu,
  Search,
  Building2,
  ChevronDown,
  Clock,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Notification from './ui/Notification';
import Profile from './ui/Profile';
import ThemeToggle from './ui/ThemeToggle';

const routeTitleMap = {
  '/':               'Overview',
  '/dashboard':      'Overview',
  '/data-sources':   'Data Sources & Connectors',
  '/datasets':       'Dataset Explorer',
  '/data-model':     'Data Model',
  '/relationships':  'Data Model',
  '/data-quality':   'Data Quality',
  '/kpis':           'Key Performance Indicators',
  '/reports':        'Automated Reports',
  '/forecasts':      'Predictive Forecasting',
  '/alerts':         'Real-time Alerts Engine',
  '/ai-insights':    'Automated AI Insights',
  '/ai-assistant':   'AI Analytics Assistant',
  '/collaboration':  'Enterprise Collaboration',
  '/billing':        'Subscription & Licensing',
  '/settings':       'Workspace Settings',
  '/governance':     'Platform Governance',
};

/**
 * Enterprise Navbar Component — RicozAnalytics
 *
 * Popover Coordination:
 * - Only ONE header popover (Profile OR Notifications) can be open at a time.
 * - Clicking outside or pressing Escape closes the active popover.
 * - Unified across all workspace pages.
 */
export default function Navbar({ onOpenSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, subscription, isTrialExpired, trialDaysRemaining } = useAuth();

  const [activePopover, setActivePopover] = useState(null); // 'notifications' | 'profile' | null
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K or Cmd+K: Focus global search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      // Escape: Close any open popovers
      if (e.key === 'Escape') {
        setActivePopover(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleNotifications = useCallback(() => {
    setActivePopover((prev) => (prev === 'notifications' ? null : 'notifications'));
  }, []);

  const handleToggleProfile = useCallback(() => {
    setActivePopover((prev) => (prev === 'profile' ? null : 'profile'));
  }, []);

  const handleClosePopovers = useCallback(() => {
    setActivePopover(null);
  }, []);

  const isActivePaid = subscription?.status === 'active';

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 lg:px-8 shadow-2xs transition-colors duration-200">
      {/* Left: Mobile Navigation Drawer Toggle & Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 lg:hidden transition cursor-pointer"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Global Search Bar */}
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search metrics, reports, datasets, or ask AI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 pl-10 pr-16 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-600 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 focus:outline-hidden focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition shadow-2xs"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-750 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shadow-2xs pointer-events-none select-none">
            Ctrl + K
          </kbd>
        </div>
      </div>

      {/* Right Controls: Organization Selector, Trial Status, Theme Toggle, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Organization Selector */}
        <button
          type="button"
          onClick={() => {
            handleClosePopovers();
            navigate('/settings');
          }}
          className="hidden md:flex items-center gap-2 h-10 px-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 hover:border-slate-300 dark:hover:border-slate-600 transition shadow-2xs cursor-pointer select-none"
          aria-label="Current organization"
          title="Manage organization & workspace"
        >
          <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="max-w-36 truncate font-medium">
            {user?.organization_name || 'Ricoz Primary Organization'}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-400" />
        </button>

        {/* 14-Day Free Trial / Subscription Badge */}
        {isTrialExpired ? (
          <button
            type="button"
            onClick={() => navigate('/billing')}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-xs font-bold transition cursor-pointer shadow-2xs"
            title="Your trial has expired. Click to choose a plan"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            <span>Free Trial Expired</span>
          </button>
        ) : isActivePaid ? (
          <button
            type="button"
            onClick={() => navigate('/billing')}
            className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-bold transition cursor-pointer shadow-2xs"
            title="Subscription active"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="capitalize">{subscription?.plan || 'Pro'} Plan</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/billing')}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold transition cursor-pointer shadow-2xs ${
              trialDaysRemaining <= 3 
                ? 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100' 
                : 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
            }`}
            title="Click to view plans and subscription"
          >
            <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>{trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} remaining</span>
          </button>
        )}

        {/* Global Dark / Light Mode Switcher */}
        <ThemeToggle size="md" />

        {/* Coordinated Notification Bell Popover */}
        <Notification
          isOpen={activePopover === 'notifications'}
          onToggle={handleToggleNotifications}
          onClose={handleClosePopovers}
        />

        {/* Vertical divider */}
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-750 hidden sm:block" />

        {/* Coordinated User Profile Popover */}
        <Profile
          isOpen={activePopover === 'profile'}
          onToggle={handleToggleProfile}
          onClose={handleClosePopovers}
        />
      </div>
    </header>
  );
}

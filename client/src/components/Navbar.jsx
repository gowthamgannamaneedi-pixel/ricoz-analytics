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
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8 shadow-2xs">
      {/* Left: Mobile Navigation Drawer Toggle & Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden transition cursor-pointer"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Global Search Bar */}
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search metrics, reports, datasets, or ask AI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-16 text-xs sm:text-sm text-slate-800 placeholder-slate-400 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs pointer-events-none select-none">
            Ctrl + K
          </kbd>
        </div>
      </div>

      {/* Right Controls: Organization Selector, Trial Status, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Organization Selector */}
        <button
          type="button"
          onClick={() => {
            handleClosePopovers();
            navigate('/settings');
          }}
          className="hidden md:flex items-center gap-2 h-10 px-3.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs cursor-pointer select-none"
          aria-label="Current organization"
          title="Manage organization & workspace"
        >
          <Building2 className="h-4 w-4 text-blue-600" />
          <span className="max-w-36 truncate font-medium">
            {user?.organization_name || 'Ricoz Primary Organization'}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>

        {/* 14-Day Free Trial / Subscription Badge */}
        {isTrialExpired ? (
          <button
            type="button"
            onClick={() => navigate('/billing')}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold transition cursor-pointer shadow-2xs"
            title="Your trial has expired. Click to choose a plan"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            <span>Free Trial Expired</span>
          </button>
        ) : isActivePaid ? (
          <button
            type="button"
            onClick={() => navigate('/billing')}
            className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition cursor-pointer shadow-2xs"
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
                ? 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100' 
                : 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'
            }`}
            title="Click to view plans and subscription"
          >
            <Clock className="h-3.5 w-3.5 text-blue-600" />
            <span>{trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} remaining</span>
          </button>
        )}

        {/* Coordinated Notification Bell Popover */}
        <Notification
          isOpen={activePopover === 'notifications'}
          onToggle={handleToggleNotifications}
          onClose={handleClosePopovers}
        />

        {/* Vertical divider */}
        <div className="h-6 w-px bg-slate-200 hidden sm:block" />

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

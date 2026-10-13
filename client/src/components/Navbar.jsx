import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Menu,
  Search,
  Building2,
  ChevronDown,
  Clock,
  AlertTriangle,
  Sparkles,
  LayoutDashboard,
  Database,
  Target,
  FileText,
  Server,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Notification from './ui/Notification';
import Profile from './ui/Profile';
import ThemeToggle from './ui/ThemeToggle';
import Logo from './ui/Logo';

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
 * - Global debounced cross-entity search with keyboard navigation.
 */
export default function Navbar({ onOpenSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token, subscription, isTrialExpired, trialDaysRemaining } = useAuth();

  const [activePopover, setActivePopover] = useState(null); // 'notifications' | 'profile' | null
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchError, setSearchError] = useState(null);

  const searchRef = useRef(null);
  const searchContainerRef = useRef(null);
  const latestSearchId = useRef(0);

  // Close search on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search query
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchOpen(false);
      setSelectedIndex(-1);
      return;
    }

    setIsSearching(true);
    setSearchOpen(true);
    setSearchError(null);
    setSelectedIndex(-1);

    const searchId = ++latestSearchId.current;
    const timer = setTimeout(async () => {
      try {
        const authToken = token || localStorage.getItem('token');
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
          }
        });

        if (latestSearchId.current !== searchId) return; // Stale check

        if (!res.ok) {
          throw new Error(`Search failed (HTTP ${res.status})`);
        }

        const data = await res.json();
        if (latestSearchId.current === searchId) {
          setSearchResults(data.results || []);
        }
      } catch (err) {
        if (latestSearchId.current === searchId) {
          console.warn('[GlobalSearch] Error:', err.message);
          setSearchError('Search failed to load results.');
          setSearchResults([]);
        }
      } finally {
        if (latestSearchId.current === searchId) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, token]);

  // Handle keyboard navigation in search
  const handleSearchKeyDown = (e) => {
    if (!searchOpen) {
      if (e.key === 'ArrowDown' && searchResults.length > 0) {
        setSearchOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = selectedIndex >= 0 ? searchResults[selectedIndex] : searchResults[0];
      if (target) {
        handleSelectResult(target);
      }
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
      searchRef.current?.blur();
    }
  };

  const handleSelectResult = (item) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSelectedIndex(-1);
    if (item.url) {
      navigate(item.url);
    }
  };

  const getResultIcon = (type) => {
    switch (type) {
      case 'dashboard':
        return <LayoutDashboard className="h-4 w-4 text-rose-500" />;
      case 'dataset':
        return <Database className="h-4 w-4 text-blue-500" />;
      case 'kpi':
        return <Target className="h-4 w-4 text-emerald-500" />;
      case 'report':
        return <FileText className="h-4 w-4 text-purple-500" />;
      case 'data_source':
        return <Server className="h-4 w-4 text-amber-500" />;
      default:
        return <Sparkles className="h-4 w-4 text-rose-500" />;
    }
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K or Cmd+K: Focus global search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      // Escape: Close any open popovers
      if (e.key === 'Escape') {
        setActivePopover(null);
        setSearchOpen(false);
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
      {/* Left: Mobile Navigation Drawer Toggle, Mobile Brand Logo & Global Search */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 max-w-xl">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 lg:hidden transition cursor-pointer"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Mobile Brand Logo */}
        <Logo size="sm" linkTo="/dashboard" className="lg:hidden shrink-0" />

        {/* Global Search Bar */}
        <div ref={searchContainerRef} className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search metrics, reports, datasets, or ask AI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim().length > 0) setSearchOpen(true);
            }}
            onKeyDown={handleSearchKeyDown}
            className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 pl-10 pr-16 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/30 dark:hover:bg-rose-950/20 focus:border-rose-600 dark:focus:border-rose-500 focus:bg-white dark:focus:bg-slate-850 focus:outline-hidden focus:ring-2 focus:ring-rose-100 dark:focus:ring-rose-900/40 transition shadow-2xs"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-750 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shadow-2xs pointer-events-none select-none">
            Ctrl + K
          </kbd>

          {/* Search Suggestions Popover Dropdown */}
          {searchOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
              {isSearching ? (
                <div className="p-4 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
                  <span>Searching authorized enterprise entities...</span>
                </div>
              ) : searchError ? (
                <div className="p-4 text-center text-xs text-rose-600 dark:text-rose-400">
                  {searchError}
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-500 dark:text-slate-400">
                  No matching metrics, reports, or datasets found for <span className="font-semibold text-slate-700 dark:text-slate-300">"{searchQuery}"</span>.
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto py-2">
                  <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                    <span>Search Results ({searchResults.length})</span>
                    <span>Navigate with ↑ ↓ · Enter to open</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {searchResults.map((item, idx) => {
                      const isSelected = idx === selectedIndex;
                      return (
                        <div
                          key={`${item.type}-${item.id}`}
                          onClick={() => handleSelectResult(item)}
                          className={`flex items-center justify-between px-3.5 py-2.5 cursor-pointer transition ${
                            isSelected
                              ? 'bg-rose-50/80 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                              {getResultIcon(item.type)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate flex items-center gap-2">
                                <span>{item.title}</span>
                                <span className="text-[10px] font-normal px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                  {item.category}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                                {item.subtitle}
                              </div>
                            </div>
                          </div>
                          <ArrowRight className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-rose-600' : 'text-slate-300 dark:text-slate-600'}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
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
          className="hidden md:flex items-center gap-2 h-9 px-3.5 rounded-xl bg-rose-50/40 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100/70 hover:border-rose-300 dark:hover:bg-rose-950/60 transition shadow-2xs cursor-pointer select-none"
          aria-label="Current organization"
          title="Manage organization & workspace"
        >
          <Building2 className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
          <span className="max-w-36 truncate font-medium">
            {user?.organization_name || 'Ricoz Primary Organization'}
          </span>
          <ChevronDown className="h-3 w-3 text-rose-500/80 dark:text-rose-400" />
        </button>

        {/* Enterprise Plan Badge */}
        <button
          type="button"
          onClick={() => navigate('/billing')}
          className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 hover:bg-rose-50/90 hover:border-rose-300 hover:text-rose-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 text-xs font-semibold transition cursor-pointer shadow-2xs"
          title="Subscription active"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Enterprise Plan</span>
        </button>

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

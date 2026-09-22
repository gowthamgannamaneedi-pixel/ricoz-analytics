import React, { useState } from 'react';
import { Menu, Search, Bell, LogOut, ChevronRight, CheckCircle2, User, Sliders } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const routeTitleMap = {
  '/': 'Overview',
  '/dashboard': 'Overview',
  '/data-sources': 'Data Sources & Connectors',
  '/datasets': 'Dataset Explorer',
  '/kpis': 'Key Performance Indicators',
  '/reports': 'Automated Reports',
  '/forecasts': 'Predictive Forecasting',
  '/alerts': 'Real-time Alerts Engine',
  '/ai-insights': 'AI Analytics Assistant',
  '/settings': 'Platform Governance'
};

/**
 * Professional Light-First Navbar
 * @param {{ onOpenSidebar: () => void }} props
 */
export default function Navbar({ onOpenSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentTitle = routeTitleMap[location.pathname] || 'Analytics Overview';

  // Compute 2-letter initials
  const getInitials = (name) => {
    if (!name) return 'RA';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleLogout = () => {
    setShowProfileMenu(false);
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-15 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      {/* Left: Mobile Toggle & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Breadcrumb Hierarchy */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 hidden sm:inline font-medium">Workspace</span>
          <ChevronRight className="h-3 w-3 text-slate-300 hidden sm:inline" />
          <span className="text-slate-500 hidden sm:inline font-medium">Production</span>
          <ChevronRight className="h-3 w-3 text-slate-300 hidden sm:inline" />
          <span className="font-semibold text-slate-900">{currentTitle}</span>
        </nav>
      </div>

      {/* Right: Telemetry, Search, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Live Data Freshness Badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] text-emerald-700 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live Telemetry · 2m ago</span>
        </div>

        {/* Global Search Bar */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search metrics, reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-52 lg:w-64 rounded-lg border border-slate-200 bg-slate-50/80 py-1.5 pl-9 pr-12 text-xs text-slate-800 placeholder-slate-400 transition hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[9px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">
            Ctrl+K
          </kbd>
        </div>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
            aria-label="View notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-76 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg z-50 text-xs">
              <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100">
                <span className="font-semibold text-slate-900">System Notifications</span>
                <span className="text-[10px] text-blue-600 font-medium hover:underline cursor-pointer">Mark all read</span>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-slate-800 text-xs">Batch ETL Complete</p>
                    <p className="text-[11px] text-slate-500">45,200 transaction records synchronized.</p>
                    <span className="text-[10px] text-slate-400 font-mono mt-1 block">12 mins ago</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Vertical Divider */}
        <div className="h-5 w-px bg-slate-200 hidden sm:block" />

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 rounded-lg p-1 text-left transition hover:bg-slate-50"
            id="navbar-profile-btn"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 border border-blue-200 font-mono text-[11px] font-bold text-blue-700">
              {getInitials(user?.name)}
            </div>
            <div className="hidden sm:block">
              <span className="text-xs font-semibold text-slate-800 block leading-tight max-w-[110px] truncate">
                {user?.name || 'Enterprise User'}
              </span>
              <span className="text-[10px] font-medium text-slate-400 tracking-wider block leading-tight">
                {user?.role ? user.role.toUpperCase() : 'ADMIN'}
              </span>
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 text-xs">
              <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                <p className="font-semibold text-slate-900 truncate">{user?.name || 'Enterprise User'}</p>
                <p className="text-[11px] text-slate-500 truncate font-mono">{user?.email || 'user@company.com'}</p>
              </div>

              <button
                onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition text-xs font-medium"
              >
                Workspace Settings
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 transition text-xs font-medium mt-1 border-t border-slate-100"
                id="profile-logout-btn"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-500" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

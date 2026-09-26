import React, { useState, useEffect } from 'react';
import { Menu, Search, Bell, LogOut, ChevronRight, CheckCircle2, User, Sliders, CheckCheck, MessageSquare, Share2, Sparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNotificationsApi, markNotificationReadApi, markAllNotificationsReadApi } from '../services/api';

const routeTitleMap = {
  '/': 'Overview',
  '/dashboard': 'Overview',
  '/data-sources': 'Data Sources & Connectors',
  '/datasets': 'Dataset Explorer',
  '/kpis': 'Key Performance Indicators',
  '/reports': 'Automated Reports',
  '/forecasts': 'Predictive Forecasting',
  '/alerts': 'Real-time Alerts Engine',
  '/ai-insights': 'Automated AI Insights',
  '/ai-assistant': 'AI Analytics Assistant',
  '/collaboration': 'Enterprise Collaboration',
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
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const currentTitle = routeTitleMap[location.pathname] || 'Analytics Overview';

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const loadNotifications = async () => {
    try {
      const res = await getNotificationsApi(15);
      setNotifications(res.data?.notifications || []);
      setUnreadCount(res.data?.unreadCount || 0);
    } catch (_) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadApi();
      setUnreadCount(0);
      setNotifications(notifications.map(n => ({ ...n, read_at: new Date() })));
    } catch (_) {}
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.read_at) {
        await markNotificationReadApi(notif.id);
        setUnreadCount(Math.max(0, unreadCount - 1));
        setNotifications(notifications.map(n => n.id === notif.id ? { ...n, read_at: new Date() } : n));
      }
      setShowNotifications(false);
      if (notif.resource_type === 'dashboard') navigate('/dashboard');
      else if (notif.resource_type === 'report') navigate('/reports');
      else if (notif.resource_type === 'ai_insight') navigate('/ai-insights');
      else navigate('/collaboration');
    } catch (_) {}
  };

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
            onClick={() => { setShowNotifications(!showNotifications); loadNotifications(); }}
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
            aria-label="View notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 font-mono text-[9px] font-bold text-white ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-84 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl z-50 text-xs">
              <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100">
                <span className="font-bold text-slate-900">Notifications ({unreadCount})</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-[11px] text-blue-600 font-medium hover:underline cursor-pointer"
                  >
                    <CheckCheck className="h-3 w-3" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <Bell className="h-6 w-6 text-slate-200 mx-auto mb-1.5" />
                    <span>No notifications</span>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer transition ${
                        !notif.read_at
                          ? 'bg-blue-50/70 border border-blue-100 hover:bg-blue-100/50'
                          : 'bg-slate-50/50 border border-slate-100 hover:bg-slate-100/60'
                      }`}
                    >
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200/80 text-blue-600 shrink-0 mt-0.5 shadow-2xs">
                        {notif.type === 'mention' ? (
                          <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
                        ) : notif.type === 'share' ? (
                          <Share2 className="h-3.5 w-3.5 text-blue-600" />
                        ) : (
                          <Bell className="h-3.5 w-3.5 text-amber-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-semibold text-slate-900 text-xs truncate">{notif.title}</p>
                          <span className="text-[9px] text-slate-400 shrink-0">
                            {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">{notif.message}</p>
                      </div>
                    </div>
                  ))
                )}
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
              <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1 py-0.2 rounded inline-block leading-tight ${
                user?.role === 'admin'
                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                  : user?.role === 'manager'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : user?.role === 'analyst'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {user?.role ? user.role.toUpperCase() : 'VIEWER'}
              </span>
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 text-xs">
              <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                <p className="font-semibold text-slate-900 truncate">{user?.name || 'Enterprise User'}</p>
                <p className="text-[11px] text-slate-500 truncate font-mono">{user?.email || 'user@company.com'}</p>
                <p className="text-[10px] text-slate-400 truncate mt-1 flex items-center gap-1 font-medium">
                  <span>🏢</span> {user?.organization_name || 'Primary Organization'}
                </p>
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

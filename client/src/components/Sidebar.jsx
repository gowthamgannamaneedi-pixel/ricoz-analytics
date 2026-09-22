import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  Table2,
  Gauge,
  FileBarChart,
  TrendingUp,
  Bell,
  Sparkles,
  Settings,
  LogOut,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Data Sources', path: '/data-sources', icon: Database },
  { name: 'Datasets', path: '/datasets', icon: Table2 },
  { name: 'KPIs', path: '/kpis', icon: Gauge },
  { name: 'Reports', path: '/reports', icon: FileBarChart },
  { name: 'Forecasts', path: '/forecasts', icon: TrendingUp },
  { name: 'Alerts', path: '/alerts', icon: Bell },
  { name: 'AI Insights', path: '/ai-insights', icon: Sparkles, badge: 'AI' },
  { name: 'Settings', path: '/settings', icon: Settings },
];

/**
 * Enterprise Left Sidebar Navigation
 * @param {{ isOpen: boolean, onClose: () => void }} props
 */
export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const getInitials = (name) => {
    if (!name) return 'RA';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Shell */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2 min-w-0">
            <img 
              src="/ricoz-logo.png" 
              alt="RicoZ" 
              className="h-7 w-auto max-w-[130px] object-contain shrink-0" 
            />
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
              Analytics
            </span>
          </div>

          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `group relative flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.75 rounded-r bg-blue-600" />
                      )}
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                        strokeWidth={isActive ? 2.2 : 1.8}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.2 rounded font-mono ${
                          isActive
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-purple-50 text-purple-600 group-hover:bg-purple-100'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Profile at Bottom of Sidebar */}
        <div className="border-t border-slate-200 p-3 bg-slate-50/60">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white font-mono text-xs font-bold shrink-0 shadow-2xs">
                {getInitials(user?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 truncate leading-tight">
                  {user?.name || 'Admin User'}
                </p>
                <p className="text-[10px] text-slate-500 truncate leading-tight font-medium">
                  {user?.role ? user.role.toUpperCase() : 'ENTERPRISE'}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
              aria-label="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

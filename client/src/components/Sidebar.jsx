import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  Table2,
  Network,
  ShieldCheck,
  Gauge,
  FileBarChart,
  TrendingUp,
  Bell,
  Sparkles,
  Users2,
  Settings,
  CreditCard,
  Clock,
  AlertTriangle,
  LogOut,
  X,
  Bot,
  ChevronsLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import UserAvatar, { getCleanDisplayName } from './ui/UserAvatar';
import RoleBadge from './ui/RoleBadge';

const navigation = [
  { label: 'OVERVIEW', items: [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }
  ] },
  { label: 'DATA', items: [
    { name: 'Data Sources', path: '/data-sources', icon: Database },
    { name: 'Datasets', path: '/datasets', icon: Table2 },
    { name: 'Data Model', path: '/data-model', icon: Network },
    { name: 'Data Quality', path: '/data-quality', icon: ShieldCheck },
  ] },
  { label: 'ANALYZE', items: [
    { name: 'KPIs', path: '/kpis', icon: Gauge },
    { name: 'Reports', path: '/reports', icon: FileBarChart },
    { name: 'Forecasts', path: '/forecasts', icon: TrendingUp },
    { name: 'Alerts', path: '/alerts', icon: Bell },
  ] },
  { label: 'INTELLIGENCE', items: [
    { name: 'AI Insights', path: '/ai-insights', icon: Sparkles, badge: 'Beta' },
    { name: 'AI Assistant', path: '/ai-assistant', icon: Bot, badge: 'Copilot' },
  ] },
  { label: 'COLLABORATE', items: [
    { name: 'Collaboration', path: '/collaboration', icon: Users2 },
  ] },
  { label: 'ADMINISTRATION', items: [
    { name: 'Billing & Plans', path: '/billing', icon: CreditCard },
    { name: 'Settings', path: '/settings', icon: Settings },
    { name: 'Governance', path: '/governance', icon: ShieldCheck },
  ] },
];

/**
 * Enterprise Left Sidebar Navigation
 * @param {{ isOpen: boolean, onClose: () => void }} props
 */
export default function Sidebar({ isOpen, onClose }) {
  const { user, logout, subscription, isTrialExpired, trialDaysRemaining } = useAuth();
  const navigate = useNavigate();

  const displayName = getCleanDisplayName(user);
  const orgName = user?.organization_name || 'Ricoz Primary Org';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Shell */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-66 flex-col border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 transition-transform duration-200 ease-in-out lg:translate-x-0 select-none shadow-xs ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between px-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-1.5 min-w-0">
            <img 
              src="/ricoz-logo.png" 
              alt="ricoz" 
              className="h-7 w-auto max-w-[110px] object-contain shrink-0" 
            />
            <span className="text-[10px] font-medium tracking-tight text-slate-400">
              Analytics
            </span>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
            aria-label="Collapse navigation"
            title="Collapse Sidebar"
          >
            <ChevronsLeft className="h-4 w-4 hidden lg:block" />
            <X className="h-5 w-5 lg:hidden" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4" aria-label="Primary navigation">
          {navigation.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `group relative flex items-center justify-between rounded-xl px-3 py-2 text-xs sm:text-[13px] font-medium transition-all ${
                          isActive
                            ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-bold shadow-2xs'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                                isActive ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                              }`}
                              strokeWidth={isActive ? 2.2 : 1.8}
                            />
                            <span className="truncate">{item.name}</span>
                          </div>

                          {item.badge && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                                isActive
                                  ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100/60 dark:border-rose-900/40'
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
              </div>
            </div>
          ))}
        </nav>

        {/* 14-Day Free Trial / License Upgrade Status Widget */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {isTrialExpired ? (
            <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/80 bg-rose-50/80 dark:bg-rose-950/40 shadow-2xs space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="text-xs font-bold text-rose-900 dark:text-rose-200">Trial Expired</span>
              </div>
              <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-snug">
                Data safely preserved. Choose a plan to restore workspace analytics.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  navigate('/billing');
                }}
                className="w-full py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer text-center"
              >
                Choose Plan &rarr;
              </button>
            </div>
          ) : subscription?.status === 'active' ? (
            <div className="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/40 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-emerald-900 dark:text-emerald-200 capitalize">{subscription?.plan || 'Enterprise'} Plan</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  navigate('/billing');
                }}
                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 cursor-pointer"
              >
                Manage
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-rose-100 dark:border-slate-750 bg-gradient-to-br from-rose-50/80 to-pink-50/60 dark:from-slate-800/90 dark:to-slate-850/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-950 dark:text-slate-100">
                  <Clock className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                  <span>14-Day Free Trial</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded bg-rose-100/70 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800">
                  {trialDaysRemaining}d left
                </span>
              </div>
              <div className="w-full bg-rose-200/60 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-rose-600 dark:bg-rose-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.max(5, Math.min(100, ((14 - trialDaysRemaining) / 14) * 100))}%` }}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  navigate('/billing');
                }}
                className="w-full py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer text-center"
              >
                Upgrade to Pro &rarr;
              </button>
            </div>
          )}
        </div>

        {/* User Account / Workspace Footer Area */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-3 bg-slate-50/70 dark:bg-slate-850/80">
          <div className="flex items-center justify-between gap-2.5">
            {/* Clickable user profile identity strip */}
            <button
              type="button"
              onClick={() => {
                onClose?.();
                navigate('/settings');
              }}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left p-1 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800 transition cursor-pointer select-none"
              title="View account & workspace settings"
            >
              {/* Universal Shared Avatar Component */}
              <UserAvatar user={user} size="md" showStatus={true} status="online" />

              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {displayName}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <RoleBadge role={user?.role} size="xs" />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[85px]" title={orgName}>
                    {orgName}
                  </span>
                </div>
              </div>
            </button>

            {/* Quick Sign Out Action */}
            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer shrink-0"
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

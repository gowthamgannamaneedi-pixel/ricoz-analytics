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
  { label: 'Overview', items: [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }
  ] },
  { label: 'Data', items: [
    { name: 'Data Sources', path: '/data-sources', icon: Database },
    { name: 'Datasets', path: '/datasets', icon: Table2 },
    { name: 'Data Model', path: '/data-model', icon: Network },
    { name: 'Data Quality', path: '/data-quality', icon: ShieldCheck },
  ] },
  { label: 'Analyze', items: [
    { name: 'KPIs', path: '/kpis', icon: Gauge },
    { name: 'Reports', path: '/reports', icon: FileBarChart },
    { name: 'Forecasts', path: '/forecasts', icon: TrendingUp },
    { name: 'Alerts', path: '/alerts', icon: Bell },
  ] },
  { label: 'Intelligence', items: [
    { name: 'AI Insights', path: '/ai-insights', icon: Sparkles, badge: 'Beta' },
    { name: 'AI Assistant', path: '/ai-assistant', icon: Bot, badge: 'Copilot' },
  ] },
  { label: 'Collaborate', items: [
    { name: 'Collaboration', path: '/collaboration', icon: Users2 },
  ] },
  { label: 'Administration', items: [
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
  const orgName = user?.organization_name || 'Ricoz Primary Organization';

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
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-66 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:translate-x-0 select-none shadow-xs ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between px-5 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2 min-w-0">
            <img 
              src="/ricoz-logo.png" 
              alt="RicozAnalytics" 
              className="h-7 w-auto max-w-[125px] object-contain shrink-0" 
            />
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 shrink-0 font-mono">
              Enterprise
            </span>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
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
              <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
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
                        `group relative flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-blue-50/80 text-blue-700 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className="flex items-center gap-3 min-w-0">
                            {isActive && (
                              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-md bg-blue-600" />
                            )}
                            <Icon
                              className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                                isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                              }`}
                              strokeWidth={isActive ? 2.2 : 1.8}
                            />
                            <span className="truncate">{item.name}</span>
                          </div>

                          {item.badge && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                                isActive
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-slate-100 text-slate-600 group-hover:bg-purple-50 group-hover:text-purple-600'
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
        <div className="p-3 border-t border-slate-200 bg-white">
          {isTrialExpired ? (
            <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/80 shadow-2xs space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span className="text-xs font-bold text-rose-900">Trial Expired</span>
              </div>
              <p className="text-[11px] text-rose-700 leading-snug">
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
            <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-emerald-900 capitalize">{subscription?.plan || 'Enterprise'} Plan</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  navigate('/billing');
                }}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
              >
                Manage
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950">
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                  <span>14-Day Free Trial</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-blue-700 px-1.5 py-0.5 rounded bg-blue-100/70 border border-blue-200">
                  {trialDaysRemaining}d left
                </span>
              </div>
              <div className="w-full bg-blue-200/60 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all"
                  style={{ width: `${Math.max(5, Math.min(100, ((14 - trialDaysRemaining) / 14) * 100))}%` }}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  navigate('/billing');
                }}
                className="w-full py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer text-center"
              >
                Upgrade to Pro &rarr;
              </button>
            </div>
          )}
        </div>

        {/* User Account / Workspace Footer Area */}
        <div className="border-t border-slate-200 p-3 bg-slate-50/70">
          <div className="flex items-center justify-between gap-2.5">
            {/* Clickable user profile identity strip */}
            <button
              type="button"
              onClick={() => {
                onClose?.();
                navigate('/settings');
              }}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left p-1 rounded-xl hover:bg-slate-200/50 transition cursor-pointer select-none"
              title="View account & workspace settings"
            >
              {/* Universal Shared Avatar Component */}
              <UserAvatar user={user} size="md" showStatus={true} status="online" />

              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {displayName}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <RoleBadge role={user?.role} size="xs" />
                  <span className="text-[11px] text-slate-500 truncate max-w-[85px]" title={orgName}>
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
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
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

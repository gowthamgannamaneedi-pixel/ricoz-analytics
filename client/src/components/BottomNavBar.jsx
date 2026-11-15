import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Table2,
  FileBarChart,
  Bot,
  Settings,
  Menu
} from 'lucide-react';

/**
 * BottomNavBar — Native Android Material 3 Navigation Bar
 * Designed specifically for phone touch screens:
 * - 48px+ touch targets
 * - Pinned to bottom with safe-area-inset-bottom support
 * - Clean active pill indicator in brand crimson (#E11D48 / #D91542)
 * - Thumb-reachable primary destinations + "More" drawer opener
 */
export default function BottomNavBar({ onOpenMore }) {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      isActive: currentPath === '/dashboard' || currentPath === '/'
    },
    {
      name: 'Datasets',
      path: '/datasets',
      icon: Table2,
      isActive: currentPath.startsWith('/datasets')
    },
    {
      name: 'Reports',
      path: '/reports',
      icon: FileBarChart,
      isActive: currentPath.startsWith('/reports')
    },
    {
      name: 'AI Assist',
      path: '/ai-assistant',
      icon: Bot,
      isActive: currentPath.startsWith('/ai-assistant') || currentPath.startsWith('/assistant')
    },
    {
      name: 'Settings',
      path: '/settings',
      icon: Settings,
      isActive: currentPath.startsWith('/settings')
    }
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 transition-colors select-none"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.35rem)' }}
    >
      <div className="flex items-center justify-around px-1 py-1 h-14 sm:h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={`flex-1 flex flex-col items-center justify-center min-w-[56px] py-1 px-1 rounded-xl transition-all duration-150 active:scale-95 ${
                active
                  ? 'text-rose-600 dark:text-rose-400 font-bold'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <div
                className={`flex items-center justify-center h-7 w-12 rounded-full transition-colors ${
                  active
                    ? 'bg-rose-100/80 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400'
                    : 'bg-transparent text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.3 : 1.8} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 leading-none">
                {item.name}
              </span>
            </NavLink>
          );
        })}

        {/* More Drawer Action */}
        {onOpenMore && (
          <button
            type="button"
            onClick={onOpenMore}
            aria-label="Open more navigation menus"
            className="flex-1 flex flex-col items-center justify-center min-w-[56px] py-1 px-1 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium transition-all duration-150 active:scale-95"
          >
            <div className="flex items-center justify-center h-7 w-12 rounded-full bg-transparent text-slate-500 dark:text-slate-400">
              <Menu className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 leading-none">
              More
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}

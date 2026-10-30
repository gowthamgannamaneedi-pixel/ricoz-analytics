import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

/**
 * Enterprise Dashboard Layout Shell
 */
export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('ricoz_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Desktop collapse state toggle (persists to localStorage)
  const handleToggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('ricoz_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Mobile drawer controls (never alters desktop isCollapsed)
  const handleOpenMobileSidebar = () => {
    setSidebarOpen(true);
  };

  const handleCloseMobileSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col font-sans transition-colors duration-200">
      {/* Sidebar Navigation */}
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        onCloseMobile={handleCloseMobileSidebar}
        onClose={handleCloseMobileSidebar}
      />

      {/* Main Workspace Frame */}
      <div className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-200 ease-in-out ${
        isCollapsed ? 'lg:pl-0' : 'lg:pl-64'
      }`}>
        {/* Top Navbar */}
        <Navbar
          isSidebarCollapsed={isCollapsed}
          onToggleSidebar={handleToggleCollapse}
          onOpenSidebar={handleOpenMobileSidebar}
        />

        {/* Dynamic Route Container */}
        <main className="flex-1 p-4 sm:p-6 lg:px-8 lg:py-7 space-y-6 max-w-[1536px] w-full mx-auto">
          <Outlet />
        </main>

        {/* Minimal Enterprise Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 transition-colors">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#D91542]" />
              RicozAnalytics
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span>Enterprise Intelligence Suite</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400 dark:text-slate-500">
            <span>Workspace region: Mumbai</span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              API Gateway: Operational
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

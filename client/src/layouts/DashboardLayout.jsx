import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

/**
 * Enterprise Dashboard Layout Shell
 */
export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Navbar */}
        <Navbar onOpenSidebar={() => setSidebarOpen(true)} />

        {/* Dynamic Route Container */}
        <main className="flex-1 p-4 sm:p-6 lg:px-8 lg:py-7 space-y-6 max-w-[1536px] w-full mx-auto">
          <Outlet />
        </main>

        {/* Minimal Enterprise Footer */}
        <footer className="border-t border-slate-200 bg-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">RicozAnalytics</span>
            <span className="text-slate-300">|</span>
            <span>Enterprise Intelligence Suite</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Workspace region: Mumbai</span>
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              API Gateway: Operational
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

import React from 'react';
import { MapPin, Layers, Calendar, ChevronDown } from 'lucide-react';
import { filterOptions } from '../utils/sampleData';
import { RefreshButton, ResetButton } from './ui';

/**
 * Standardized Filter Controls Bar — RicozAnalytics Enterprise Design System
 * 
 * Spec (Handoff Page 4, 27):
 * - Control height: 40px (h-10) matching Refresh and action buttons
 * - Control radius: 8px (rounded-lg)
 * - Control padding: 16px (px-4)
 * - Font: 14px font-medium (text-sm)
 * - Dedicated chevron vertically centered with 16px inset
 * - White surface, subtle border, soft red hover
 * - Standard highlighted Reset button
 */
export default function FilterBar({
  filters,
  onFilterChange,
  onRefresh,
  onReset,
  isRefreshing = false
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3.5 border-y border-slate-200 dark:border-slate-800 py-3.5">
      {/* Left: Segmented Time Window + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date Range Dropdown */}
        <div className="relative inline-flex items-center">
          <div className="flex items-center gap-2 h-10 rounded-lg bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 pl-3.5 pr-9 text-sm font-medium text-slate-800 dark:text-slate-100 hover:border-rose-300 hover:bg-[#FFF1F3]/40 transition shadow-2xs">
            <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-400 shrink-0" />
            <select
              id="filter-date"
              value={filters.dateRange || 'all'}
              onChange={(e) => onFilterChange('dateRange', e.target.value)}
              aria-label="Filter by Date Range"
              className="bg-transparent text-sm text-slate-800 dark:text-slate-100 font-medium outline-hidden cursor-pointer dark:bg-slate-850"
            >
              {filterOptions.dateRanges.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>

        {/* Region Dropdown */}
        <div className="relative inline-flex items-center">
          <div className="flex items-center gap-2 h-10 rounded-lg bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 pl-3.5 pr-9 text-sm font-medium text-slate-800 dark:text-slate-100 hover:border-rose-300 hover:bg-[#FFF1F3]/40 transition shadow-2xs">
            <MapPin className="h-4 w-4 text-slate-400 dark:text-slate-400 shrink-0" />
            <select
              id="filter-region"
              value={filters.region}
              onChange={(e) => onFilterChange('region', e.target.value)}
              aria-label="Filter by Region"
              className="bg-transparent text-sm text-slate-800 dark:text-slate-100 font-medium outline-hidden cursor-pointer dark:bg-slate-850"
            >
              {filterOptions.regions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>

        {/* Channel Dropdown */}
        <div className="relative inline-flex items-center">
          <div className="flex items-center gap-2 h-10 rounded-lg bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 pl-3.5 pr-9 text-sm font-medium text-slate-800 dark:text-slate-100 hover:border-rose-300 hover:bg-[#FFF1F3]/40 transition shadow-2xs">
            <Layers className="h-4 w-4 text-slate-400 dark:text-slate-400 shrink-0" />
            <select
              id="filter-category"
              value={filters.category}
              onChange={(e) => onFilterChange('category', e.target.value)}
              aria-label="Filter by Channel"
              className="bg-transparent text-sm text-slate-800 dark:text-slate-100 font-medium outline-hidden cursor-pointer dark:bg-slate-850"
            >
              {filterOptions.categories.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>

        {/* Highlighted Reset Button */}
        {onReset && (
          <ResetButton
            onClick={onReset}
            size="md"
            title="Reset filters to default"
          />
        )}
      </div>

      {/* Right: Sync Refresh Action */}
      <div className="flex items-center gap-3">
        <RefreshButton
          onClick={onRefresh}
          loading={isRefreshing}
          label={isRefreshing ? 'Synchronizing...' : 'Refresh'}
        />
      </div>
    </div>
  );
}

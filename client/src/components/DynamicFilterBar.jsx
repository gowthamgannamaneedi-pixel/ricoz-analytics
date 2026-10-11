import React from 'react';
import { MapPin, Layers, Calendar, ShoppingBag, ChevronDown } from 'lucide-react';
import { ResetButton } from './ui';

/**
 * Enterprise Dynamic Filter Bar — RicozAnalytics Design System
 * 
 * Spec (Handoff Page 4, 5, 27):
 * - Control height: 40px (h-10) matching adjacent controls
 * - Control radius: 8px (rounded-lg)
 * - Typography: 14px font-medium (text-sm)
 * - Dedicated chevrons with 16px right inset
 * - Standard highlighted Reset button
 */
export default function DynamicFilterBar({
  filters = {},
  filterOptions = {},
  dimensions = {},
  onFilterChange,
  onResetFilters,
}) {
  const regionCol = dimensions.regionColumn;
  const categoryCol = dimensions.categoryColumn;
  const channelCol = dimensions.channelColumn;
  const productCol = dimensions.productColumn;

  const regions = filterOptions.regions || [];
  const categories = filterOptions.categories || [];
  const channels = filterOptions.channels || [];
  const products = filterOptions.products || [];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3.5 font-sans border-y border-slate-200 dark:border-slate-800 py-3.5">
      {/* Dynamic Filter Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date Range Dropdown Filter */}
        <div className="relative inline-flex items-center">
          <div className="flex items-center gap-2 h-10 rounded-lg bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 pl-3.5 pr-9 text-sm font-medium text-slate-800 dark:text-slate-100 hover:border-rose-300 hover:bg-[#FFF1F3]/40 transition shadow-2xs">
            <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-400 shrink-0" />
            <select
              id="dynamic-filter-date"
              value={filters.dateRange || 'all'}
              onChange={(e) => onFilterChange('dateRange', e.target.value)}
              aria-label="Filter by Date Range"
              className="bg-transparent text-sm text-slate-800 dark:text-slate-100 font-semibold outline-hidden cursor-pointer dark:bg-slate-850"
            >
              <option value="all">All Time</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="ytd">Year to Date</option>
            </select>
          </div>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>

        {/* Region Filter Dropdown */}
        <div className="relative inline-flex items-center">
          <div className="flex items-center gap-2 h-10 rounded-lg bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 pl-3.5 pr-9 text-sm font-medium text-slate-800 dark:text-slate-100 hover:border-rose-300 hover:bg-[#FFF1F3]/40 transition shadow-2xs">
            <MapPin className="h-4 w-4 text-slate-400 dark:text-slate-400 shrink-0" />
            <select
              id="dynamic-filter-region"
              value={filters[regionCol || 'region'] || 'all'}
              onChange={(e) => onFilterChange(regionCol || 'region', e.target.value)}
              aria-label="Filter by Region"
              className="bg-transparent text-sm text-slate-800 dark:text-slate-100 font-semibold outline-hidden cursor-pointer dark:bg-slate-850"
            >
              <option value="all">All Regions{regions.length > 0 ? ` (${regions.length})` : ''}</option>
              {regions.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>

        {/* Channel Filter Dropdown */}
        <div className="relative inline-flex items-center">
          <div className="flex items-center gap-2 h-10 rounded-lg bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 pl-3.5 pr-9 text-sm font-medium text-slate-800 dark:text-slate-100 hover:border-rose-300 hover:bg-[#FFF1F3]/40 transition shadow-2xs">
            <Layers className="h-4 w-4 text-slate-400 dark:text-slate-400 shrink-0" />
            <select
              id="dynamic-filter-channel"
              value={filters[channelCol || 'channel'] || 'all'}
              onChange={(e) => onFilterChange(channelCol || 'channel', e.target.value)}
              aria-label="Filter by Channel"
              className="bg-transparent text-sm text-slate-800 dark:text-slate-100 font-semibold outline-hidden cursor-pointer dark:bg-slate-850"
            >
              <option value="all">All Channels{channels.length > 0 ? ` (${channels.length})` : ''}</option>
              {channels.map((chan) => (
                <option key={chan} value={chan}>
                  {chan}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>

        {/* Category Filter Dropdown */}
        <div className="relative inline-flex items-center">
          <div className="flex items-center gap-2 h-10 rounded-lg bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 pl-3.5 pr-9 text-sm font-medium text-slate-800 dark:text-slate-100 hover:border-rose-300 hover:bg-[#FFF1F3]/40 transition shadow-2xs">
            <ShoppingBag className="h-4 w-4 text-slate-400 dark:text-slate-400 shrink-0" />
            <select
              id="dynamic-filter-category"
              value={filters[categoryCol || 'category'] || 'all'}
              onChange={(e) => onFilterChange(categoryCol || 'category', e.target.value)}
              aria-label="Filter by Category"
              className="bg-transparent text-sm text-slate-800 dark:text-slate-100 font-semibold outline-hidden cursor-pointer dark:bg-slate-850"
            >
              <option value="all">All Categories{categories.length > 0 ? ` (${categories.length})` : ''}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>
      </div>

      {/* Universal Highlighted Reset Button */}
      {onResetFilters && (
        <ResetButton
          onClick={onResetFilters}
          size="md"
          title="Reset filters to default"
        />
      )}
    </div>
  );
}

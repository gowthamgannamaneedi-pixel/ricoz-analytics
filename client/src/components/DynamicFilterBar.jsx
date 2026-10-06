import React from 'react';
import { MapPin, Layers, Calendar, Filter, X, ShoppingBag, RotateCcw } from 'lucide-react';

/**
 * Enterprise Dynamic Filter Bar — RicozAnalytics
 * Renders filter controls based on detected dataset dimensions with proper scale & typography.
 */
export default function DynamicFilterBar({
  filters = {},
  filterOptions = {},
  dimensions = {},
  onFilterChange,
  onResetFilters,
}) {
  const dateRanges = [
    { label: '7D', value: '7d', tooltip: 'Last 7 Days' },
    { label: '30D', value: '30d', tooltip: 'Last 30 Days' },
    { label: '90D', value: '90d', tooltip: 'Last 90 Days' },
    { label: 'YTD', value: 'ytd', tooltip: 'Year to Date' },
    { label: 'All Time', value: 'all', tooltip: 'Complete History' },
  ];

  const hasActiveFilters = Boolean(
    (filters.dateRange && filters.dateRange !== 'all') ||
      (filters.region && filters.region !== 'all') ||
      (filters.category && filters.category !== 'all') ||
      (filters.channel && filters.channel !== 'all') ||
      (filters.product && filters.product !== 'all')
  );

  const regionCol = dimensions.regionColumn;
  const categoryCol = dimensions.categoryColumn;
  const channelCol = dimensions.channelColumn;
  const productCol = dimensions.productColumn;

  const regions = filterOptions.regions || [];
  const categories = filterOptions.categories || [];
  const channels = filterOptions.channels || [];
  const products = filterOptions.products || [];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3.5 font-sans">
      {/* Dynamic Filter Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Clean Date Range Dropdown Filter */}
        <div className="flex items-center gap-2 h-10 rounded-xl bg-white border border-slate-200/90 px-3.5 text-sm font-medium text-slate-700 hover:border-slate-300 transition shadow-2xs">
          <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            id="dynamic-filter-date"
            value={filters.dateRange || 'all'}
            onChange={(e) => onFilterChange('dateRange', e.target.value)}
            aria-label="Filter by Date Range"
            className="bg-transparent text-sm text-slate-800 font-semibold outline-none cursor-pointer pr-1"
          >
            <option value="all">All Time</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="ytd">Year to Date</option>
          </select>
        </div>

        {/* Region Filter Dropdown */}
        <div className="flex items-center gap-2 h-10 rounded-xl bg-white border border-slate-200/90 px-3.5 text-sm font-medium text-slate-700 hover:border-slate-300 transition shadow-2xs">
          <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            id="dynamic-filter-region"
            value={filters[regionCol || 'region'] || 'all'}
            onChange={(e) => onFilterChange(regionCol || 'region', e.target.value)}
            aria-label="Filter by Region"
            className="bg-transparent text-sm text-slate-800 font-semibold outline-none cursor-pointer pr-1"
          >
            <option value="all">All Regions{regions.length > 0 ? ` (${regions.length})` : ''}</option>
            {regions.map((reg) => (
              <option key={reg} value={reg}>
                {reg}
              </option>
            ))}
          </select>
        </div>

        {/* Channel Filter Dropdown */}
        <div className="flex items-center gap-2 h-10 rounded-xl bg-white border border-slate-200/90 px-3.5 text-sm font-medium text-slate-700 hover:border-slate-300 transition shadow-2xs">
          <Layers className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            id="dynamic-filter-channel"
            value={filters[channelCol || 'channel'] || 'all'}
            onChange={(e) => onFilterChange(channelCol || 'channel', e.target.value)}
            aria-label="Filter by Channel"
            className="bg-transparent text-sm text-slate-800 font-semibold outline-none cursor-pointer pr-1"
          >
            <option value="all">All Channels{channels.length > 0 ? ` (${channels.length})` : ''}</option>
            {channels.map((chan) => (
              <option key={chan} value={chan}>
                {chan}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter Dropdown */}
        <div className="flex items-center gap-2 h-10 rounded-xl bg-white border border-slate-200/90 px-3.5 text-sm font-medium text-slate-700 hover:border-slate-300 transition shadow-2xs">
          <ShoppingBag className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            id="dynamic-filter-category"
            value={filters[categoryCol || 'category'] || 'all'}
            onChange={(e) => onFilterChange(categoryCol || 'category', e.target.value)}
            aria-label="Filter by Category"
            className="bg-transparent text-sm text-slate-800 font-semibold outline-none cursor-pointer pr-1"
          >
            <option value="all">All Categories{categories.length > 0 ? ` (${categories.length})` : ''}</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reset Filters Action on right */}
      <button
        type="button"
        onClick={onResetFilters}
        className="flex items-center gap-2 h-10 px-3.5 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
      >
        <RotateCcw className="h-4 w-4" />
        <span>Reset Filters</span>
      </button>
    </div>
  );
}

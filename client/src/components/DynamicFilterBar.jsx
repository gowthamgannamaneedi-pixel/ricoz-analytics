import React from 'react';
import { RefreshCw, MapPin, Layers, Calendar, Filter, X, ShoppingBag } from 'lucide-react';

/**
 * Enterprise Dynamic Filter Bar
 * Renders filter controls based on detected dataset dimensions
 * @param {{
 *   filters: object,
 *   filterOptions: { regions?: string[], categories?: string[], products?: string[], channels?: string[], dateBounds?: object },
 *   dimensions: object,
 *   onFilterChange: (key: string, value: string) => void,
 *   onResetFilters: () => void,
 *   onRefresh: () => void,
 *   isRefreshing?: boolean
 * }} props
 */
export default function DynamicFilterBar({
  filters = {},
  filterOptions = {},
  dimensions = {},
  onFilterChange,
  onResetFilters,
  onRefresh,
  isRefreshing = false
}) {
  const dateRanges = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' },
    { label: 'Year to Date', value: 'ytd' },
    { label: 'All Time', value: 'all' }
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-200 py-3 bg-white font-sans">
      {/* Left: Dynamic Filter Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Date Range Selector (only if dataset has dates) */}
        {dimensions.dateColumn && (
          <div className="flex items-center rounded-md bg-slate-100 p-0.5 border border-slate-200">
            {dateRanges.map((opt) => {
              const isActive = (filters.dateRange || 'all') === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onFilterChange('dateRange', opt.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                    isActive
                      ? 'bg-white text-blue-700 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Region Filter */}
        {regionCol && regions.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:border-slate-300 transition">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            <select
              id="dynamic-filter-region"
              value={filters[regionCol] || 'all'}
              onChange={(e) => onFilterChange(regionCol, e.target.value)}
              aria-label="Filter by Region"
              className="bg-transparent text-xs text-slate-800 font-medium outline-none cursor-pointer pr-1"
            >
              <option value="all">All Regions ({regions.length})</option>
              {regions.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Channel Filter */}
        {channelCol && channels.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:border-slate-300 transition">
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            <select
              id="dynamic-filter-channel"
              value={filters[channelCol] || 'all'}
              onChange={(e) => onFilterChange(channelCol, e.target.value)}
              aria-label="Filter by Channel"
              className="bg-transparent text-xs text-slate-800 font-medium outline-none cursor-pointer pr-1"
            >
              <option value="all">All Channels ({channels.length})</option>
              {channels.map((chan) => (
                <option key={chan} value={chan}>
                  {chan}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Category Filter */}
        {categoryCol && categories.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:border-slate-300 transition">
            <ShoppingBag className="h-3.5 w-3.5 text-slate-400" />
            <select
              id="dynamic-filter-category"
              value={filters[categoryCol] || 'all'}
              onChange={(e) => onFilterChange(categoryCol, e.target.value)}
              aria-label="Filter by Category"
              className="bg-transparent text-xs text-slate-800 font-medium outline-none cursor-pointer pr-1"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reset Filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
          >
            <X className="h-3.5 w-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Right: Refresh Button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          id="dashboard-refresh-btn"
          className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          <span>{isRefreshing ? 'Recalculating...' : 'Refresh'}</span>
        </button>
      </div>
    </div>
  );
}

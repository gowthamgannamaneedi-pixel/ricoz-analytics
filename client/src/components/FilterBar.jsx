import React from 'react';
import { RefreshCw, MapPin, Layers, Calendar, ChevronDown } from 'lucide-react';
import { filterOptions } from '../utils/sampleData';

/**
 * Professional Light-First Filter Controls Bar
 * @param {{
 *   filters: { dateRange: string, region: string, category: string },
 *   onFilterChange: (key: string, value: string) => void,
 *   onRefresh: () => void,
 *   isRefreshing?: boolean
 * }} props
 */
export default function FilterBar({
  filters,
  onFilterChange,
  onRefresh,
  isRefreshing = false
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-200 py-3">
      {/* Left: Segmented Time Window + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Clean Date Range Dropdown */}
        <div className="flex items-center gap-2 rounded-md bg-white border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:border-slate-300 transition shadow-2xs">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <select
            id="filter-date"
            value={filters.dateRange || 'all'}
            onChange={(e) => onFilterChange('dateRange', e.target.value)}
            aria-label="Filter by Date Range"
            className="bg-transparent text-xs text-slate-800 font-medium outline-none cursor-pointer pr-1"
          >
            {filterOptions.dateRanges.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-white text-slate-800">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Region Dropdown */}
        <div className="flex items-center gap-2 rounded-md bg-white border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:border-slate-300 transition">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          <select
            id="filter-region"
            value={filters.region}
            onChange={(e) => onFilterChange('region', e.target.value)}
            aria-label="Filter by Region"
            className="bg-transparent text-xs text-slate-800 font-medium outline-none cursor-pointer pr-1"
          >
            {filterOptions.regions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-white text-slate-800">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Channel Dropdown */}
        <div className="flex items-center gap-2 rounded-md bg-white border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:border-slate-300 transition">
          <Layers className="h-3.5 w-3.5 text-slate-400" />
          <select
            id="filter-category"
            value={filters.category}
            onChange={(e) => onFilterChange('category', e.target.value)}
            aria-label="Filter by Channel"
            className="bg-transparent text-xs text-slate-800 font-medium outline-none cursor-pointer pr-1"
          >
            {filterOptions.categories.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-white text-slate-800">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Sync Refresh Action */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          id="filter-refresh-btn"
          className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          <span>{isRefreshing ? 'Synchronizing...' : 'Refresh'}</span>
        </button>
      </div>
    </div>
  );
}

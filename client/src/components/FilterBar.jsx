import React from 'react';
import { MapPin, Layers, Calendar } from 'lucide-react';
import { filterOptions } from '../utils/sampleData';
import { RefreshButton, ResetButton, Select } from './ui';

/**
 * Standardized Filter Controls Bar — RicozAnalytics Enterprise Design System
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
        <div className="min-w-[150px]">
          <Select
            id="filter-date"
            value={filters.dateRange || 'all'}
            onChange={(e) => onFilterChange('dateRange', e.target.value)}
            icon={Calendar}
            ariaLabel="Filter by Date Range"
          >
            {filterOptions.dateRanges.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Region Dropdown */}
        <div className="min-w-[150px]">
          <Select
            id="filter-region"
            value={filters.region}
            onChange={(e) => onFilterChange('region', e.target.value)}
            icon={MapPin}
            ariaLabel="Filter by Region"
          >
            {filterOptions.regions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Channel Dropdown */}
        <div className="min-w-[150px]">
          <Select
            id="filter-category"
            value={filters.category}
            onChange={(e) => onFilterChange('category', e.target.value)}
            icon={Layers}
            ariaLabel="Filter by Channel"
          >
            {filterOptions.categories.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
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

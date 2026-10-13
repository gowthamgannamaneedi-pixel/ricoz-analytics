import React from 'react';
import { MapPin, Layers, Calendar, ShoppingBag } from 'lucide-react';
import { ResetButton, Select } from './ui';

/**
 * Enterprise Dynamic Filter Bar — RicozAnalytics Design System
 * Fully standardized with Reference 01 portal-backed Select dropdowns
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
        <Select
          id="dynamic-filter-date"
          value={filters.dateRange || 'all'}
          onChange={(e) => onFilterChange('dateRange', e.target.value)}
          aria-label="Filter by Date Range"
          icon={Calendar}
          className="min-w-[150px]"
        >
          <option value="all">All Time</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
          <option value="ytd">Year to Date</option>
        </Select>

        {/* Region Filter Dropdown */}
        <Select
          id="dynamic-filter-region"
          value={filters[regionCol || 'region'] || 'all'}
          onChange={(e) => onFilterChange(regionCol || 'region', e.target.value)}
          aria-label="Filter by Region"
          icon={MapPin}
          className="min-w-[160px]"
        >
          <option value="all">All Regions{regions.length > 0 ? ` (${regions.length})` : ''}</option>
          {regions.map((reg) => (
            <option key={reg} value={reg}>
              {reg}
            </option>
          ))}
        </Select>

        {/* Channel Filter Dropdown */}
        <Select
          id="dynamic-filter-channel"
          value={filters[channelCol || 'channel'] || 'all'}
          onChange={(e) => onFilterChange(channelCol || 'channel', e.target.value)}
          aria-label="Filter by Channel"
          icon={Layers}
          className="min-w-[160px]"
        >
          <option value="all">All Channels{channels.length > 0 ? ` (${channels.length})` : ''}</option>
          {channels.map((chan) => (
            <option key={chan} value={chan}>
              {chan}
            </option>
          ))}
        </Select>

        {/* Category Filter Dropdown */}
        <Select
          id="dynamic-filter-category"
          value={filters[categoryCol || 'category'] || 'all'}
          onChange={(e) => onFilterChange(categoryCol || 'category', e.target.value)}
          aria-label="Filter by Category"
          icon={ShoppingBag}
          className="min-w-[170px]"
        >
          <option value="all">All Categories{categories.length > 0 ? ` (${categories.length})` : ''}</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </Select>
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

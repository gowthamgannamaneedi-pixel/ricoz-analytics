import React, { useState, useRef, useEffect } from 'react';
import { Table2, ChevronDown, Check, Plus, Database, FileSpreadsheet, FileCode, Layers, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Enterprise Dataset Dropdown & Selector — RicozAnalytics Design System
 * 
 * Spec (Handoff Page 1, 2, 10, 39):
 * - Control height: 40px (h-10)
 * - Control radius: 8px (rounded-lg)
 * - Horizontal padding: 16px (px-4)
 * - Dedicated chevron vertically centered with 16px right inset
 * - White surface, dark readable text (#0F172A), 8px menu radius
 * - Soft red hover (#FFF1F3) and focus backgrounds
 * - Clear selected state distinction
 * - Outside-click and Escape key dismissal
 */
export default function DatasetSelector({
  datasets = [],
  selectedDatasetId,
  onSelectDataset,
  isLoading = false
}) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  const selectedDataset = datasets.find(d => d.id === selectedDatasetId) || datasets[0] || null;

  // Close dropdown on click outside or Escape
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const getSourceIcon = (type) => {
    switch (type) {
      case 'csv':
        return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
      case 'json':
        return <FileCode className="h-4 w-4 text-amber-600" />;
      case 'postgresql':
        return <Database className="h-4 w-4 text-blue-600" />;
      default:
        return <Layers className="h-4 w-4 text-slate-600" />;
    }
  };

  const filteredDatasets = datasets.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.data_source_name && d.data_source_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (datasets.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/data-sources')}
          className="flex items-center gap-2 h-10 rounded-lg bg-[#D91542] px-4 text-sm font-semibold text-white hover:bg-[#BE123C] transition shadow-xs cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Connect Dataset</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative font-sans" ref={dropdownRef}>
      {/* Trigger Button: 40px height, 8px radius, 16px padding */}
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        id="dataset-selector-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex items-center gap-3 h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-left text-sm font-medium text-slate-900 dark:text-slate-100 transition hover:border-rose-300 dark:hover:border-rose-800 hover:bg-[#FFF1F3]/40 dark:hover:bg-rose-950/30 focus:outline-none focus:ring-2 focus:ring-[#D91542]/20 shadow-2xs min-w-[220px] max-w-[340px] cursor-pointer"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#FFF1F3] dark:bg-rose-950/50 border border-rose-200/80 text-[#D91542] shrink-0">
          <Table2 className="h-3.5 w-3.5" />
        </div>

        <div className="min-w-0 flex-1 pr-1">
          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate block text-sm">
            {selectedDataset ? selectedDataset.name : 'Select Dataset'}
          </span>
        </div>

        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180 text-[#D91542]' : ''}`}
        />
      </button>

      {/* Popover Menu: 8px radius, white surface, subtle border and shadow */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 mt-2 w-84 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 p-2 shadow-2xl z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Search Header */}
          <div className="relative mb-2 px-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search datasets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-850 focus:border-[#D91542] focus:outline-none"
              autoFocus
            />
          </div>

          {/* Dataset List */}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredDatasets.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">
                No datasets matched your search.
              </div>
            ) : (
              filteredDatasets.map((d) => {
                const isSelected = selectedDataset && selectedDataset.id === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectDataset(d.id);
                      setIsOpen(false);
                      triggerRef.current?.focus();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#FFF1F3] dark:bg-rose-950/60 text-[#D91542] dark:text-rose-200 font-semibold border border-rose-200/80 dark:border-rose-900/50'
                        : 'text-slate-800 dark:text-slate-200 hover:bg-[#FFF1F3] hover:text-[#D91542] dark:hover:bg-rose-950/40 dark:hover:text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shrink-0">
                        {getSourceIcon(d.data_source_type)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {d.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {Number(d.row_count || 0).toLocaleString()} rows · {d.column_count || 0} cols
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 text-[#D91542] shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Bottom Action */}
          <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/data-sources');
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-[#D91542] hover:bg-[#FFF1F3] dark:hover:bg-rose-950/40 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Ingest New Dataset</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { Table2, ChevronDown, Check, Plus, Database, FileSpreadsheet, FileCode, Layers, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Enterprise Dataset Dropdown & Selector
 * @param {{
 *   datasets: Array<any>,
 *   selectedDatasetId: number | null,
 *   onSelectDataset: (id: number) => void,
 *   isLoading?: boolean
 * }} props
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

  const selectedDataset = datasets.find(d => d.id === selectedDatasetId) || datasets[0] || null;

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          className="flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Connect Dataset</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative font-sans" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        id="dataset-selector-trigger"
        className="flex items-center gap-2.5 h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-left text-xs font-medium text-slate-800 dark:text-slate-200 transition hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100 dark:focus:ring-rose-900/40 shadow-2xs min-w-[220px] max-w-[320px] cursor-pointer"
      >
        <div className="p-1 rounded-md bg-rose-50 border border-rose-100 text-rose-700 shrink-0">
          <Table2 className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <span className="font-bold text-slate-900 truncate block text-xs">
            {selectedDataset ? selectedDataset.name : 'Select Dataset'}
          </span>
        </div>

        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-rose-600' : ''}`} />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-80 rounded-lg border border-slate-200 bg-white p-2 shadow-xl z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="relative mb-2 px-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search datasets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-rose-600 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Dataset List */}
          <div className="max-h-60 overflow-y-auto space-y-1">
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
                    onClick={() => {
                      onSelectDataset(d.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-md text-left transition ${
                      isSelected
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-rose-50/90 hover:text-rose-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1 rounded bg-slate-50 border border-slate-100 shrink-0">
                        {getSourceIcon(d.data_source_type)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">
                          {d.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {Number(d.row_count || 0).toLocaleString()} rows · {d.column_count || 0} cols
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 text-rose-600 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Bottom Action */}
          <div className="pt-2 mt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/data-sources');
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
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

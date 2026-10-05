import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  Table2,
  FileSpreadsheet,
  FileCode,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  RefreshCw
} from 'lucide-react';
import { API_BASE_URL } from '../services/api';

/**
 * Humanize database column names (e.g. sales_amount -> Sales Amount, order_id -> Order ID)
 */
function formatColumnHeader(key) {
  if (!key) return '';
  const acronyms = { id: 'ID', kpi: 'KPI', url: 'URL', api: 'API', ip: 'IP', sku: 'SKU', q4: 'Q4', q3: 'Q3', q2: 'Q2', q1: 'Q1', db: 'DB' };
  return String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map(word => {
      const lower = word.toLowerCase();
      if (acronyms[lower]) return acronyms[lower];
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Enterprise Dataset Preview Modal
 * Displays strictly up to 50 real sample rows from backend API with schema types and sticky header
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   datasetId: number | null,
 *   token: string
 * }} props
 */
export default function DatasetPreviewModal({ isOpen, onClose, datasetId, token }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPreview = async (id) => {
    setIsLoading(true);
    setError('');
    setData(null);

    try {
      const res = await fetch(`${API_BASE_URL}/datasets/${id}/preview`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const json = await res.json();
        if (json?.data) {
          setData(json.data);
          return;
        }
      }

      // If backend returned an error JSON or non-OK response
      let errorMsg = `Failed to load preview (HTTP ${res.status})`;
      if (contentType.includes('application/json')) {
        const errJson = await res.json().catch(() => null);
        if (errJson?.message) errorMsg = errJson.message;
      }
      setError(errorMsg);
    } catch (err) {
      setError(err?.message || 'Network error while retrieving dataset preview.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && datasetId) {
      fetchPreview(datasetId);
    } else {
      setData(null);
      setError('');
    }
  }, [isOpen, datasetId]);

  const handleExportSampleCsv = () => {
    if (!data || !data.preview || data.preview.length === 0) return;

    const headers = Object.keys(data.preview[0]);
    const rows = data.preview.map(row =>
      headers.map(h => {
        const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${data.name || 'dataset'}_preview_50.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'number':
        return (
          <span className="inline-flex items-center gap-1 font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200/80">
            <Hash className="h-2.5 w-2.5" /> Number
          </span>
        );
      case 'boolean':
        return (
          <span className="inline-flex items-center gap-1 font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200/80">
            <ToggleLeft className="h-2.5 w-2.5" /> Boolean
          </span>
        );
      case 'date':
        return (
          <span className="inline-flex items-center gap-1 font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/80">
            <Calendar className="h-2.5 w-2.5" /> Date
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/80">
            <Type className="h-2.5 w-2.5" /> Text
          </span>
        );
    }
  };

  if (!isOpen) return null;

  const previewRows = Array.isArray(data?.preview) ? data.preview : [];
  
  // Parse schema if it's a JSON string
  let schemaList = [];
  if (Array.isArray(data?.schema)) {
    schemaList = data.schema;
  } else if (typeof data?.schema === 'string') {
    try {
      schemaList = JSON.parse(data.schema);
    } catch (_) {
      schemaList = [];
    }
  }

  const columnNames = schemaList.length > 0
    ? schemaList.map(s => s.name)
    : previewRows.length > 0
    ? Object.keys(previewRows[0])
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/40 backdrop-blur-xs font-sans">
      <div className="flex flex-col w-full max-w-6xl max-h-[92vh] rounded-2xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 shrink-0">
              <Table2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  {data?.name || (isLoading ? 'Loading Preview...' : 'Dataset Preview')}
                </h2>
                <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
                  50-Row Sample Preview
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {data ? `${Number(data.rowCount || 0).toLocaleString()} total records · ${data.columnCount || columnNames.length} columns detected` : 'Fetching real records from storage...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {previewRows.length > 0 && (
              <button
                onClick={handleExportSampleCsv}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden sm:inline">Export Sample ({previewRows.length})</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Schema Tag Strip */}
        {schemaList.length > 0 && (
          <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-50/70 border-b border-slate-200/80 overflow-x-auto shrink-0 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 shrink-0">
              Inferred Schema:
            </span>
            <div className="flex items-center gap-1.5">
              {schemaList.map((col) => (
                <div key={col.name} className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs shrink-0">
                  <span className="font-semibold text-slate-800 text-xs">{formatColumnHeader(col.name)}</span>
                  {getTypeBadge(col.type)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Table Content Area */}
        <div className="flex-1 overflow-auto bg-slate-50/40 p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-xs font-medium text-slate-600">
                Retrieving dataset records from storage provider...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto space-y-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-full border border-rose-200">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Failed to load preview</h3>
                <p className="text-xs text-rose-600 mt-1">{error}</p>
              </div>
              <button
                onClick={() => fetchPreview(datasetId)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-2xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : previewRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Table2 className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                No preview records available
              </p>
              <p className="text-xs text-slate-500 max-w-sm">
                This dataset does not contain preview rows in the underlying storage or data source.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
              <div className="overflow-x-auto max-h-[58vh]">
                <table className="w-full text-left border-collapse text-xs">
                  {/* Sticky Header */}
                  <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200/90 shadow-2xs">
                    <tr>
                      {/* Row Index Column */}
                      <th className="py-2.5 px-3 w-12 text-center text-[10px] font-mono font-bold uppercase text-slate-400 border-r border-slate-200/80 bg-slate-50 sticky left-0 z-30 select-none">
                        #
                      </th>
                      {columnNames.map((colName) => {
                        const colSchema = schemaList.find(s => s.name === colName);
                        return (
                          <th
                            key={colName}
                            className="py-2.5 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap bg-slate-50"
                          >
                            <div className="flex items-center gap-2">
                              <span>{formatColumnHeader(colName)}</span>
                              {colSchema && getTypeBadge(colSchema.type)}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-slate-100 bg-white text-xs">
                    {previewRows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-blue-50/30 transition-colors group">
                        {/* Row Index */}
                        <td className="py-2 px-3 text-center text-slate-400 border-r border-slate-100 font-mono text-[10px] bg-slate-50/60 group-hover:bg-blue-50/50 sticky left-0 z-10 select-none">
                          {rowIdx + 1}
                        </td>

                        {/* Cell Values */}
                        {columnNames.map((colName) => {
                          const val = row[colName];
                          const isNull = val === null || val === undefined;
                          const isBool = typeof val === 'boolean';
                          const isNum = typeof val === 'number';

                          return (
                            <td
                              key={colName}
                              className="py-2 px-4 whitespace-nowrap text-slate-800"
                            >
                              {isNull ? (
                                <span className="text-slate-300 italic font-sans text-[11px]">null</span>
                              ) : isBool ? (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  val
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200/80'
                                }`}>
                                  {val ? 'True' : 'False'}
                                </span>
                              ) : isNum ? (
                                <span className="font-mono text-slate-900 font-semibold">{val.toLocaleString()}</span>
                              ) : (
                                <span className="text-slate-800">{String(val)}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/60 text-xs text-slate-500 shrink-0">
          <span className="font-mono text-[11px]">
            Showing sample 1–{previewRows.length} of {Number(data?.rowCount || 0).toLocaleString()} rows
          </span>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200/90 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

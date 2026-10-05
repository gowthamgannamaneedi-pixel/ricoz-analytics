import React from 'react';
import {
  X,
  Table2,
  FileSpreadsheet,
  FileCode,
  Database,
  Server,
  Layers,
  Calendar,
  Hash,
  Type,
  ToggleLeft,
  ShieldCheck,
  Eye,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Humanize column names for schema inspector
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

export default function DatasetDetailsModal({
  isOpen,
  onClose,
  dataset,
  onPreview
}) {
  const navigate = useNavigate();

  if (!isOpen || !dataset) return null;

  // Parse schema if it is stored as JSON string
  let schemaList = [];
  if (Array.isArray(dataset.schema)) {
    schemaList = dataset.schema;
  } else if (typeof dataset.schema === 'string') {
    try {
      schemaList = JSON.parse(dataset.schema);
    } catch (_) {
      schemaList = [];
    }
  }

  const getTypeBadge = (type) => {
    switch (type) {
      case 'number':
        return (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200/80">
            <Hash className="h-3 w-3" /> Number
          </span>
        );
      case 'boolean':
        return (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200/80">
            <ToggleLeft className="h-3 w-3" /> Boolean
          </span>
        );
      case 'date':
        return (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/80">
            <Calendar className="h-3 w-3" /> Date
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/80">
            <Type className="h-3 w-3" /> String
          </span>
        );
    }
  };

  const getSourceIcon = (type) => {
    switch (type) {
      case 'csv':
        return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
      case 'json':
        return <FileCode className="h-4 w-4 text-amber-600" />;
      case 'postgresql':
        return <Database className="h-4 w-4 text-blue-600" />;
      case 'rest_api':
      case 'api':
        return <Server className="h-4 w-4 text-purple-600" />;
      default:
        return <Layers className="h-4 w-4 text-slate-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/40 backdrop-blur-xs font-sans">
      <div className="flex flex-col w-full max-w-3xl max-h-[90vh] rounded-2xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 shrink-0">
              <Table2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {dataset.name}
                </h2>
                <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
                  ID: #{dataset.id}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {dataset.description || 'Structured enterprise telemetry dataset'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/40">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 block">Record Volume</span>
              <span className="text-lg font-bold font-mono text-slate-900 mt-1 block">
                {Number(dataset.row_count || 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400">Total rows</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 block">Column Fields</span>
              <span className="text-lg font-bold font-mono text-slate-900 mt-1 block">
                {dataset.column_count || schemaList.length || 0}
              </span>
              <span className="text-[10px] text-slate-400">Inferred attributes</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 block">Source Pipeline</span>
              <div className="flex items-center gap-1.5 mt-1.5">
                {getSourceIcon(dataset.data_source_type)}
                <span className="text-xs font-semibold text-slate-800 truncate">
                  {(dataset.data_source_type || 'CSV').toUpperCase()}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                {dataset.data_source_name || 'Direct Ingestion'}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 block">Created On</span>
              <span className="text-xs font-semibold text-slate-800 mt-1.5 block">
                {dataset.created_at ? new Date(dataset.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                }) : '—'}
              </span>
              <span className="text-[10px] text-slate-400">
                {dataset.updated_at ? `Synced: ${new Date(dataset.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
              </span>
            </div>
          </div>

          {/* Schema Structure Table */}
          <div className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900">
                Schema Architecture ({schemaList.length} Fields)
              </h3>
              <span className="text-[11px] text-slate-500">
                Inferred column definitions
              </span>
            </div>

            {schemaList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No explicit column schema metadata recorded for this dataset.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200/80 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold text-slate-600">#</th>
                      <th className="py-2.5 px-4 font-semibold text-slate-600">Column Name</th>
                      <th className="py-2.5 px-4 font-semibold text-slate-600">Display Label</th>
                      <th className="py-2.5 px-4 font-semibold text-slate-600">Data Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {schemaList.map((col, idx) => (
                      <tr key={col.name || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-mono font-medium text-slate-900">{col.name}</td>
                        <td className="py-2.5 px-4 text-slate-700">{formatColumnHeader(col.name)}</td>
                        <td className="py-2.5 px-4">{getTypeBadge(col.type)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                navigate(`/data-quality?datasetId=${dataset.id}`);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition shadow-2xs"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Data Quality</span>
            </button>

            <button
              onClick={() => {
                onClose();
                if (onPreview) onPreview(dataset.id);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition shadow-2xs"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Preview Records</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

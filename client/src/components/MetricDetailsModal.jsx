import React from 'react';
import {
  X,
  Gauge,
  Database,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Hash,
  Layers,
  Edit3,
  Trash2
} from 'lucide-react';

/**
 * MetricDetailsModal - Inspect full KPI definition, thresholds, and target tracking
 */
export default function MetricDetailsModal({
  isOpen,
  onClose,
  metric,
  onEdit,
  onDelete,
  isViewer = false
}) {
  if (!isOpen || !metric) return null;

  const target = Number(metric.target_value);
  const current = Number(metric.current_value);
  const progress = target > 0 ? Number(((current / target) * 100).toFixed(1)) : 100;
  const formatting = typeof metric.formatting === 'object' && metric.formatting !== null ? metric.formatting : {};

  const formatValue = (val) => {
    if (val === null || val === undefined || isNaN(Number(val))) return '—';
    const num = Number(val);
    if (metric.type === 'currency' || metric.unit === '₹') {
      return `₹${num.toLocaleString()}`;
    }
    if (metric.type === 'percentage' || metric.unit === '%') {
      return `${num}%`;
    }
    return `${num.toLocaleString()} ${metric.unit || ''}`.trim();
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'on_track':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>On Track</span>
          </span>
        );
      case 'at_risk':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/90 shadow-2xs">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span>At Risk</span>
          </span>
        );
      case 'behind':
      case 'critical':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/90 shadow-2xs">
            <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
            <span>Behind Target</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/30 backdrop-blur-xs font-sans">
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 shrink-0">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {metric.name}
                </h2>
                {renderStatusBadge(metric.status)}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {metric.description || 'Key performance indicator definition'}
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
          {/* Main KPI Performance Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-slate-500 block">Current Evaluated Value</span>
                <span className="text-3xl font-bold font-mono text-slate-900 mt-1 block">
                  {formatValue(metric.current_value)}
                </span>
              </div>
              <div className="sm:text-right">
                <span className="text-xs font-semibold text-slate-500 block">Target Goal</span>
                <span className="text-xl font-bold font-mono text-slate-700 mt-1 block">
                  {target > 0 ? formatValue(metric.target_value) : 'No target'}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            {target > 0 && (
              <div>
                <div className="flex justify-between text-xs mb-1.5 font-medium">
                  <span className="text-slate-600">Goal Progress</span>
                  <span className="font-mono font-bold text-slate-900">{progress}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      metric.status === 'on_track'
                        ? 'bg-emerald-500'
                        : metric.status === 'at_risk'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 block">Metric Type</span>
              <span className="text-xs font-bold text-slate-800 capitalize mt-1 block">
                {metric.type || 'Currency'}
              </span>
              <span className="text-[10px] text-slate-400">Unit: {metric.unit || 'Standard'}</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 block">Calculation Formula</span>
              <span className="text-xs font-mono font-bold text-rose-600 mt-1 block truncate" title={metric.formula}>
                {metric.formula || 'SUM'}
              </span>
              <span className="text-[10px] text-slate-400">Agg: {formatting.aggregation_type || 'SUM'}</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 block">Linked Dataset</span>
              <span className="text-xs font-semibold text-slate-800 mt-1 block truncate" title={metric.dataset_name || 'Dataset'}>
                {metric.dataset_name || (metric.dataset_id ? `Dataset #${metric.dataset_id}` : 'None')}
              </span>
              <span className="text-[10px] text-slate-400">{metric.record_count ? `${metric.record_count} evaluated rows` : 'Linked'}</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 block">Warning Threshold</span>
              <span className="text-xs font-bold font-mono text-amber-700 mt-1 block">
                {formatting.warning_threshold ? formatValue(formatting.warning_threshold) : 'None'}
              </span>
              <span className="text-[10px] text-slate-400">Triggers At Risk</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 block">Critical Threshold</span>
              <span className="text-xs font-bold font-mono text-rose-700 mt-1 block">
                {formatting.critical_threshold ? formatValue(formatting.critical_threshold) : 'None'}
              </span>
              <span className="text-[10px] text-slate-400">Triggers Behind Target</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 block">Defined By</span>
              <span className="text-xs font-semibold text-slate-800 mt-1 block truncate">
                {metric.creator_name || 'Analyst'}
              </span>
              <span className="text-[10px] text-slate-400">
                {metric.created_at ? new Date(metric.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-white shrink-0">
          {!isViewer && (
            <div className="flex items-center gap-2">
              {onEdit && (
                <button
                  onClick={() => {
                    onClose();
                    onEdit(metric);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                  <span>Edit Metric</span>
                </button>
              )}

              {onDelete && (
                <button
                  onClick={() => {
                    onClose();
                    onDelete(metric);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition shadow-2xs"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                  <span>Delete Metric</span>
                </button>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

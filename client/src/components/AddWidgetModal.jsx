import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Check,
  AlertCircle,
  Loader2,
  TrendingUp,
  BarChart3,
  PieChart,
  AreaChart as AreaChartIcon,
  Table2,
  Gauge,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';

const WIDGET_TYPES = [
  { id: 'kpi_card', label: 'KPI Stat Card', icon: Activity, desc: 'Single aggregated business metric with target comparison' },
  { id: 'ai_insights', label: 'AI Insights Card', icon: Sparkles, desc: 'Proactive automated insights & operational anomalies' },
  { id: 'line_chart', label: 'Line Chart', icon: TrendingUp, desc: 'Continuous time-series trendline with baseline' },
  { id: 'bar_chart', label: 'Bar Chart', icon: BarChart3, desc: 'Categorical distribution and comparative volume' },
  { id: 'pie_chart', label: 'Pie / Donut', icon: PieChart, desc: 'Proportional commercial share of categories' },
  { id: 'area_chart', label: 'Area Chart', icon: AreaChartIcon, desc: 'Volume over timeline with smooth gradient fill' },
  { id: 'table', label: 'Data Table', icon: Table2, desc: 'Compact scrollable table preview of dataset records' },
  { id: 'metric_gauge', label: 'Metric Gauge', icon: Gauge, desc: 'Target threshold dial with on-track status' }
];

const AGGREGATION_OPTIONS = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];

const WIDTH_OPTIONS = [
  { label: 'Full Width (12 cols)', value: 12 },
  { label: 'Half Width (6 cols)', value: 6 },
  { label: 'One Third (4 cols)', value: 4 }
];

/**
 * Enterprise Add / Edit Widget Modal
 */
export default function AddWidgetModal({
  isOpen,
  onClose,
  onSave,
  datasets = [],
  metrics = [],
  widget = null,
  isLoading = false
}) {
  const isEditing = Boolean(widget && widget.id);

  const [type, setType] = useState('kpi_card');
  const [title, setTitle] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [metricId, setMetricId] = useState('');
  const [aggregation, setAggregation] = useState('SUM');
  const [categoryColumn, setCategoryColumn] = useState('');
  const [valueColumn, setValueColumn] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [widthSpan, setWidthSpan] = useState(6);
  const [error, setError] = useState('');

  // Selected dataset schema columns
  const activeDataset = datasets.find(d => String(d.id) === String(datasetId));
  const datasetColumns = (activeDataset?.schema && Array.isArray(activeDataset.schema))
    ? activeDataset.schema.map(col => typeof col === 'string' ? col : col.name)
    : [];

  useEffect(() => {
    if (widget) {
      setType(widget.type || 'kpi_card');
      setTitle(widget.title || '');
      setDatasetId(widget.dataset_id || '');
      setMetricId(widget.metric_id || '');

      let config = widget.configuration;
      if (typeof config === 'string') {
        try { config = JSON.parse(config); } catch (_) { config = {}; }
      }
      setAggregation(config?.aggregation || 'SUM');
      setCategoryColumn(config?.categoryColumn || config?.dateColumn || '');
      setValueColumn(config?.valueColumn || config?.targetColumn || '');
      setTargetValue(config?.targetValue || widget.metric_target_value || '');

      let pos = widget.position;
      if (typeof pos === 'string') {
        try { pos = JSON.parse(pos); } catch (_) { pos = {}; }
      }
      setWidthSpan(pos?.w || 6);
    } else {
      setType('kpi_card');
      setTitle('');
      setDatasetId(datasets[0]?.id ? String(datasets[0].id) : '');
      setMetricId(metrics[0]?.id ? String(metrics[0].id) : '');
      setAggregation('SUM');
      setCategoryColumn('');
      setValueColumn('');
      setTargetValue('');
      setWidthSpan(6);
    }
    setError('');
  }, [widget, isOpen, datasets, metrics]);

  // Auto-populate columns when dataset changes
  useEffect(() => {
    if (datasetColumns.length > 0 && !categoryColumn) {
      setCategoryColumn(datasetColumns[0]);
    }
    if (datasetColumns.length > 1 && !valueColumn) {
      const numCol = datasetColumns.find(c => c.toLowerCase().includes('sales') || c.toLowerCase().includes('revenue') || c.toLowerCase().includes('amount') || c.toLowerCase().includes('units')) || datasetColumns[1];
      setValueColumn(numCol);
    }
  }, [datasetId, datasetColumns]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please provide a widget title.');
      return;
    }

    const config = {
      aggregation,
      categoryColumn: categoryColumn || undefined,
      dateColumn: categoryColumn || undefined,
      valueColumn: valueColumn || undefined,
      targetValue: targetValue ? Number(targetValue) : undefined
    };

    const position = {
      x: 0,
      y: 0,
      w: Number(widthSpan) || 6,
      h: 4
    };

    const payload = {
      title: title.trim(),
      type,
      dataset_id: datasetId ? datasetId : null,
      metric_id: (type === 'kpi_card' || type === 'metric_gauge') && metricId ? metricId : null,
      configuration: config,
      position
    };

    try {
      await onSave(payload);
    } catch (err) {
      setError(err.message || 'Failed to save widget.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {isEditing ? 'Edit Dashboard Widget' : 'Add Widget to Dashboard'}
              </h2>
              <p className="text-xs text-slate-500">
                Configure metric visualizations and chart mappings
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Widget Type Selection Grid */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Widget Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {WIDGET_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setType(t.id);
                      if (!title) setTitle(t.label);
                    }}
                    className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-500 shadow-2xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <Icon className={`h-4 w-4 mb-2 ${isSelected ? 'text-blue-600' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold text-slate-900">{t.label}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Title & Width Span */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Widget Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Regional Revenue Breakdown"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Grid Width
              </label>
              <select
                value={widthSpan}
                onChange={(e) => setWidthSpan(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {WIDTH_OPTIONS.map((w) => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Data Binding */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-blue-600" />
              <span>Data Source & Metric Mapping</span>
            </h3>

            {/* If KPI Card / Gauge, allow selecting Phase 7 Saved Metric */}
            {(type === 'kpi_card' || type === 'metric_gauge') && metrics.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Connect to Saved KPI (Phase 7) <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <select
                  value={metricId}
                  onChange={(e) => {
                    const mId = e.target.value;
                    setMetricId(mId);
                    const selectedM = metrics.find(m => String(m.id) === String(mId));
                    if (selectedM) {
                      if (!title || WIDGET_TYPES.some(wt => wt.label === title)) setTitle(selectedM.name);
                      if (selectedM.dataset_id) setDatasetId(selectedM.dataset_id);
                      if (selectedM.target_value) setTargetValue(String(selectedM.target_value));
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Custom Dataset Calculation --</option>
                  {metrics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.formula})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Dataset Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Dataset <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={datasetId}
                onChange={(e) => setDatasetId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select a Dataset...</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.row_count || 0} rows)
                  </option>
                ))}
              </select>
            </div>

            {/* Chart Dimension & Value Mapping */}
            {['line_chart', 'bar_chart', 'pie_chart', 'area_chart'].includes(type) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category / Timeline Field (X-Axis)
                  </label>
                  {datasetColumns.length > 0 ? (
                    <select
                      value={categoryColumn}
                      onChange={(e) => setCategoryColumn(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 bg-white focus:border-blue-500 focus:outline-none"
                    >
                      {datasetColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={categoryColumn}
                      onChange={(e) => setCategoryColumn(e.target.value)}
                      placeholder="e.g. region, date"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 bg-white"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Value / Metric Field (Y-Axis)
                  </label>
                  {datasetColumns.length > 0 ? (
                    <select
                      value={valueColumn}
                      onChange={(e) => setValueColumn(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 bg-white focus:border-blue-500 focus:outline-none"
                    >
                      {datasetColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={valueColumn}
                      onChange={(e) => setValueColumn(e.target.value)}
                      placeholder="e.g. sales_amount"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 bg-white"
                    />
                  )}
                </div>
              </div>
            )}

            {/* KPI Card Aggregation & Target Settings */}
            {(type === 'kpi_card' || type === 'metric_gauge') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Aggregation Method
                  </label>
                  <select
                    value={aggregation}
                    onChange={(e) => setAggregation(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 bg-white"
                  >
                    {AGGREGATION_OPTIONS.map(agg => (
                      <option key={agg} value={agg}>{agg}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Goal Value <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="e.g. 100000"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50 shadow-xs"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving Widget...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>{isEditing ? 'Update Widget' : 'Add Widget'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

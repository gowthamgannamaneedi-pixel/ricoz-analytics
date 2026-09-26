import React, { useState, useEffect } from 'react';
import { X, Loader2, Sparkles, HelpCircle, Layers, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../services/api';

const METRIC_TYPES = [
  { value: 'currency', label: 'Currency (₹)', defaultUnit: '₹' },
  { value: 'percentage', label: 'Percentage (%)', defaultUnit: '%' },
  { value: 'count', label: 'Count (Volume)', defaultUnit: 'units' },
  { value: 'decimal', label: 'Decimal Number', defaultUnit: '' },
  { value: 'custom', label: 'Custom Calculation', defaultUnit: '' }
];

const AGGREGATIONS = [
  { value: 'SUM', label: 'SUM (Total Aggregate)' },
  { value: 'AVG', label: 'AVG (Average / Mean)' },
  { value: 'COUNT', label: 'COUNT (Record Count)' },
  { value: 'MIN', label: 'MIN (Minimum Boundary)' },
  { value: 'MAX', label: 'MAX (Maximum Peak)' }
];

/**
 * MetricModal - Create & Edit KPI / Metric Definitions
 */
export default function MetricModal({
  isOpen,
  onClose,
  onSuccess,
  token,
  metricToEdit = null,
  datasets = []
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('currency');
  const [unit, setUnit] = useState('₹');
  const [datasetId, setDatasetId] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [aggregationType, setAggregationType] = useState('SUM');
  const [formula, setFormula] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [warningThreshold, setWarningThreshold] = useState('');
  const [criticalThreshold, setCriticalThreshold] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Selected dataset schema columns
  const selectedDataset = datasets.find(d => String(d.id) === String(datasetId));
  const datasetColumns = React.useMemo(() => {
    if (!selectedDataset?.schema) return [];
    let schema = selectedDataset.schema;
    if (typeof schema === 'string') {
      try { schema = JSON.parse(schema); } catch (_) { schema = []; }
    }
    return Array.isArray(schema) ? schema : [];
  }, [selectedDataset]);

  // Load existing values if editing
  useEffect(() => {
    if (metricToEdit) {
      setName(metricToEdit.name || '');
      setDescription(metricToEdit.description || '');
      setType(metricToEdit.type || 'currency');
      setUnit(metricToEdit.unit || '');
      setDatasetId(metricToEdit.dataset_id || '');
      setFormula(metricToEdit.formula || '');
      setTargetValue(metricToEdit.target_value !== null ? String(metricToEdit.target_value) : '');

      const fmt = metricToEdit.formatting || {};
      setAggregationType(fmt.aggregation_type || 'SUM');
      setTargetColumn(fmt.target_column || '');
      setWarningThreshold(fmt.warning_threshold !== null && fmt.warning_threshold !== undefined ? String(fmt.warning_threshold) : '');
      setCriticalThreshold(fmt.critical_threshold !== null && fmt.critical_threshold !== undefined ? String(fmt.critical_threshold) : '');
    } else {
      // Default reset
      setName('');
      setDescription('');
      setType('currency');
      setUnit('₹');
      setDatasetId(datasets.length > 0 ? String(datasets[0].id) : '');
      setAggregationType('SUM');
      setTargetColumn('');
      setFormula('SUM(sales_amount)');
      setTargetValue('500000');
      setWarningThreshold('350000');
      setCriticalThreshold('200000');
    }
    setError('');
  }, [metricToEdit, isOpen, datasets]);

  // Update formula template when column/aggregation changes
  const handleColumnOrAggChange = (col, agg) => {
    setTargetColumn(col);
    setAggregationType(agg);
    if (col) {
      setFormula(`${agg}(${col})`);
    }
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    const matched = METRIC_TYPES.find(t => t.value === newType);
    if (matched && matched.defaultUnit !== undefined) {
      setUnit(matched.defaultUnit);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a metric name.');
      return;
    }
    if (!formula.trim()) {
      setError('Please provide a calculation formula.');
      return;
    }

    setIsLoading(true);
    setError('');

    const payload = {
      name: name.trim(),
      description: description.trim(),
      type,
      unit: unit.trim(),
      dataset_id: datasetId || null,
      formula: formula.trim(),
      target_value: targetValue ? Number(targetValue) : null,
      aggregation_type: aggregationType,
      warning_threshold: warningThreshold ? Number(warningThreshold) : null,
      critical_threshold: criticalThreshold ? Number(criticalThreshold) : null,
      formatting: {
        target_column: targetColumn,
        aggregation_type: aggregationType,
        warning_threshold: warningThreshold ? Number(warningThreshold) : null,
        critical_threshold: criticalThreshold ? Number(criticalThreshold) : null
      }
    };

    try {
      const isEdit = Boolean(metricToEdit?.id);
      const url = isEdit ? `${API_BASE_URL}/metrics/${metricToEdit.id}` : `${API_BASE_URL}/metrics`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save KPI metric definition.');
      }

      onSuccess(data);
      onClose();
    } catch (err) {
      setError(err.message || 'Error occurred while saving metric.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs font-sans animate-fade-in">
      <div 
        className="w-full max-w-xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              {metricToEdit ? 'Configure KPI Metric' : 'Define New KPI Metric'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Set calculation formulas, target thresholds, and telemetry bindings.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Metric Name & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="metric-name">
                KPI Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="metric-name"
                type="text"
                required
                placeholder="e.g. Q4 Net Revenue"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="metric-type">
                Format Type
              </label>
              <select
                id="metric-type"
                value={type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs text-slate-900 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none"
              >
                {METRIC_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dataset Binding & Aggregation */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="dataset-select">
                Target Dataset
              </label>
              <select
                id="dataset-select"
                value={datasetId}
                onChange={(e) => setDatasetId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs text-slate-900 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none"
              >
                <option value="">-- Standalone (No Dataset) --</option>
                {datasets.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="metric-unit">
                Unit Symbol
              </label>
              <input
                id="metric-unit"
                type="text"
                placeholder="₹, %, units"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Aggregation & Column Assistant */}
          {datasetColumns.length > 0 && (
            <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 space-y-2">
              <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                <span>Formula Assistant</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="block text-[10px] font-semibold text-blue-800 mb-1">Aggregation</span>
                  <select
                    value={aggregationType}
                    onChange={(e) => handleColumnOrAggChange(targetColumn, e.target.value)}
                    className="w-full rounded border border-blue-200 bg-white py-1 px-2 text-xs text-slate-800"
                  >
                    {AGGREGATIONS.map(a => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-blue-800 mb-1">Column Field</span>
                  <select
                    value={targetColumn}
                    onChange={(e) => handleColumnOrAggChange(e.target.value, aggregationType)}
                    className="w-full rounded border border-blue-200 bg-white py-1 px-2 text-xs text-slate-800"
                  >
                    <option value="">-- Choose Column --</option>
                    {datasetColumns.map(c => (
                      <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Formula Expression */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="metric-formula">
              Formula Expression <span className="text-rose-500">*</span>
            </label>
            <input
              id="metric-formula"
              type="text"
              required
              placeholder="e.g. SUM(sales_amount) or COUNT(order_id)"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 font-mono text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* Targets & Threshold Boundaries */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="target-val">
                Target Objective
              </label>
              <input
                id="target-val"
                type="number"
                placeholder="500000"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 font-mono text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-700 mb-1" htmlFor="warn-val">
                Warning Threshold
              </label>
              <input
                id="warn-val"
                type="number"
                placeholder="350000"
                value={warningThreshold}
                onChange={(e) => setWarningThreshold(e.target.value)}
                className="w-full rounded-lg border border-amber-200 bg-white py-1.5 px-3 font-mono text-xs text-slate-900 placeholder-slate-400 transition hover:border-amber-300 focus:border-amber-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-rose-700 mb-1" htmlFor="crit-val">
                Critical Threshold
              </label>
              <input
                id="crit-val"
                type="number"
                placeholder="200000"
                value={criticalThreshold}
                onChange={(e) => setCriticalThreshold(e.target.value)}
                className="w-full rounded-lg border border-rose-200 bg-white py-1.5 px-3 font-mono text-xs text-slate-900 placeholder-slate-400 transition hover:border-rose-300 focus:border-rose-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="metric-desc">
              Description / Business Context
            </label>
            <textarea
              id="metric-desc"
              rows={2}
              placeholder="e.g. Total commercial billing across Indian enterprise pipeline."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isLoading}
              id="save-metric-btn"
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50 shadow-xs"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{metricToEdit ? 'Save Changes' : 'Create KPI Metric'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

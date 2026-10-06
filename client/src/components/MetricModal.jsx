import React, { useState, useEffect } from 'react';
import { X, Loader2, Sparkles, HelpCircle, Layers, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/Button';
import { API_BASE_URL } from '../services/api';

const METRIC_TYPES = [
  { value: 'currency', label: 'Currency (₹)', defaultUnit: '₹' },
  { value: 'percentage', label: 'Percentage (%)', defaultUnit: '%' },
  { value: 'count', label: 'Count (Volume)', defaultUnit: 'units' },
  { value: 'decimal', label: 'Decimal Number', defaultUnit: '' },
  { value: 'custom', label: 'Custom Calculation', defaultUnit: '' }
];

const AGGREGATIONS = [
  { value: 'SUM', label: 'SUM (Total / Sum)' },
  { value: 'AVG', label: 'AVG (Average / Mean)' },
  { value: 'COUNT', label: 'COUNT (Number of Records)' },
  { value: 'MIN', label: 'MIN (Minimum Value)' },
  { value: 'MAX', label: 'MAX (Maximum Value)' }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs font-sans animate-fade-in">
      <div 
        className="w-full max-w-xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              {metricToEdit ? 'Edit KPI Metric' : 'Define New KPI'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure calculation rules, target goals, and linked datasets.
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider text-[11px] text-slate-500">
              Basic Information
            </h3>

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
                  className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 placeholder-slate-400 transition hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="metric-type">
                  Display Format
                </label>
                <select
                  id="metric-type"
                  value={type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 transition hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none shadow-2xs cursor-pointer"
                >
                  {METRIC_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="dataset-select">
                  Source Dataset (Optional)
                </label>
                <select
                  id="dataset-select"
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 transition hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none shadow-2xs cursor-pointer"
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
                  className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 placeholder-slate-400 transition hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Calculation & Formula */}
          <div className="space-y-3.5 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider text-[11px] text-slate-500">
              Calculation & Formula
            </h3>

            {/* Formula Helper */}
            {datasetColumns.length > 0 && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2">
                <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  <span>Formula Helper</span>
                  <span className="text-[10px] text-slate-400 font-normal">· Pick field & aggregation to auto-generate</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="block text-[10px] font-medium text-slate-600 mb-1">Aggregation</span>
                    <select
                      value={aggregationType}
                      onChange={(e) => handleColumnOrAggChange(targetColumn, e.target.value)}
                      className="w-full rounded border border-slate-200 bg-white py-1 px-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                    >
                      {AGGREGATIONS.map(a => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="block text-[10px] font-medium text-slate-600 mb-1">Column Field</span>
                    <select
                      value={targetColumn}
                      onChange={(e) => handleColumnOrAggChange(e.target.value, aggregationType)}
                      className="w-full rounded border border-slate-200 bg-white py-1 px-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
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
              <span className="text-[10px] text-slate-400 mt-1 block">
                Standard SQL aggregations supported: SUM, AVG, COUNT, MIN, MAX.
              </span>
            </div>
          </div>

          {/* Section 3: Targets & Threshold Boundaries */}
          <div className="space-y-3.5 pt-3 border-t border-slate-100">
            <div>
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider text-[11px] text-slate-500">
                Target Goals & Thresholds
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Set milestones and automatic status tracking thresholds.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="target-val">
                  Target Goal
                </label>
                <input
                  id="target-val"
                  type="number"
                  placeholder="500000"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 font-mono text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Target to achieve</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-700 mb-1" htmlFor="warn-val">
                  Warning Level
                </label>
                <input
                  id="warn-val"
                  type="number"
                  placeholder="350000"
                  value={warningThreshold}
                  onChange={(e) => setWarningThreshold(e.target.value)}
                  className="w-full rounded-lg border border-amber-200 bg-white py-1.5 px-3 font-mono text-xs text-slate-900 placeholder-slate-400 transition hover:border-amber-300 focus:border-amber-600 focus:outline-none"
                />
                <span className="text-[10px] text-amber-600/80 mt-1 block">Below triggers At Risk</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-rose-700 mb-1" htmlFor="crit-val">
                  Critical Level
                </label>
                <input
                  id="crit-val"
                  type="number"
                  placeholder="200000"
                  value={criticalThreshold}
                  onChange={(e) => setCriticalThreshold(e.target.value)}
                  className="w-full rounded-lg border border-rose-200 bg-white py-1.5 px-3 font-mono text-xs text-slate-900 placeholder-slate-400 transition hover:border-rose-300 focus:border-rose-600 focus:outline-none"
                />
                <span className="text-[10px] text-rose-600/80 mt-1 block">Below triggers Behind Target</span>
              </div>
            </div>
          </div>

          {/* Section 4: Description */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700" htmlFor="metric-desc">
              Description (Optional)
            </label>
            <textarea
              id="metric-desc"
              rows={2}
              placeholder="e.g. Total revenue generated across all regional sales channels."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
              loading={isLoading}
              id="save-metric-btn"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{metricToEdit ? 'Save Changes' : 'Create KPI'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Sparkles, Database, Plus, HelpCircle } from 'lucide-react';
import Button from './ui/Button';
import { getDatasets, getDatasetById } from '../services/api';

const METRIC_TYPES = [
  { value: 'currency', label: 'Currency (₹ INR)', defaultUnit: '₹' },
  { value: 'number', label: 'Standard Numeric (#)', defaultUnit: '' },
  { value: 'percentage', label: 'Percentage (%)', defaultUnit: '%' }
];

const AGGREGATIONS = [
  { value: 'SUM', label: 'Sum (Total)' },
  { value: 'AVG', label: 'Average (Mean)' },
  { value: 'COUNT', label: 'Count (Occurrences)' },
  { value: 'MIN', label: 'Minimum' },
  { value: 'MAX', label: 'Maximum' }
];

export default function MetricModal({
  isOpen,
  onClose,
  onSubmit,
  metricToEdit = null,
  isLoading = false
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('currency');
  const [unit, setUnit] = useState('₹');
  const [formula, setFormula] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [warningThreshold, setWarningThreshold] = useState('');
  const [criticalThreshold, setCriticalThreshold] = useState('');
  const [description, setDescription] = useState('');
  const [datasetId, setDatasetId] = useState('');
  
  // Datasets and columns state
  const [datasets, setDatasets] = useState([]);
  const [datasetColumns, setDatasetColumns] = useState([]);
  const [aggregationType, setAggregationType] = useState('SUM');
  const [targetColumn, setTargetColumn] = useState('');
  const [error, setError] = useState('');

  // Fetch datasets list on modal open
  useEffect(() => {
    if (isOpen) {
      getDatasets()
        .then((res) => {
          const dsList = res.datasets || res.data || [];
          setDatasets(dsList);
        })
        .catch((err) => {
          console.error('Failed to load datasets for MetricModal:', err);
        });
    }
  }, [isOpen]);

  // Load dataset columns when datasetId changes
  useEffect(() => {
    if (datasetId) {
      getDatasetById(datasetId)
        .then((res) => {
          const ds = res.dataset || res.data;
          if (ds && ds.schema_json && Array.isArray(ds.schema_json.columns)) {
            setDatasetColumns(ds.schema_json.columns);
          } else {
            setDatasetColumns([]);
          }
        })
        .catch(() => setDatasetColumns([]));
    } else {
      setDatasetColumns([]);
    }
  }, [datasetId]);

  // Populate fields if editing
  useEffect(() => {
    if (metricToEdit) {
      setName(metricToEdit.name || '');
      setType(metricToEdit.type || 'currency');
      setUnit(metricToEdit.unit || '₹');
      setFormula(metricToEdit.formula || '');
      setTargetValue(metricToEdit.target_value !== null && metricToEdit.target_value !== undefined ? String(metricToEdit.target_value) : '');
      setDescription(metricToEdit.description || '');
      setDatasetId(metricToEdit.dataset_id ? String(metricToEdit.dataset_id) : '');

      const formatting = typeof metricToEdit.formatting === 'object' && metricToEdit.formatting !== null
        ? metricToEdit.formatting
        : {};
      setWarningThreshold(formatting.warning_threshold !== undefined ? String(formatting.warning_threshold) : '');
      setCriticalThreshold(formatting.critical_threshold !== undefined ? String(formatting.critical_threshold) : '');
      setAggregationType(formatting.aggregation_type || 'SUM');
      setTargetColumn(formatting.target_column || '');
    } else {
      setName('');
      setType('currency');
      setUnit('₹');
      setFormula('');
      setTargetValue('');
      setWarningThreshold('');
      setCriticalThreshold('');
      setDescription('');
      setDatasetId('');
      setAggregationType('SUM');
      setTargetColumn('');
      setError('');
    }
  }, [metricToEdit, isOpen]);

  const handleTypeChange = (newType) => {
    setType(newType);
    const selected = METRIC_TYPES.find(t => t.value === newType);
    if (selected) {
      setUnit(selected.defaultUnit);
    }
  };

  const handleColumnOrAggChange = (newCol, newAgg) => {
    setTargetColumn(newCol);
    setAggregationType(newAgg);
    if (newCol) {
      setFormula(`${newAgg}(${newCol})`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please provide a metric name.');
      return;
    }
    if (!formula.trim()) {
      setError('Please provide a calculation formula (e.g. SUM(sales_amount)).');
      return;
    }

    const payload = {
      name: name.trim(),
      type,
      unit: unit.trim(),
      formula: formula.trim(),
      target_value: targetValue !== '' ? Number(targetValue) : null,
      description: description.trim(),
      dataset_id: datasetId ? Number(datasetId) : null,
      formatting: {
        warning_threshold: warningThreshold !== '' ? Number(warningThreshold) : null,
        critical_threshold: criticalThreshold !== '' ? Number(criticalThreshold) : null,
        aggregation_type: aggregationType,
        target_column: targetColumn
      }
    };

    onSubmit(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/40 backdrop-blur-xs font-sans">
      <div className="flex flex-col w-full max-w-xl max-h-[92vh] rounded-2xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {metricToEdit ? 'Edit Key Performance Indicator' : 'Define New Metric (KPI)'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure business metrics with formula expressions, benchmarks, and automated status tracking.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
            title="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider text-[11px] text-slate-500">
              Basic Metric Attributes
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="metric-name">
                  Metric Title <span className="text-rose-500">*</span>
                </label>
                <input
                  id="metric-name"
                  type="text"
                  required
                  placeholder="e.g. Q4 Net Revenue"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 placeholder-slate-400 transition hover:border-slate-400 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 focus:outline-none shadow-2xs"
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
                  className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 transition hover:border-slate-400 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 focus:outline-none shadow-2xs cursor-pointer"
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
                  className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 transition hover:border-slate-400 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 focus:outline-none shadow-2xs cursor-pointer"
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
                  className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 placeholder-slate-400 transition hover:border-slate-400 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 focus:outline-none shadow-2xs"
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
                  <Sparkles className="h-3.5 w-3.5 text-rose-600" />
                  <span>Formula Helper</span>
                  <span className="text-[10px] text-slate-400 font-normal">· Pick field & aggregation to auto-generate</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="block text-[10px] font-medium text-slate-600 mb-1">Aggregation</span>
                    <select
                      value={aggregationType}
                      onChange={(e) => handleColumnOrAggChange(targetColumn, e.target.value)}
                      className="w-full rounded border border-slate-200 bg-white py-1 px-2 text-xs text-slate-800 focus:border-rose-600 focus:outline-none"
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
                      className="w-full rounded border border-slate-200 bg-white py-1 px-2 text-xs text-slate-800 focus:border-rose-600 focus:outline-none"
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
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 font-mono text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-rose-600 focus:outline-none"
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
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 font-mono text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-rose-600 focus:outline-none"
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
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs text-slate-900 placeholder-slate-400 transition hover:border-slate-300 focus:border-rose-600 focus:outline-none"
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

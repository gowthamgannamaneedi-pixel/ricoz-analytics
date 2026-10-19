import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Sparkles, Database, Plus, HelpCircle, ChevronDown } from 'lucide-react';
import Button from './ui/Button';
import { Select } from './ui/Select';
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
  onSuccess,
  token,
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
  const [submitting, setSubmitting] = useState(false);

  const parseDatasetCols = (ds) => {
    if (!ds) return [];
    let schema = ds.schema || ds.schema_json?.columns || [];
    if (typeof schema === 'string') {
      try { schema = JSON.parse(schema); } catch (_) { schema = []; }
    }
    if (!Array.isArray(schema)) return [];
    return schema
      .map(col => {
        if (!col) return null;
        if (typeof col === 'string') return { name: col.trim(), type: 'string' };
        const cname = (col.name || col.column_name || col.field || col.key || '').trim();
        const ctype = (col.type || col.data_type || 'string').toLowerCase();
        return cname ? { name: cname, type: ctype } : null;
      })
      .filter(Boolean);
  };

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
          const cols = parseDatasetCols(ds);
          if (cols.length > 0) {
            setDatasetColumns(cols);
          } else {
            const localDs = datasets.find(d => String(d.id) === String(datasetId));
            setDatasetColumns(parseDatasetCols(localDs));
          }
        })
        .catch(() => {
          const localDs = datasets.find(d => String(d.id) === String(datasetId));
          setDatasetColumns(parseDatasetCols(localDs));
        });
    } else {
      setDatasetColumns([]);
    }
  }, [datasetId, datasets]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please provide a metric title.');
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
      target_value: targetValue !== '' && !isNaN(Number(targetValue)) ? Number(targetValue) : null,
      description: description.trim(),
      dataset_id: datasetId ? (isNaN(Number(datasetId)) ? String(datasetId) : Number(datasetId)) : null,
      formatting: {
        warning_threshold: warningThreshold !== '' && !isNaN(Number(warningThreshold)) ? Number(warningThreshold) : null,
        critical_threshold: criticalThreshold !== '' && !isNaN(Number(criticalThreshold)) ? Number(criticalThreshold) : null,
        aggregation_type: aggregationType,
        target_column: targetColumn
      }
    };

    setSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(payload);
      } else {
        const authToken = token || localStorage.getItem('token');
        const url = metricToEdit ? `/api/metrics/${metricToEdit.id}` : '/api/metrics';
        const method = metricToEdit ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || `Failed to ${metricToEdit ? 'update' : 'create'} KPI.`);
        }
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save KPI metric.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs font-sans">
      <div className="flex flex-col w-full max-w-xl max-h-[92vh] rounded-2xl border border-slate-200/90 dark:border-[#334155] bg-white dark:bg-[#111827] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#334155] bg-white dark:bg-[#111827] shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-[#F8FAFC]">
              {metricToEdit ? 'Edit Key Performance Indicator' : 'Define New Metric (KPI)'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
              Configure business metrics with formula expressions, benchmarks, and automated status tracking.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-700 dark:hover:text-[#F8FAFC] transition cursor-pointer"
            title="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 bg-white dark:bg-[#111827]">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-[#2A1422] p-3 text-xs text-rose-700 dark:text-[#FDA4AF]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-[#FB7185]" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-[#F8FAFC] uppercase tracking-wider text-[11px] text-slate-500 dark:text-[#94A3B8]">
              Basic Metric Attributes
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] mb-1" htmlFor="metric-name">
                  Metric Title <span className="text-rose-500">*</span>
                </label>
                <input
                  id="metric-name"
                  type="text"
                  required
                  placeholder="e.g. Q4 Net Revenue"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-300 dark:border-[#334155] bg-white dark:bg-[#0F172A] px-3.5 text-sm font-medium text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-slate-500 transition hover:border-rose-300 dark:hover:border-rose-500/40 hover:bg-rose-50/30 dark:hover:bg-[#1E293B] focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] mb-1" htmlFor="metric-type">
                  Display Format
                </label>
                <Select
                  id="metric-type"
                  value={type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                >
                  {METRIC_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] mb-1" htmlFor="dataset-select">
                  Source Dataset (Optional)
                </label>
                <Select
                  id="dataset-select"
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                  placeholder="Standalone (No Dataset)"
                >
                  <option value="">-- Standalone (No Dataset) --</option>
                  {datasets.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] mb-1" htmlFor="metric-unit">
                  Unit Symbol
                </label>
                <input
                  id="metric-unit"
                  type="text"
                  placeholder="₹, %, units"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-300 dark:border-[#334155] bg-white dark:bg-[#0F172A] px-3.5 text-sm font-medium text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-slate-500 transition hover:border-rose-300 dark:hover:border-rose-500/40 hover:bg-rose-50/30 dark:hover:bg-[#1E293B] focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 focus:outline-none shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Calculation & Formula */}
          <div className="space-y-3.5 pt-3 border-t border-slate-100 dark:border-[#334155]">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-[#F8FAFC] uppercase tracking-wider text-[11px] text-slate-500 dark:text-[#94A3B8]">
              Calculation & Formula
            </h3>

            {/* Formula Helper */}
            {datasetColumns.length > 0 && (
              <div className="p-3 bg-slate-50 dark:bg-[#0F172A] rounded-lg border border-slate-200/80 dark:border-[#334155] space-y-2">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-[#CBD5E1] flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-rose-600 dark:text-[#FB7185]" />
                  <span>Formula Helper</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">· Pick field & aggregation to auto-generate</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="block text-[10px] font-medium text-slate-600 dark:text-[#94A3B8] mb-1">Aggregation</span>
                    <Select
                      value={aggregationType}
                      onChange={(e) => handleColumnOrAggChange(targetColumn, e.target.value)}
                      size="sm"
                    >
                      {AGGREGATIONS.map(a => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <span className="block text-[10px] font-medium text-slate-600 dark:text-[#94A3B8] mb-1">Column Field</span>
                    <Select
                      value={targetColumn}
                      onChange={(e) => handleColumnOrAggChange(e.target.value, aggregationType)}
                      placeholder="Choose Column"
                      size="sm"
                    >
                      <option value="">-- Choose Column --</option>
                      {datasetColumns.map(c => (
                        <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Formula Expression */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] mb-1" htmlFor="metric-formula">
                Formula Expression <span className="text-rose-500">*</span>
              </label>
              <input
                id="metric-formula"
                type="text"
                required
                placeholder="e.g. SUM(sales_amount) or COUNT(order_id)"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] py-1.5 px-3 font-mono text-xs text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-slate-500 transition hover:border-slate-300 dark:hover:border-slate-600 focus:border-rose-600 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                Standard SQL aggregations supported: SUM, AVG, COUNT, MIN, MAX.
              </span>
            </div>
          </div>

          {/* Section 3: Targets & Threshold Boundaries */}
          <div className="space-y-3.5 pt-3 border-t border-slate-100 dark:border-[#334155]">
            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-[#F8FAFC] uppercase tracking-wider text-[11px] text-slate-500 dark:text-[#94A3B8]">
                Target Goals & Thresholds
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                Set milestones and automatic status tracking thresholds.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] mb-1" htmlFor="target-val">
                  Target Goal
                </label>
                <input
                  id="target-val"
                  type="number"
                  placeholder="500000"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] py-1.5 px-3 font-mono text-xs text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-slate-500 transition hover:border-slate-300 dark:hover:border-slate-600 focus:border-rose-600 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">Target to achieve</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1" htmlFor="warn-val">
                  Warning Level
                </label>
                <input
                  id="warn-val"
                  type="number"
                  placeholder="350000"
                  value={warningThreshold}
                  onChange={(e) => setWarningThreshold(e.target.value)}
                  className="w-full rounded-lg border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-[#0F172A] py-1.5 px-3 font-mono text-xs text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-slate-500 transition hover:border-amber-300 focus:border-amber-600 focus:outline-none"
                />
                <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-1 block">Below triggers At Risk</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-rose-700 dark:text-rose-400 mb-1" htmlFor="crit-val">
                  Critical Level
                </label>
                <input
                  id="crit-val"
                  type="number"
                  placeholder="200000"
                  value={criticalThreshold}
                  onChange={(e) => setCriticalThreshold(e.target.value)}
                  className="w-full rounded-lg border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-[#0F172A] py-1.5 px-3 font-mono text-xs text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-slate-500 transition hover:border-rose-300 focus:border-rose-600 focus:outline-none"
                />
                <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-1 block">Below triggers Behind Target</span>
              </div>
            </div>
          </div>

          {/* Section 4: Description */}
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-[#334155]">
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#CBD5E1]" htmlFor="metric-desc">
              Description (Optional)
            </label>
            <textarea
              id="metric-desc"
              rows={2}
              placeholder="e.g. Total revenue generated across all regional sales channels."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] py-1.5 px-3 text-xs text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-slate-500 transition hover:border-slate-300 dark:hover:border-slate-600 focus:border-rose-600 focus:outline-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-[#334155] flex items-center justify-end gap-3 bg-white dark:bg-[#111827]">
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
              disabled={isLoading || submitting}
              loading={isLoading || submitting}
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

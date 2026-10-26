import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  Sliders,
  Calendar,
  Layers,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Play,
  Trash2,
  Clock,
  ShieldCheck,
  Zap,
  Info,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  FileSpreadsheet,
  LineChart as LineChartIcon,
  Activity,
  Download,
  AlertCircle,
  Maximize2,
  Minimize2,
  Target,
  BarChart2,
  Percent,
  Sigma,
  Lightbulb,
  Check,
  X,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot,
  ReferenceLine
} from 'recharts';
import {
  getDatasets,
  getMetrics,
  getForecasts,
  getForecastById,
  generateForecast,
  detectAnomalies,
  deleteForecast
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { RefreshButton } from '../components/ui/RefreshButton';
import { ResetButton } from '../components/ui/ResetButton';
import { Select } from '../components/ui/Select';

const MODEL_LABELS = {
  auto: 'Auto (Best Model)',
  linear_regression: 'Linear Regression (Trend)',
  holt_winters: 'Holt-Winters (Seasonality)',
  arima: 'ARIMA (Auto-Regressive)',
  exponential_smoothing: 'Exponential Smoothing'
};

const MODEL_DESCRIPTIONS = {
  auto: 'Automatically evaluates Linear Regression, Holt-Winters, and ARIMA to select the model with the lowest MAPE.',
  linear_regression: 'Calculates ordinary least-squares trend trajectory for steady growth or decline patterns.',
  holt_winters: 'Triple exponential smoothing capturing baseline level, directional trend, and seasonal periodic cycles.',
  arima: 'Autoregressive integrated moving average modeling stationary lag autocorrelations.',
  exponential_smoothing: 'Weighted average giving exponentially higher priority to recent historical observations.'
};

const SEVERITY_BADGES = {
  critical: 'bg-rose-50 text-rose-700 border-rose-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-rose-50 text-rose-700 border-rose-200',
  low: 'bg-rose-50 text-rose-700 border-rose-200'
};

export default function ForecastsPage() {
  const { user } = useAuth();
  const isViewer = user?.role === 'viewer';
  const canMutate = ['admin', 'manager', 'analyst'].includes(user?.role);
  const canDelete = ['admin', 'manager'].includes(user?.role);

  // Core Data
  const [datasets, setDatasets] = useState([]);
  const [metricsList, setMetricsList] = useState([]);
  const [savedForecasts, setSavedForecasts] = useState([]);
  const [selectedForecastId, setSelectedForecastId] = useState(null);

  // Form Configuration Parameters
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [dateColumn, setDateColumn] = useState('');
  const [horizonPeriods, setHorizonPeriods] = useState(30);
  const [interval, setInterval] = useState('daily');
  const [selectedModel, setSelectedModel] = useState('auto');
  const [confidenceLevel, setConfidenceLevel] = useState(0.95);
  const [detectAnomaliesActive, setDetectAnomaliesActive] = useState(true);
  const [zThreshold, setZThreshold] = useState(2.5);

  // Available Columns from selected dataset
  const [availableColumns, setAvailableColumns] = useState({
    dateCols: [],
    numericCols: []
  });

  // Output / Results
  const [forecastResult, setForecastResult] = useState(null);
  const [activeTab, setActiveTab] = useState('chart'); // 'chart' | 'table' | 'anomalies' | 'history'
  const [isChartExpanded, setIsChartExpanded] = useState(false);
  const [timeRangeFilter, setTimeRangeFilter] = useState('all'); // 'all' | '30' | '60' | '90'

  // Modals & Action States
  const [forecastToDelete, setForecastToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Loading & State flags
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Toast Helper
  const showToast = (message, type = 'success') => {
    setSuccessToast({ message, type });
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Update column options when dataset selection changes
  const populateColumnsForDataset = useCallback((dataset) => {
    if (!dataset) {
      setAvailableColumns({ dateCols: [], numericCols: [] });
      return;
    }
    let schema = dataset.schema || [];
    if (typeof schema === 'string') {
      try { schema = JSON.parse(schema); } catch (_) { schema = []; }
    }

    const dateCols = [];
    const numericCols = [];

    const categoricalKeywords = [
      'channel', 'category', 'type', 'status', 'name', 'rep', 'id', 'method',
      'mode', 'tier', 'segment', 'region', 'country', 'city', 'state', 'customer',
      'product', 'vendor', 'sku', 'code', 'email', 'phone', 'address', 'description',
      'notes', 'comment', 'gender', 'title'
    ];

    schema.forEach(col => {
      const colName = col.name;
      const lower = colName.toLowerCase();
      const colType = (col.type || '').toLowerCase();

      const isDate = colType === 'date' || colType === 'timestamp' || colType === 'datetime' || lower.includes('date') || lower.includes('time') || lower === 'created_at';
      if (isDate) {
        dateCols.push(colName);
        return;
      }

      const isCategorical = categoricalKeywords.some(kw => 
        lower === kw || 
        lower.endsWith(`_${kw}`) || 
        lower.startsWith(`${kw}_`) || 
        lower.includes(`_${kw}_`)
      );

      const isExplicitNumber = ['number', 'integer', 'int', 'numeric', 'float', 'double', 'decimal', 'real', 'bigint', 'smallint'].includes(colType);

      if (isExplicitNumber && !isCategorical) {
        numericCols.push(colName);
      } else if (!isCategorical && (colType === '' || colType === 'any' || colType === 'unknown')) {
        if (['revenue', 'sales_amount', 'amount', 'total', 'profit', 'units_sold', 'unit_price', 'price', 'cost', 'quantity', 'margin'].some(k => lower.includes(k))) {
          numericCols.push(colName);
        }
      }
    });

    setAvailableColumns({ dateCols, numericCols });

    // Set default selections
    if (dateCols.length > 0) setDateColumn(dateCols[0]);
    if (numericCols.length > 0) {
      // Prioritize primary revenue/sales metrics
      const preferred = numericCols.find(c => {
        const l = c.toLowerCase();
        return l.includes('revenue') || l.includes('total') || l.includes('sales_amount') || l === 'sales' || l.includes('amount');
      }) || numericCols[0];
      setTargetColumn(preferred);
    } else {
      setTargetColumn('');
    }
  }, []);

  // Format saved forecast to display
  const formatAndDisplaySavedForecast = useCallback((record) => {
    if (!record) return;

    let preds = record.predictions || [];
    let conf = record.confidence_intervals || {};
    let metrics = record.metrics || {};
    let anomalies = record.anomalies || [];
    let hist = record.historical_series || [];

    if (typeof preds === 'string') try { preds = JSON.parse(preds); } catch (_) {}
    if (typeof conf === 'string') try { conf = JSON.parse(conf); } catch (_) {}
    if (typeof metrics === 'string') try { metrics = JSON.parse(metrics); } catch (_) {}
    if (typeof anomalies === 'string') try { anomalies = JSON.parse(anomalies); } catch (_) {}
    if (typeof hist === 'string') try { hist = JSON.parse(hist); } catch (_) {}

    setForecastResult({
      id: record.id,
      model: record.model_name || record.model || 'auto',
      historical_points: hist.length,
      historical_series: hist,
      predictions: preds,
      confidence_intervals: conf,
      metrics,
      anomalies,
      model_metadata: {
        created_at: record.created_at,
        dataset_name: record.dataset_name,
        target_column: record.target_column,
        date_column: record.date_column
      }
    });

    if (record.dataset_id) {
      setSelectedDatasetId(String(record.dataset_id));
    }
    if (record.target_column) {
      setTargetColumn(record.target_column);
    }
    if (record.date_column) {
      setDateColumn(record.date_column);
    }
    if (record.horizon_periods) {
      setHorizonPeriods(record.horizon_periods);
    }
    if (record.interval) {
      setInterval(record.interval);
    }
    if (record.model_name) {
      setSelectedModel(record.model_name);
    }
  }, []);

  // Load datasets, metrics, and past forecasts on mount
  const loadInitialData = useCallback(async () => {
    try {
      setLoadingInitial(true);
      setError(null);

      const [datasetsRes, metricsRes, forecastsRes] = await Promise.all([
        getDatasets().catch(() => ({ data: [] })),
        getMetrics().catch(() => ({ data: [] })),
        getForecasts().catch(() => ({ data: [] }))
      ]);

      const datasetsData = Array.isArray(datasetsRes?.data) ? datasetsRes.data : [];
      const forecastsData = Array.isArray(forecastsRes?.data) ? forecastsRes.data : [];
      setDatasets(datasetsData);
      setMetricsList(Array.isArray(metricsRes?.data) ? metricsRes.data : []);
      setSavedForecasts(forecastsData);

      // Select first dataset if available
      if (datasetsData.length > 0) {
        const first = datasetsData[0];
        setSelectedDatasetId(String(first.id));
        populateColumnsForDataset(first);
      }

      // If existing forecasts exist, load the latest one
      if (forecastsData.length > 0 && !forecastResult) {
        const latest = forecastsData[0];
        setSelectedForecastId(latest.id);
        formatAndDisplaySavedForecast(latest);
      }
    } catch (err) {
      console.error('Failed to load forecasting metadata:', err);
      setError('Failed to load datasets and forecasting records.');
    } finally {
      setLoadingInitial(false);
    }
  }, [forecastResult, formatAndDisplaySavedForecast, populateColumnsForDataset]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleDatasetChange = (e) => {
    const dsId = e.target.value;
    setSelectedDatasetId(dsId);
    const ds = datasets.find(d => String(d.id) === String(dsId));
    if (ds) {
      populateColumnsForDataset(ds);
    }
  };

  // Reset form to defaults
  const handleResetDefaults = () => {
    setHorizonPeriods(30);
    setInterval('daily');
    setSelectedModel('auto');
    setConfidenceLevel(0.95);
    setDetectAnomaliesActive(true);
    setZThreshold(2.5);
    showToast('Parameters reset to enterprise defaults.');
  };

  // Generate ML Forecast Execution
  const handleGenerateForecast = async () => {
    if (isViewer) {
      setError('Viewers have read-only access. Generating forecasts requires Analyst, Manager, or Admin role.');
      return;
    }

    if (!selectedDatasetId) {
      setError('Please select a dataset to generate forecast.');
      return;
    }

    if (!targetColumn) {
      setError('Please select a numerical metric column to predict.');
      return;
    }

    const categoricalCheckKeywords = ['channel', 'category', 'type', 'status', 'name', 'rep', 'id', 'method', 'mode', 'segment', 'region', 'city', 'country'];
    const targetLower = targetColumn.toLowerCase();
    if (categoricalCheckKeywords.some(kw => targetLower === kw || targetLower.endsWith(`_${kw}`) || targetLower.startsWith(`${kw}_`))) {
      setError(`"${targetColumn}" is a categorical attribute, not a numeric metric. Please select a numerical metric (e.g. revenue, sales_amount, quantity, unit_price) to forecast.`);
      return;
    }

    if (!dateColumn) {
      setError('Please select a time/date column for chronological ordering.');
      return;
    }

    const horizonNum = parseInt(horizonPeriods, 10);
    if (isNaN(horizonNum) || horizonNum <= 0 || horizonNum > 365) {
      setError('Forecast horizon must be a positive integer between 1 and 365.');
      return;
    }

    const rawDatasetId = selectedDatasetId
      ? (!isNaN(Number(selectedDatasetId)) && Number(selectedDatasetId) > 0 ? Number(selectedDatasetId) : String(selectedDatasetId))
      : null;

    if (!rawDatasetId || rawDatasetId === 'undefined') {
      setError('Please select a valid dataset to generate forecast.');
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      const payload = {
        dataset_id: rawDatasetId,
        target_column: targetColumn,
        date_column: dateColumn,
        horizon_periods: horizonNum,
        interval,
        model_name: selectedModel,
        confidence_level: Number(confidenceLevel),
        detect_anomalies: detectAnomaliesActive,
        z_threshold: Number(zThreshold),
        persist: true
      };

      const res = await generateForecast(payload);

      if (res && res.success && res.data) {
        setForecastResult(res.data);
        const modelName = res.data.model ? MODEL_LABELS[res.data.model] || res.data.model.toUpperCase() : 'ML Model';
        showToast(`Forecast successfully generated using ${modelName}!`);

        // Refresh forecast history list
        const updatedList = await getForecasts().catch(() => ({ data: [] }));
        setSavedForecasts(updatedList.data || []);
      } else {
        throw new Error(res?.message || 'Forecast generation returned unsuccessful response.');
      }
    } catch (err) {
      console.error('Forecast generation error:', err);
      setError(err.message || 'Failed to generate forecast. Please verify historical data points.');
    } finally {
      setGenerating(false);
    }
  };

  // Delete saved forecast
  const handleConfirmDelete = async () => {
    if (!forecastToDelete) return;
    if (!canDelete) {
      setError('Only Admins and Managers can delete forecast records.');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteForecast(forecastToDelete.id);
      setSavedForecasts(prev => prev.filter(f => f.id !== forecastToDelete.id));
      if (forecastResult && forecastResult.id === forecastToDelete.id) {
        setForecastResult(null);
      }
      showToast('Forecast record deleted successfully.');
      setForecastToDelete(null);
    } catch (err) {
      console.error('Delete forecast error:', err);
      setError('Failed to delete forecast record.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export Forecast Data to CSV
  const handleExportCSV = () => {
    if (!forecastResult) return;

    const historical = forecastResult.historical_series || [];
    const predictions = forecastResult.predictions || [];
    const anomalies = forecastResult.anomalies || [];
    const anomalyMap = new Map(anomalies.map(a => [a.timestamp || a.date, a]));

    let csvContent = 'Date,Type,Actual_Value,Predicted_Value,Lower_Bound,Upper_Bound,Is_Anomaly,Anomaly_Score\n';

    historical.forEach(h => {
      const anom = anomalyMap.get(h.date);
      csvContent += `${h.date},Historical,${h.value},,,,"${anom ? 'YES' : 'NO'}",${anom ? anom.anomaly_score : ''}\n`;
    });

    predictions.forEach(p => {
      csvContent += `${p.date},Forecast,,${p.predicted},${p.lower_bound},${p.upper_bound},NO,\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Ricoz_Forecast_${targetColumn}_${selectedModel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Forecast data exported to CSV.');
  };

  // Selected dataset entity
  const selectedDataset = datasets.find(d => String(d.id) === String(selectedDatasetId));
  const anomaliesCount = forecastResult?.anomalies ? forecastResult.anomalies.length : 0;

  // Prepare unified time-series chart data
  const chartData = useMemo(() => {
    if (!forecastResult) return [];

    const data = [];
    const historical = forecastResult.historical_series || [];
    const predictions = forecastResult.predictions || [];
    const anomalies = forecastResult.anomalies || [];
    const anomalyDateMap = new Map(anomalies.map(a => [a.timestamp || a.date, a]));

    // 1. Add historical points
    historical.forEach(h => {
      const anomaly = anomalyDateMap.get(h.date);
      data.push({
        date: h.date,
        historical: h.value,
        predicted: null,
        lower_bound: null,
        upper_bound: null,
        isAnomaly: Boolean(anomaly),
        anomalyScore: anomaly?.anomaly_score || null,
        anomalySeverity: anomaly?.severity || null,
        anomalyExpected: anomaly?.expected_value || null,
        type: 'historical'
      });
    });

    // 2. Connect bridge: add the last historical point as starting prediction anchor
    if (historical.length > 0 && predictions.length > 0) {
      const lastHist = historical[historical.length - 1];
      const matchIndex = data.findIndex(d => d.date === lastHist.date);
      if (matchIndex !== -1) {
        data[matchIndex].predicted = lastHist.value;
      }
    }

    // 3. Add predicted points with confidence interval
    predictions.forEach(p => {
      data.push({
        date: p.date,
        historical: null,
        predicted: p.predicted,
        lower_bound: p.lower_bound,
        upper_bound: p.upper_bound,
        isAnomaly: false,
        type: 'forecast'
      });
    });

    // Apply time range filter if selected
    if (timeRangeFilter !== 'all') {
      const days = parseInt(timeRangeFilter, 10);
      if (!isNaN(days) && data.length > days) {
        return data.slice(-days);
      }
    }

    return data;
  }, [forecastResult, timeRangeFilter]);

  // Transition date split between historical and forecast
  const splitDate = useMemo(() => {
    if (!forecastResult?.historical_series?.length) return null;
    const hist = forecastResult.historical_series;
    return hist[hist.length - 1]?.date;
  }, [forecastResult]);

  return (
    <div className="space-y-5 pb-16 font-sans antialiased text-slate-900">
      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER                                                     */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="text-slate-400">RicozAnalytics</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-rose-600 font-semibold">Forecasts</span>
        </nav>

        {/* Page Title & Actions Toolbar */}
        <div className="space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-500/20">
              <TrendingUp className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
                  Forecasts
                </h1>
                {user?.role && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal max-w-2xl leading-relaxed">
                Predict future values using available forecasting models and detect anomalies in your data.
              </p>
            </div>
          </div>

          {/* Action row below description: Generate Forecast on left, Refresh on right */}
          <div className="flex items-center justify-between gap-4 pt-0.5">
            <div>
              <Button
                id="generate-forecast-primary-btn"
                onClick={handleGenerateForecast}
                disabled={generating || isViewer || !selectedDatasetId}
                variant="primary"
                className="h-10 px-4 rounded-xl font-semibold shadow-xs text-xs sm:text-sm"
              >
                {generating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                    <span>Computing Forecast...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-white" />
                    <span>Generate Forecast</span>
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center gap-2.5">
              <RefreshButton
                id="refresh-forecasts-btn"
                onClick={loadInitialData}
                isRefreshing={loadingInitial}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 2. TOAST NOTIFICATIONS & ALERTS                                   */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold bg-slate-900 text-white animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{successToast.message}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-3 p-4 rounded-xl border border-rose-200 bg-rose-50/90 text-xs text-rose-800 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-900">Forecasting Error</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 3. FOUR SUMMARY METRIC CARDS                                      */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6">
        {/* Card 1: Selected Dataset */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 min-h-[136px] flex flex-col justify-center shadow-2xs hover:shadow-xs hover:border-rose-200 dark:hover:border-rose-900/60 transition-all">
          <div className="flex items-start gap-4.5 sm:gap-5 w-full min-w-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF1F3] dark:bg-rose-950/50 text-[#D91542] dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60 shrink-0 shadow-2xs">
              <Database className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Selected Dataset
              </p>
              <h3
                className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg leading-snug truncate block cursor-default"
                title={selectedDataset ? selectedDataset.name : 'Select a Dataset'}
                aria-label={selectedDataset ? `Dataset: ${selectedDataset.name}` : 'No dataset selected'}
              >
                {selectedDataset ? selectedDataset.name : 'Select a Dataset'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate block leading-normal">
                {selectedDataset ? `${(selectedDataset.row_count || 0).toLocaleString()} observations` : 'Time series data'}
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Model */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 min-h-[136px] flex flex-col justify-center shadow-2xs hover:shadow-xs hover:border-rose-200 dark:hover:border-rose-900/60 transition-all">
          <div className="flex items-start gap-4.5 sm:gap-5 w-full min-w-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF1F3] dark:bg-rose-950/50 text-[#D91542] dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60 shrink-0 shadow-2xs">
              <Target className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Model
              </p>
              <h3
                className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg leading-snug truncate block cursor-default"
                title={MODEL_LABELS[selectedModel] || 'Auto (Best Model)'}
              >
                {MODEL_LABELS[selectedModel] || 'Auto (Best Model)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate block leading-normal" title={MODEL_DESCRIPTIONS[selectedModel]}>
                {selectedModel === 'auto' ? 'Automatically selects best ML model' : 'Configured ML algorithm'}
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Forecast Horizon */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 min-h-[136px] flex flex-col justify-center shadow-2xs hover:shadow-xs hover:border-rose-200 dark:hover:border-rose-900/60 transition-all">
          <div className="flex items-start gap-4.5 sm:gap-5 w-full min-w-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF1F3] dark:bg-rose-950/50 text-[#D91542] dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60 shrink-0 shadow-2xs">
              <Calendar className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Forecast Horizon
              </p>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg leading-snug block">
                Next {horizonPeriods} periods
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate block leading-normal">
                {interval.charAt(0).toUpperCase() + interval.slice(1)} intervals
              </p>
            </div>
          </div>
        </div>

        {/* Card 4: Anomalies Detected */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 min-h-[136px] flex flex-col justify-center shadow-2xs hover:shadow-xs hover:border-rose-200 dark:hover:border-rose-900/60 transition-all">
          <div className="flex items-start gap-4.5 sm:gap-5 w-full min-w-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF1F3] dark:bg-rose-950/50 text-[#D91542] dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60 shrink-0 shadow-2xs">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Anomalies Detected
              </p>
              <h3 className={`font-bold text-base sm:text-lg leading-snug block ${anomaliesCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>
                {anomaliesCount} {anomaliesCount === 1 ? 'anomaly' : 'anomalies'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate block leading-normal">
                {anomaliesCount > 0 ? 'Requires operational review' : 'Within normal variance'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 4. MAIN WORKSPACE: LEFT CONFIG (1/3) vs RIGHT RESULTS (2/3)        */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* =============================================================== */}
        {/* LEFT COLUMN: FORECAST CONFIGURATION                             */}
        {/* =============================================================== */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/60">
                <Sliders className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Forecast Configuration
              </h2>
            </div>
            <ResetButton
              id="reset-config-defaults-btn"
              onClick={handleResetDefaults}
              size="sm"
              title="Reset parameters to defaults"
            />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleGenerateForecast(); }} className="space-y-4.5 text-xs">
            {/* 1. Dataset Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Dataset
              </label>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Choose the dataset to forecast
              </p>
              <div className="mt-1">
                <Select
                  id="forecast-dataset-select"
                  value={selectedDatasetId}
                  onChange={handleDatasetChange}
                  icon={Database}
                  placeholder={datasets.length === 0 ? "No datasets available" : "Select a dataset..."}
                >
                  {datasets.map(ds => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* 2. Metric Column Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Metric Column
              </label>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Select the numeric column to predict
              </p>
              <div className="mt-1">
                <Select
                  id="forecast-metric-column-select"
                  value={targetColumn}
                  onChange={(e) => setTargetColumn(e.target.value)}
                  placeholder={availableColumns.numericCols.length === 0 ? "No numeric columns found" : "Select metric column..."}
                >
                  {availableColumns.numericCols.map(col => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* 3. Time Column Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Time Column
              </label>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Select the time column
              </p>
              <div className="mt-1">
                <Select
                  id="forecast-time-column-select"
                  value={dateColumn}
                  onChange={(e) => setDateColumn(e.target.value)}
                  icon={Calendar}
                  placeholder={availableColumns.dateCols.length === 0 ? "No date columns found" : "Select date column..."}
                >
                  {availableColumns.dateCols.map(col => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* 4. Model Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Model
              </label>
              <div className="mt-1">
                <Select
                  id="forecast-model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  icon={Target}
                >
                  <option value="auto">Auto (Best Model)</option>
                  <option value="linear_regression">Linear Regression (Trend)</option>
                  <option value="holt_winters">Holt-Winters (Seasonality)</option>
                  <option value="arima">ARIMA (Auto-Regressive)</option>
                  <option value="exponential_smoothing">Exponential Smoothing</option>
                </Select>
              </div>
            </div>

            {/* 5. Horizon & Interval (Two columns) */}
            <div className="grid grid-cols-2 gap-3.5 pt-1">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Forecast Horizon
                </label>
                <div className="relative mt-1">
                  <input
                    id="forecast-horizon-input"
                    type="number"
                    min="1"
                    max="365"
                    value={horizonPeriods}
                    onChange={(e) => setHorizonPeriods(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full h-10 pl-3.5 pr-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-rose-600 shadow-2xs"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 dark:text-slate-500 font-medium pointer-events-none">
                    periods
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Interval
                </label>
                <div className="mt-1">
                  <Select
                    id="forecast-interval-select"
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </Select>
                </div>
              </div>
            </div>

            {/* 6. Confidence Interval (Segmented buttons) */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-slate-800 dark:text-[#CBD5E1]">
                Confidence Interval
              </label>
              <div className="grid grid-cols-4 gap-1.5 mt-1">
                {[0.80, 0.90, 0.95, 0.99].map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    id={`confidence-btn-${(lvl * 100).toFixed(0)}`}
                    onClick={() => setConfidenceLevel(lvl)}
                    className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      confidenceLevel === lvl
                        ? 'border-2 border-rose-600 dark:border-[#E11D48] bg-rose-50 dark:bg-[#2A1422] text-rose-700 dark:text-[#FB7185] font-bold shadow-2xs'
                        : 'border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] text-slate-600 dark:text-[#CBD5E1] hover:bg-slate-50 dark:hover:bg-[#1E293B] font-medium'
                    }`}
                  >
                    {(lvl * 100).toFixed(0)}%
                  </button>
                ))}
              </div>
            </div>

            {/* 7. Anomaly Detection Toggle & Sensitivity */}
            <div className="pt-2 border-t border-slate-100 dark:border-[#334155] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC]">Anomaly Detection</span>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-[#94A3B8] mt-0.5">
                    Detect unusual values in historical data
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="anomaly-detection-toggle"
                    checked={detectAnomaliesActive}
                    onChange={(e) => setDetectAnomaliesActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-200 dark:bg-[#1E293B] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-[#334155] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600 dark:peer-checked:bg-[#E11D48]"></div>
                </label>
              </div>

              {detectAnomaliesActive && (
                <div className="space-y-1.5 bg-slate-50/70 dark:bg-[#0F172A] p-3 rounded-xl border border-slate-100 dark:border-[#334155]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-[#CBD5E1]">Anomaly Sensitivity</span>
                    <span className="font-mono font-bold text-rose-700 dark:text-[#FB7185] px-2 py-0.5 bg-white dark:bg-[#1E293B] border border-rose-200 dark:border-[#334155] rounded-md">
                      {zThreshold}
                    </span>
                  </div>
                  <input
                    type="range"
                    id="z-score-slider"
                    min="1.5"
                    max="4.0"
                    step="0.1"
                    value={zThreshold}
                    onChange={(e) => setZThreshold(parseFloat(e.target.value))}
                    className="w-full accent-rose-600 dark:accent-[#E11D48] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 dark:text-[#94A3B8] font-medium">
                    <span>Lower sensitivity</span>
                    <span>Higher sensitivity</span>
                  </div>
                </div>
              )}
            </div>

            {/* 8. Generate Forecast Button (Primary) */}
            <Button
              id="generate-forecast-submit-btn"
              type="submit"
              disabled={generating || isViewer || !selectedDatasetId}
              variant="primary"
              className="w-full h-11 rounded-xl font-bold shadow-xs text-xs sm:text-sm mt-2 flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  <span>Computing ML Predictions...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-white" />
                  <span>Generate Forecast</span>
                </>
              )}
            </Button>
          </form>
        </div>

        {/* =============================================================== */}
        {/* RIGHT COLUMN: FORECAST RESULTS & WORKSPACE                      */}
        {/* =============================================================== */}
        <div className="lg:col-span-8 space-y-4">
          {/* Segmented Tabs Bar */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 border-b border-slate-200/80 dark:border-[#334155] pb-2 dark:pb-0 dark:gap-6 sm:dark:gap-8 min-w-max">
            <button
              type="button"
              id="tab-forecast-chart"
              onClick={() => setActiveTab('chart')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none dark:rounded-none dark:border-0 dark:border-b-2 dark:py-3 dark:px-1 dark:bg-transparent ${
                activeTab === 'chart'
                  ? 'bg-rose-50 text-rose-700 shadow-2xs border border-rose-200/80 font-bold dark:border-[#E11D48] dark:text-[#FB7185] dark:shadow-none dark:bg-transparent'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:border-transparent dark:text-[#94A3B8] dark:hover:text-[#CBD5E1] dark:hover:border-slate-600 dark:hover:bg-transparent'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Forecast Chart</span>
            </button>

            <button
              type="button"
              id="tab-data-table"
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none dark:rounded-none dark:border-0 dark:border-b-2 dark:py-3 dark:px-1 dark:bg-transparent ${
                activeTab === 'table'
                  ? 'bg-rose-50 text-rose-700 shadow-2xs border border-rose-200/80 font-bold dark:border-[#E11D48] dark:text-[#FB7185] dark:shadow-none dark:bg-transparent'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:border-transparent dark:text-[#94A3B8] dark:hover:text-[#CBD5E1] dark:hover:border-slate-600 dark:hover:bg-transparent'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Data Table</span>
            </button>

            <button
              type="button"
              id="tab-anomalies"
              onClick={() => setActiveTab('anomalies')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none dark:rounded-none dark:border-0 dark:border-b-2 dark:py-3 dark:px-1 dark:bg-transparent ${
                activeTab === 'anomalies'
                  ? 'bg-rose-50 text-rose-700 shadow-2xs border border-rose-200/80 font-bold dark:border-[#E11D48] dark:text-[#FB7185] dark:shadow-none dark:bg-transparent'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:border-transparent dark:text-[#94A3B8] dark:hover:text-[#CBD5E1] dark:hover:border-slate-600 dark:hover:bg-transparent'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Anomalies</span>
              {anomaliesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-md bg-rose-50 dark:bg-[#2A1422] text-rose-700 dark:text-[#FDA4AF] border border-rose-200 dark:border-rose-900/60 text-[10px] font-mono font-bold">
                  {anomaliesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              id="tab-forecast-history"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none dark:rounded-none dark:border-0 dark:border-b-2 dark:py-3 dark:px-1 dark:bg-transparent ${
                activeTab === 'history'
                  ? 'bg-rose-50 text-rose-700 shadow-2xs border border-rose-200/80 font-bold dark:border-[#E11D48] dark:text-[#FB7185] dark:shadow-none dark:bg-transparent'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:border-transparent dark:text-[#94A3B8] dark:hover:text-[#CBD5E1] dark:hover:border-slate-600 dark:hover:bg-transparent'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Forecast History</span>
              <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-[#1E293B] text-slate-600 dark:text-[#CBD5E1] border border-slate-200 dark:border-[#334155] text-[10px] font-mono font-bold">
                {savedForecasts.length}
              </span>
            </button>
          </div>

          {/* TAB 1: FORECAST CHART */}
          {activeTab === 'chart' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
                {/* Chart Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Forecast vs Actuals
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Historical data, forecast and confidence interval
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Time range selector */}
                    <div className="w-36">
                      <Select
                        size="sm"
                        icon={Calendar}
                        value={timeRangeFilter}
                        onChange={(e) => setTimeRangeFilter(e.target.value)}
                      >
                        <option value="all">All Available</option>
                        <option value="30">Last 30 days</option>
                        <option value="60">Last 60 days</option>
                        <option value="90">Last 90 days</option>
                      </Select>
                    </div>

                    {/* Download CSV button */}
                    <button
                      type="button"
                      id="export-chart-csv-btn"
                      onClick={handleExportCSV}
                      disabled={!forecastResult}
                      className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer shadow-2xs disabled:opacity-40"
                      title="Download Forecast Data (CSV)"
                      aria-label="Download CSV"
                    >
                      <Download className="h-4 w-4" />
                    </button>

                    {/* Expand/Collapse Fullscreen */}
                    <button
                      type="button"
                      onClick={() => setIsChartExpanded(prev => !prev)}
                      className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                      title={isChartExpanded ? 'Collapse View' : 'Expand View'}
                      aria-label="Toggle Expand"
                    >
                      {isChartExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {!forecastResult ? (
                  /* Pristine Empty State */
                  <div className="py-20 text-center space-y-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 mx-auto">
                      <LineChartIcon className="h-7 w-7" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Ready to Generate Forecast
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                      Select your target metric and time column on the left and click <strong>"Generate Forecast"</strong> to run machine learning predictions.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Legend */}
                    <div className="flex flex-wrap items-center justify-end gap-5 text-xs pt-1">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                        <span className="font-semibold text-slate-700">Actual Values</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-purple-600" />
                        <span className="font-semibold text-slate-700">Forecast</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-5 rounded-xs bg-purple-200/80 border border-purple-300" />
                        <span className="font-semibold text-slate-700">Confidence Interval</span>
                      </div>
                    </div>

                    {/* Chart Container */}
                    <div className={`${isChartExpanded ? 'h-[500px]' : 'h-80'} w-full transition-all`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 15, right: 25, left: 10, bottom: 15 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: '#64748B' }}
                            tickLine={false}
                            axisLine={{ stroke: '#CBD5E1' }}
                            minTickGap={20}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: '#64748B' }}
                            tickLine={false}
                            axisLine={{ stroke: '#CBD5E1' }}
                            tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload || !payload.length) return null;
                              const row = payload[0]?.payload;
                              return (
                                <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1.5 min-w-[170px]">
                                  <div className="font-bold text-slate-300 border-b border-slate-700 pb-1">
                                    {label}
                                  </div>
                                  {row.historical !== null && (
                                    <div className="flex justify-between gap-4 text-blue-300">
                                      <span>Actual Value:</span>
                                      <span className="font-mono font-bold">{Number(row.historical).toLocaleString()}</span>
                                    </div>
                                  )}
                                  {row.predicted !== null && (
                                    <div className="flex justify-between gap-4 text-purple-300">
                                      <span>Forecast:</span>
                                      <span className="font-mono font-bold">{Number(row.predicted).toLocaleString()}</span>
                                    </div>
                                  )}
                                  {row.lower_bound !== null && row.upper_bound !== null && (
                                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
                                      <span>Confidence Range:</span>
                                      <span className="font-mono">
                                        [{Number(row.lower_bound).toFixed(0)} - {Number(row.upper_bound).toFixed(0)}]
                                      </span>
                                    </div>
                                  )}
                                  {row.isAnomaly && (
                                    <div className="mt-1 pt-1 border-t border-rose-800 text-rose-400 text-[11px] font-semibold flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" />
                                      <span>Anomaly (Severity: {row.anomalySeverity})</span>
                                    </div>
                                  )}
                                </div>
                              );
                            }}
                          />

                          {/* Historical vs Forecast dividing line */}
                          {splitDate && (
                            <ReferenceLine
                              x={splitDate}
                              stroke="#94A3B8"
                              strokeDasharray="3 3"
                              label={{ value: 'Historical | Forecast', position: 'top', fill: '#64748B', fontSize: 10, fontWeight: 600 }}
                            />
                          )}

                          {/* Confidence Interval Band */}
                          <Area
                            type="monotone"
                            dataKey="upper_bound"
                            stroke="none"
                            fill="#E9D5FF"
                            fillOpacity={0.5}
                            name="Confidence Band"
                          />
                          <Area
                            type="monotone"
                            dataKey="lower_bound"
                            stroke="none"
                            fill="#FFFFFF"
                            fillOpacity={1.0}
                            name="Lower Band"
                          />

                          {/* Historical Actuals Line */}
                          <Line
                            type="monotone"
                            dataKey="historical"
                            stroke="#2563EB"
                            strokeWidth={2.5}
                            dot={{ r: 2.5, fill: '#2563EB' }}
                            activeDot={{ r: 5 }}
                            name="Actual Values"
                          />

                          {/* Forecast Predicted Line */}
                          <Line
                            type="monotone"
                            dataKey="predicted"
                            stroke="#9333EA"
                            strokeWidth={2.5}
                            strokeDasharray="4 4"
                            dot={{ r: 3, fill: '#9333EA' }}
                            activeDot={{ r: 6 }}
                            name="Forecast"
                          />

                          {/* Anomaly Reference Markers */}
                          {chartData.filter(d => d.isAnomaly).map((a, i) => (
                            <ReferenceDot
                              key={i}
                              x={a.date}
                              y={a.historical}
                              r={6}
                              fill="#E11D48"
                              stroke="#FFFFFF"
                              strokeWidth={2}
                            />
                          ))}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>

              {/* 4 Result Metrics KPI Cards in a row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6">
                {/* MAE */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-2xs hover:shadow-xs hover:border-rose-200 dark:hover:border-rose-900/60 transition-all flex items-center gap-4 min-h-[108px]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/60 shrink-0 shadow-2xs">
                    <Sigma className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <span>Mean Error (MAE)</span>
                      <Info className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" title="Average absolute difference between actual and predicted values" />
                    </div>
                    <p className="font-mono text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                      {forecastResult?.metrics?.mae !== undefined ? Number(forecastResult.metrics.mae).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '—'}
                    </p>
                  </div>
                </div>

                {/* RMSE */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-2xs hover:shadow-xs hover:border-rose-200 dark:hover:border-rose-900/60 transition-all flex items-center gap-4 min-h-[108px]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/60 shrink-0 shadow-2xs">
                    <BarChart2 className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <span>Variance (RMSE)</span>
                      <Info className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" title="Standard deviation of prediction errors" />
                    </div>
                    <p className="font-mono text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                      {forecastResult?.metrics?.rmse !== undefined ? Number(forecastResult.metrics.rmse).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '—'}
                    </p>
                  </div>
                </div>

                {/* MAPE */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-2xs hover:shadow-xs hover:border-rose-200 dark:hover:border-rose-900/60 transition-all flex items-center gap-4 min-h-[108px]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/60 shrink-0 shadow-2xs">
                    <Percent className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <span>Error Margin (MAPE)</span>
                      <Info className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" title="Average percentage difference between forecast and actuals" />
                    </div>
                    <p className="font-mono text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 truncate">
                      {forecastResult?.metrics?.mape !== undefined ? `${Number(forecastResult.metrics.mape).toFixed(1)}%` : '—'}
                    </p>
                  </div>
                </div>

                {/* R² Score */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-2xs hover:shadow-xs hover:border-rose-200 dark:hover:border-rose-900/60 transition-all flex items-center gap-4 min-h-[108px]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/60 shrink-0 font-bold font-mono text-base shadow-2xs">
                    R²
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <span>Trend Fit (R²)</span>
                      <Info className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" title="How well the trend model explains historical fluctuations (0 to 1)" />
                    </div>
                    <p className="font-mono text-lg sm:text-xl font-bold text-indigo-600 dark:text-indigo-400 truncate">
                      {forecastResult?.metrics?.r2 !== undefined ? Number(forecastResult.metrics.r2).toFixed(3) : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Model Insights Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-2xs transition-all">
                <div className="flex items-start gap-4 sm:gap-5 min-w-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/60 shrink-0 shadow-2xs mt-0.5">
                    <Lightbulb className="h-6 w-6" />
                  </div>
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                      Model Insights
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {forecastResult ? (
                        <>
                          Selected <strong className="text-slate-900 dark:text-slate-100 font-semibold">{MODEL_LABELS[forecastResult.model] || forecastResult.model}</strong> across {forecastResult.historical_points || 0} observations.
                          {forecastResult.metrics?.mape !== undefined && ` Model achieved ${Number(forecastResult.metrics.mape).toFixed(1)}% MAPE accuracy.`}
                          {anomaliesCount > 0 ? (
                            <> Detected <strong className="text-amber-700 dark:text-amber-400 font-semibold">{anomaliesCount} statistical outliers</strong> in the historical data.</>
                          ) : (
                            <> Historical values remained within normal statistical boundaries.</>
                          )}
                        </>
                      ) : (
                        'Generate a forecast to see insights, model performance and detected anomalies.'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DATA TABLE */}
          {activeTab === 'table' && (
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/90 dark:border-[#334155] overflow-hidden shadow-2xs">
              <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#334155]">
                <h4 className="font-bold text-slate-900 dark:text-[#F8FAFC] text-xs">
                  Forecast Data Points ({chartData.length} records)
                </h4>
                <Button
                  onClick={handleExportCSV}
                  disabled={!forecastResult}
                  variant="secondary"
                  size="sm"
                  className="text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export CSV</span>
                </Button>
              </div>

              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                  <thead className="bg-slate-50/80 dark:bg-[#1E293B] sticky top-0 border-b border-slate-200 dark:border-[#334155] text-slate-500 dark:text-[#CBD5E1] font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">DATE</th>
                      <th className="py-3 px-4">TYPE</th>
                      <th className="py-3 px-4 text-right">ACTUAL VALUE</th>
                      <th className="py-3 px-4 text-right">PREDICTED VALUE</th>
                      <th className="py-3 px-4 text-right">LOWER BOUND</th>
                      <th className="py-3 px-4 text-right">UPPER BOUND</th>
                      <th className="py-3 px-4 text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#334155] font-mono">
                    {chartData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-xs text-slate-500 dark:text-[#94A3B8] font-sans">
                          No forecast data generated yet. Click "Generate Forecast" to populate data rows.
                        </td>
                      </tr>
                    ) : (
                      chartData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-[#1E293B]/50 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-[#F8FAFC]">{row.date}</td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-sans ${
                              row.type === 'historical'
                                ? 'bg-rose-50 dark:bg-[#2A1422] text-rose-700 dark:text-[#FDA4AF] border border-rose-200 dark:border-rose-900/60'
                                : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60'
                            }`}>
                              {row.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-rose-700 dark:text-[#FB7185]">
                            {row.historical !== null ? Number(row.historical).toLocaleString() : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-purple-700 dark:text-purple-400">
                            {row.predicted !== null ? Number(row.predicted).toLocaleString() : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-500 dark:text-[#CBD5E1]">
                            {row.lower_bound !== null ? Number(row.lower_bound).toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-500 dark:text-[#CBD5E1]">
                            {row.upper_bound !== null ? Number(row.upper_bound).toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-center font-sans">
                            {row.isAnomaly ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-[#2A1422] text-rose-700 dark:text-[#FDA4AF] border border-rose-200 dark:border-rose-900/60 text-[10px] font-bold">
                                <AlertTriangle className="h-3 w-3" />
                                Anomaly
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-[#94A3B8] text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: ANOMALIES */}
          {activeTab === 'anomalies' && (
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/90 dark:border-[#334155] p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#334155] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">
                      Detected Time-Series Anomalies
                    </h4>
                    <p className="text-[11px] text-slate-400 dark:text-[#94A3B8]">
                      Outliers identified by Z-Score threshold ({zThreshold}σ)
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-slate-600 dark:text-[#CBD5E1] bg-slate-100 dark:bg-[#1E293B] px-2 py-0.5 rounded-lg border border-slate-200 dark:border-[#334155]">
                  {anomaliesCount} Total
                </span>
              </div>

              {anomaliesCount === 0 ? (
                <div className="py-14 text-center space-y-2.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 mx-auto">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h5 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">No Anomalies Detected</h5>
                  <p className="text-xs text-slate-500 dark:text-[#94A3B8] max-w-sm mx-auto">
                    All historical observations fall within normal {zThreshold}σ standard deviation boundaries.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {forecastResult.anomalies.map((anom, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-200/90 dark:border-[#334155] bg-white dark:bg-[#0F172A] hover:border-amber-200 dark:hover:border-amber-500/50 transition flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-[#F8FAFC]">
                            {anom.timestamp || anom.date}
                          </span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                            SEVERITY_BADGES[anom.severity] || SEVERITY_BADGES.warning
                          }`}>
                            {anom.severity || 'warning'} {anom.direction ? `(${anom.direction})` : ''}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-[#94A3B8]">
                          Actual: <b className="text-slate-900 dark:text-[#F8FAFC] font-mono">{Number(anom.actual_value || anom.value || 0).toLocaleString()}</b>
                          {anom.expected_value !== undefined && (
                            <> | Expected: <span className="font-mono dark:text-[#CBD5E1]">{Number(anom.expected_value).toFixed(1)}</span></>
                          )}
                          {anom.deviation !== undefined && (
                            <> (Deviation: {Number(anom.deviation).toFixed(1)})</>
                          )}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-xs font-bold text-rose-600 dark:text-[#FB7185]">
                          Z = {Number(anom.anomaly_score || anom.z_score || 0).toFixed(2)}σ
                        </span>
                        <p className="text-[10px] text-slate-400 dark:text-[#94A3B8]">Outlier Score</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: FORECAST HISTORY */}
          {activeTab === 'history' && (
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/90 dark:border-[#334155] overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-100 dark:border-[#334155] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 dark:bg-[#2A1422] text-rose-600 dark:text-[#FB7185] border border-rose-100 dark:border-rose-900/40">
                    <Clock className="h-4 w-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-[#F8FAFC] text-xs">
                    Saved Forecast History ({savedForecasts.length})
                  </h4>
                </div>
              </div>

              {savedForecasts.length === 0 ? (
                <div className="py-14 text-center space-y-2">
                  <Clock className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-500 dark:text-[#94A3B8]">No saved forecasts found in history.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#334155]">
                  {savedForecasts.map(f => (
                    <div
                      key={f.id}
                      onClick={() => {
                        setSelectedForecastId(f.id);
                        formatAndDisplaySavedForecast(f);
                        setActiveTab('chart');
                      }}
                      className={`p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-[#1E293B]/50 transition-colors ${
                        selectedForecastId === f.id ? 'bg-rose-50/50 dark:bg-[#2A1422]/60 border-l-4 border-rose-600 dark:border-[#E11D48]' : ''
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-[#F8FAFC]">
                            {f.dataset_name || 'Telemetry Forecast'} — {f.target_column || 'Metric'}
                          </span>
                          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-rose-50 dark:bg-[#2A1422] text-rose-700 dark:text-[#FDA4AF] border border-rose-200 dark:border-rose-900/60">
                            {f.model_name || 'AUTO'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] font-mono">
                          Horizon: {f.horizon_periods} {f.interval} • Created: {new Date(f.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {canDelete && (
                          <button
                            type="button"
                            id={`delete-forecast-${f.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setForecastToDelete(f);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-[#FB7185] transition cursor-pointer"
                            title="Delete forecast"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 5. DELETE FORECAST CONFIRMATION MODAL                             */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {forecastToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-[#111827] shadow-2xl border border-slate-200 dark:border-[#334155] p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 dark:bg-[#2A1422] text-rose-600 dark:text-[#FB7185] shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">Delete Forecast</h3>
                <p className="text-[11px] text-slate-500 dark:text-[#94A3B8]">Remove saved prediction record</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-[#CBD5E1] leading-relaxed">
              Are you sure you want to remove this forecast record for <strong className="text-slate-900 dark:text-[#F8FAFC]">{forecastToDelete.target_column}</strong>? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-[#334155]">
              <button
                type="button"
                id="cancel-delete-forecast-btn"
                onClick={() => setForecastToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-[#334155] text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-50 dark:hover:bg-[#1E293B] transition cursor-pointer"
              >
                Cancel
              </button>
              <Button
                id="confirm-delete-forecast-btn"
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                variant="danger"
                className="h-9 px-4 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                {isDeleting ? 'Deleting...' : 'Delete Forecast'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

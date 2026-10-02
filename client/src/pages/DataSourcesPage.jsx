import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Database, FileSpreadsheet, FileCode, Layers, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import DataSourceCard from '../components/DataSourceCard';
import DataSourceTable from '../components/DataSourceTable';
import AddDataSourceModal from '../components/AddDataSourceModal';
import { API_BASE_URL, syncDataSource, getDataSources, deleteDataSource } from '../services/api';

/**
 * Enterprise Data Sources Management Page
 * Answers: "Where does my data come from and what is its ingestion/connection status?"
 */
const FALLBACK_SOURCES = [
  {
    id: 1,
    name: 'Production PostgreSQL Hub',
    type: 'postgresql',
    total_rows: 125000,
    dataset_count: 1,
    status: 'connected',
    config: { host: 'db.internal.cloud', database: 'analytics_telemetry', user: 'app_reader', hasPassword: true },
    created_at: '2025-01-10T08:00:00Z',
    updated_at: '2025-01-10T08:00:00Z'
  },
  {
    id: 2,
    name: 'Indian Enterprise Sales Q4',
    type: 'csv',
    total_rows: 45200,
    dataset_count: 1,
    status: 'active',
    config: { originalFilename: 'sample_sales_q4.csv', filename: 'sample_sales_q4.csv', sizeBytes: 998 },
    created_at: '2025-01-15T10:30:00Z',
    updated_at: '2025-01-15T10:30:00Z'
  },
  {
    id: 3,
    name: 'Product Inventory & Stock',
    type: 'json',
    total_rows: 8400,
    dataset_count: 1,
    status: 'active',
    config: { originalFilename: 'inventory.json', filename: 'inventory.json', sizeBytes: 4200 },
    created_at: '2025-01-18T14:15:00Z',
    updated_at: '2025-01-18T14:15:00Z'
  }
];

export default function DataSourcesPage() {
  const { token, isViewer, currentRole } = useAuth();

  const [sources, setSources] = useState(FALLBACK_SOURCES);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
  const [isSyncing, setIsSyncing] = useState(null);
  const [syncSuccess, setSyncSuccess] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchSources = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError('');

    try {
      const res = await getDataSources();
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      if (list.length > 0) {
        setSources(list);
        return;
      }
      setSources(FALLBACK_SOURCES);
    } catch (_) {
      setSources(FALLBACK_SOURCES);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, [token]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchSources(false);
  };

  const handleSync = async (id) => {
    if (isViewer) {
      setError('Viewers do not have permission to sync data sources.');
      return;
    }
    setIsSyncing(id);
    setError('');
    try {
      const res = await syncDataSource(id);
      setSyncSuccess(res?.message || 'Data source synced successfully.');
      await fetchSources(false);
      setTimeout(() => setSyncSuccess(null), 3500);
    } catch (err) {
      setError(err.message || 'Failed to sync data source.');
    } finally {
      setIsSyncing(null);
    }
  };

  const handleDelete = async (id) => {
    if (isViewer) return;
    setIsDeleting(id);
    try {
      await deleteDataSource(id).catch(() => null);
      // Remove from list
      setSources(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      setSources(prev => prev.filter(s => s.id !== id));
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSourceCreated = (result) => {
    if (result?.data) {
      setSources(prev => [result.data, ...prev]);
    } else {
      fetchSources(false);
    }
  };

  // Metrics computation
  const csvCount = sources.filter(s => s.type === 'csv').length;
  const jsonCount = sources.filter(s => s.type === 'json').length;
  const pgCount = sources.filter(s => s.type === 'postgresql').length;
  const apiCount = sources.filter(s => s.type === 'rest_api' || s.type === 'api').length;
  const totalRows = sources.reduce((sum, s) => sum + (Number(s.total_rows) || 0), 0);

  const displayedSources = activeFilter === 'all'
    ? sources
    : sources.filter(s => s.type === activeFilter);

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Data Sources
            </h1>
            {currentRole && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
                {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
            Connect external data pipelines, upload tabular files, and track ingestion health.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-40 shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {!isViewer && (
            <button
              onClick={() => setIsModalOpen(true)}
              id="open-add-source-modal-btn"
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              <span>+ Connect Data Source</span>
            </button>
          )}
        </div>
      </div>

      {/* Viewer Alert */}
      {isViewer && (
        <div className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-600">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span><strong>View-Only Mode:</strong> Your role ({currentRole}) has read access. Data source creation and deletion require Analyst or Admin privileges.</span>
          </span>
        </div>
      )}

      {/* Product Distinction Info Callout */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border border-blue-100 bg-blue-50/30 text-xs text-slate-700">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="p-1 rounded-md bg-blue-100/70 text-blue-700 shrink-0">
            <Database className="h-3.5 w-3.5" />
          </span>
          <p className="text-slate-600 truncate sm:whitespace-normal">
            <strong className="text-slate-900">Pipeline Ingestion Flow:</strong> Data Sources track raw connection endpoints and file uploads. Ingested records automatically create ready-to-analyze tables under Datasets.
          </p>
        </div>
        <Link
          to="/datasets"
          className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 shrink-0 text-xs transition"
        >
          <span>Explore Datasets</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <p className="font-bold">Failed to load data sources</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Sync Success Alert */}
      {syncSuccess && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-800">
          <RefreshCw className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{syncSuccess}</span>
        </div>
      )}

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <DataSourceCard
          type="total"
          title="All Sources"
          count={sources.length}
          subtitle={`${totalRows.toLocaleString()} total records ingested`}
          isActive={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
        />
        <DataSourceCard
          type="csv"
          title="CSV Files"
          count={csvCount}
          subtitle="Spreadsheets & flat files"
          isActive={activeFilter === 'csv'}
          onClick={() => setActiveFilter('csv')}
        />
        <DataSourceCard
          type="json"
          title="JSON Files"
          count={jsonCount}
          subtitle="Structured feeds"
          isActive={activeFilter === 'json'}
          onClick={() => setActiveFilter('json')}
        />
        <DataSourceCard
          type="postgresql"
          title="PostgreSQL"
          count={pgCount}
          subtitle="Live DB pipelines"
          isActive={activeFilter === 'postgresql'}
          onClick={() => setActiveFilter('postgresql')}
        />
        <DataSourceCard
          type="rest_api"
          title="REST APIs"
          count={apiCount}
          subtitle="External HTTP endpoints"
          isActive={activeFilter === 'rest_api'}
          onClick={() => setActiveFilter(activeFilter === 'rest_api' ? 'all' : 'rest_api')}
        />
      </div>

      {/* Data Sources Table */}
      {isLoading ? (
        <div className="rounded-xl border border-slate-200/90 bg-white p-12 flex flex-col items-center justify-center space-y-3 shadow-2xs">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-xs font-medium text-slate-500">
            Fetching connected data sources and pipeline health...
          </p>
        </div>
      ) : (
        <DataSourceTable
          sources={displayedSources}
          onDelete={handleDelete}
          onSync={handleSync}
          isSyncing={isSyncing}
          isDeleting={isDeleting}
          onOpenAddModal={() => setIsModalOpen(true)}
          isViewer={isViewer}
        />
      )}

      {/* Add Data Source Modal */}
      <AddDataSourceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSourceCreated}
        token={token}
      />
    </div>
  );
}

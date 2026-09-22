import React, { useState, useEffect } from 'react';
import { Table2, RefreshCw, AlertCircle, Loader2, Plus, Database, FileSpreadsheet, FileCode, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DatasetTable from '../components/DatasetTable';
import DatasetPreviewModal from '../components/DatasetPreviewModal';
import AddDataSourceModal from '../components/AddDataSourceModal';

/**
 * Real Datasets Explorer & Preview Page
 */
export default function DatasetsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [datasets, setDatasets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  
  // Preview Modal State
  const [previewDatasetId, setPreviewDatasetId] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [isDeleting, setIsDeleting] = useState(null);

  const fetchDatasets = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/datasets', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to load datasets.');
      }
      setDatasets(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, [token]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDatasets(false);
  };

  const handleOpenPreview = (id) => {
    setPreviewDatasetId(id);
    setIsPreviewOpen(true);
  };

  const handleDelete = async (id) => {
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/datasets/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete dataset.');
      }
      setDatasets(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      alert(`Delete Error: ${err.message}`);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleUploadSuccess = (data) => {
    fetchDatasets(false);
    if (data?.data?.dataset?.id) {
      // Auto-open preview for the newly ingested dataset
      handleOpenPreview(data.data.dataset.id);
    }
  };

  // Metrics
  const totalRows = datasets.reduce((sum, d) => sum + (Number(d.row_count) || 0), 0);
  const totalColumns = datasets.reduce((sum, d) => sum + (Number(d.column_count) || 0), 0);

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Datasets
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Explore schema, preview records, and manage imported business telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-40 shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            id="open-import-dataset-btn"
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>+ Ingest New Dataset</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-md border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <p className="font-bold">Failed to load datasets</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Datasets
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-slate-900">
              {datasets.length}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Ingested from CSV, JSON, and database sources
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Record Volume
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-slate-900">
              {totalRows.toLocaleString()}
            </span>
            <span className="font-mono text-xs text-emerald-600 font-bold">rows</span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Processed through parsing and schema validation
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Inferred Dimensions
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-slate-900">
              {totalColumns}
            </span>
            <span className="font-mono text-xs text-blue-600 font-bold">fields</span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Numbers, strings, dates, and booleans
          </p>
        </div>
      </div>

      {/* Datasets Table */}
      {isLoading ? (
        <div className="rounded-md border border-slate-200 bg-white p-12 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-xs font-medium text-slate-500">
            Fetching dataset metadata and column schemas...
          </p>
        </div>
      ) : (
        <DatasetTable
          datasets={datasets}
          onPreview={handleOpenPreview}
          onDelete={handleDelete}
          isDeleting={isDeleting}
        />
      )}

      {/* Dataset 50-Row Preview Modal */}
      <DatasetPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => { setIsPreviewOpen(false); setPreviewDatasetId(null); }}
        datasetId={previewDatasetId}
        token={token}
      />

      {/* Ingest Modal */}
      <AddDataSourceModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
        token={token}
      />
    </div>
  );
}

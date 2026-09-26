import React, { useState, useEffect } from 'react';
import { Table2, RefreshCw, AlertCircle, Loader2, Plus, Database, FileSpreadsheet, FileCode, CheckCircle2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DatasetTable from '../components/DatasetTable';
import DatasetPreviewModal from '../components/DatasetPreviewModal';
import AddDataSourceModal from '../components/AddDataSourceModal';

import { getDatasetsApi, deleteDatasetApi } from '../services/api';

/**
 * Real Datasets Explorer & Preview Page
 */
const FALLBACK_DATASETS = [
  {
    id: 1,
    name: 'Indian Enterprise Sales Telemetry (Q4)',
    type: 'csv',
    row_count: 45200,
    column_count: 8,
    created_at: '2025-01-15T10:30:00Z',
    schema: [
      { name: 'order_id', type: 'number' },
      { name: 'region', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'channel', type: 'string' },
      { name: 'sales_amount', type: 'number' },
      { name: 'units_sold', type: 'number' },
      { name: 'profit', type: 'number' },
      { name: 'order_date', type: 'date' }
    ]
  }
];

export default function DatasetsPage() {
  const { token, isViewer, currentRole } = useAuth();
  const navigate = useNavigate();

  const [datasets, setDatasets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  
  // Preview Modal State
  const [previewDatasetId, setPreviewDatasetId] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Delete Confirmation Modal State (Step 20 & 21)
  const [datasetToDelete, setDatasetToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(null);

  const fetchDatasets = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError('');

    try {
      const res = await getDatasetsApi();
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setDatasets(list);
    } catch (err) {
      setError(err.message || 'Failed to load datasets.');
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

  const handleDeleteClick = (datasetOrId) => {
    if (isViewer) {
      setError('Viewers do not have permission to delete datasets.');
      return;
    }
    const target = typeof datasetOrId === 'object' && datasetOrId !== null
      ? datasetOrId
      : datasets.find(d => d.id === datasetOrId);

    if (target) {
      setDatasetToDelete(target);
      setDeleteError(null);
      setShowDeleteConfirm(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!datasetToDelete) return;
    const id = datasetToDelete.id;
    setIsDeleting(id);
    setDeleteError(null);

    try {
      await deleteDatasetApi(id);
      setDeleteSuccess('Dataset deleted successfully.');
      setDatasets(prev => prev.filter(d => d.id !== id));
      setShowDeleteConfirm(false);
      setDatasetToDelete(null);
      await fetchDatasets(false);
      setTimeout(() => setDeleteSuccess(null), 3000);
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete dataset.');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleUploadSuccess = (data) => {
    if (data?.data?.dataset) {
      setDatasets(prev => [data.data.dataset, ...prev]);
      handleOpenPreview(data.data.dataset.id);
    } else {
      fetchDatasets(false);
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
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Datasets
            </h1>
            <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
              isViewer
                ? 'bg-slate-100 text-slate-600 border border-slate-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {currentRole.toUpperCase()} MODE
            </span>
          </div>
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

          {!isViewer && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              id="open-import-dataset-btn"
              className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>+ Ingest New Dataset</span>
            </button>
          )}
        </div>
      </div>

      {isViewer && (
        <div className="flex items-center justify-between gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-600">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span><strong>View-Only Mode:</strong> Your role ({currentRole}) has dataset inspection and 50-row preview access. Ingestion and deletion require Analyst or Admin privileges.</span>
          </span>
        </div>
      )}

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

      {/* Delete Success Alert */}
      {deleteSuccess && (
        <div className="flex items-center gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{deleteSuccess}</span>
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
          onDelete={handleDeleteClick}
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

      {/* Delete Confirmation Modal (Step 20 & 21) */}
      {showDeleteConfirm && datasetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Delete Dataset?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  This will remove the dataset and its associated data.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Dataset Name:</span>
                <span className="font-semibold text-slate-800">{datasetToDelete.name}</span>
              </div>
              {datasetToDelete.row_count !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Records:</span>
                  <span className="font-mono text-slate-700">{Number(datasetToDelete.row_count || 0).toLocaleString()} rows</span>
                </div>
              )}
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDatasetToDelete(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting !== null}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting !== null}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

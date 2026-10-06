import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Database,
  RefreshCw,
  AlertCircle,
  Loader2,
  Plus,
  CheckCircle2,
  Trash2,
  ArrowRight,
  LayoutGrid,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import DatasetTable from '../components/DatasetTable';
import DatasetPreviewModal from '../components/DatasetPreviewModal';
import DatasetDetailsModal from '../components/DatasetDetailsModal';
import AddDataSourceModal from '../components/AddDataSourceModal';
import { Button } from '../components/ui/Button';
import { RefreshButton } from '../components/ui/RefreshButton';

import { getDatasetsApi, deleteDatasetApi, refreshDataset as refreshDatasetApi } from '../services/api';

/**
 * Format total row count cleanly (e.g. 20 -> '20', 1200000 -> '1.2M', 45000 -> '45.0K')
 */
function formatNumberAbbreviated(num) {
  const n = Number(num) || 0;
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (n >= 10000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return n.toLocaleString();
}

/**
 * Enterprise Datasets Explorer & Preview Page
 */
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

  // Details Modal State
  const [detailsDataset, setDetailsDataset] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Delete Confirmation Modal State
  const [datasetToDelete, setDatasetToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
  const [isRefreshingDataset, setIsRefreshingDataset] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(null);
  const [refreshSuccess, setRefreshSuccess] = useState(null);

  const fetchDatasets = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError('');

    try {
      const res = await getDatasetsApi();
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setDatasets(list);
    } catch (err) {
      setError(err?.message || 'Failed to load datasets from backend server.');
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

  const handleOpenDetails = (dataset) => {
    setDetailsDataset(dataset);
    setIsDetailsOpen(true);
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
      setDeleteSuccess(`Dataset "${datasetToDelete.name}" deleted successfully.`);
      setDatasets(prev => prev.filter(d => d.id !== id));
      setShowDeleteConfirm(false);
      setDatasetToDelete(null);
      await fetchDatasets(false);
      setTimeout(() => setDeleteSuccess(null), 3500);
    } catch (err) {
      setDeleteError(err?.message || 'Failed to delete dataset.');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleRefreshDataset = async (datasetId) => {
    if (isViewer) {
      setError('Viewers do not have permission to refresh datasets.');
      return;
    }
    setIsRefreshingDataset(datasetId);
    setError('');
    try {
      const res = await refreshDatasetApi(datasetId);
      setRefreshSuccess(res?.message || 'Dataset schema and row count successfully refreshed.');
      await fetchDatasets(false);
      setTimeout(() => setRefreshSuccess(null), 3500);
    } catch (err) {
      setError(err?.message || 'Failed to refresh dataset.');
    } finally {
      setIsRefreshingDataset(null);
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

  // Real KPI calculations from backend data
  const totalDatasets = datasets.length;
  const totalRows = datasets.reduce((sum, d) => sum + (Number(d.row_count) || 0), 0);
  const readyDatasets = datasets.filter(d => {
    const rowCount = Number(d.row_count);
    return !isNaN(rowCount) && rowCount > 0 && d.data_source_status !== 'error' && d.status !== 'error';
  }).length;
  const readyPercentage = totalDatasets > 0 ? Math.round((readyDatasets / totalDatasets) * 100) : 0;

  const processingDatasets = datasets.filter(d => {
    return (
      d.status === 'processing' ||
      d.status === 'syncing' ||
      d.status === 'pending' ||
      d.data_source_status === 'pending' ||
      d.data_source_status === 'syncing'
    );
  }).length;
  const processingPercentage = totalDatasets > 0 ? Math.round((processingDatasets / totalDatasets) * 100) : 0;

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Breadcrumbs (Matching Reference Header Hierarchy) */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
        <Link to="/dashboard" className="hover:text-slate-800 transition">
          RicozAnalytics
        </Link>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <span className="text-slate-800 font-semibold">Datasets</span>
      </nav>

      {/* 2. Top Header with Icon, Title, Subtitle, and Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-3.5">
          {/* Main Header Blue Cylinder Icon */}
          <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white shadow-xs flex items-center justify-center shrink-0">
            <Database className="h-6 w-6 text-white" />
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Datasets
              </h1>
              {currentRole && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                  {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
              Explore schemas, preview records, and analyze curated data tables for your organization.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            id="refresh-datasets-btn"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {!isViewer && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              id="upload-dataset-header-btn"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Upload Dataset</span>
            </button>
          )}
        </div>
      </div>

      {/* Viewer Mode Notice */}
      {isViewer && (
        <div className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-600">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span><strong>View-Only Mode:</strong> Your role ({currentRole}) has dataset inspection and sample preview access. Uploads, ingestion, and deletion require Analyst or Admin privileges.</span>
          </span>
        </div>
      )}

      {/* Global Alerts */}
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-700">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-bold">Failed to load datasets</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={() => fetchDatasets(true)}
            className="px-3 py-1 bg-white border border-rose-200 rounded-lg font-semibold text-rose-700 hover:bg-rose-100 transition shadow-2xs"
          >
            Retry
          </button>
        </div>
      )}

      {deleteSuccess && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{deleteSuccess}</span>
        </div>
      )}

      {refreshSuccess && (
        <div className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 text-xs text-blue-800 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
          <span>{refreshSuccess}</span>
        </div>
      )}

      {/* 3. Information Banner: Curated & Analysis-Ready Tables */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border border-blue-100 bg-blue-50/30 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-blue-100/70 text-blue-600 border border-blue-200/50 shrink-0">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Curated & Analysis-Ready Tables
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Datasets are structured tables produced from your ingested files and database connectors. Query tables, inspect schema, or launch AI analytics.
            </p>
          </div>
        </div>

        <Link
          to="/data-sources"
          id="manage-data-sources-link"
          className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-700 shrink-0 text-xs transition group"
        >
          <span>Manage Data Sources</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* 4. Summary KPI Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Datasets */}
        <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-2xs ring-1 ring-blue-500/10">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <LayoutGrid className="h-5 w-5" />
            </div>
            {totalDatasets > 0 && (
              <span className="inline-flex items-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </div>
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-500 block">Total Datasets</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1 block">
              {totalDatasets}
            </span>
            <p className="mt-1 text-xs text-slate-400">
              Curated business tables
            </p>
          </div>
        </div>

        {/* Card 2: Ready for Analysis */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-500 block">Ready for Analysis</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1 block">
              {readyDatasets}
            </span>
            <p className="mt-1 text-xs text-slate-400">
              {readyPercentage}% of datasets
            </p>
          </div>
        </div>

        {/* Card 3: Processing / Syncing */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <RefreshCw className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-500 block">Processing / Syncing</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1 block">
              {processingDatasets}
            </span>
            <p className="mt-1 text-xs text-slate-400">
              {processingPercentage}% of datasets
            </p>
          </div>
        </div>

        {/* Card 4: Total Record Volume */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <Database className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-500 block">Total Record Volume</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1 block">
              {formatNumberAbbreviated(totalRows)}
            </span>
            <p className="mt-1 text-xs text-slate-400">
              Across all datasets
            </p>
          </div>
        </div>
      </div>

      {/* 5. Datasets Table Card */}
      {isLoading ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-16 flex flex-col items-center justify-center space-y-3 shadow-2xs">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-xs font-medium text-slate-500">
            Fetching dataset metadata and schemas...
          </p>
        </div>
      ) : (
        <DatasetTable
          datasets={datasets}
          onPreview={handleOpenPreview}
          onViewDetails={handleOpenDetails}
          onDelete={handleDeleteClick}
          onRefreshDataset={handleRefreshDataset}
          isRefreshingDataset={isRefreshingDataset}
          isDeleting={isDeleting}
          onOpenUploadModal={() => setIsUploadModalOpen(true)}
          isViewer={isViewer}
        />
      )}

      {/* 50-Row Preview Modal */}
      <DatasetPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewDatasetId(null);
        }}
        datasetId={previewDatasetId}
        token={token}
      />

      {/* Dataset Details Modal */}
      <DatasetDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setDetailsDataset(null);
        }}
        dataset={detailsDataset}
        onPreview={handleOpenPreview}
      />

      {/* Ingest / Upload Modal */}
      <AddDataSourceModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
        token={token}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && datasetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs font-sans">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200/90 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Delete Dataset?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  This will remove the dataset and clean up all dependent metrics and alerts.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/70 mb-4 text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Dataset Name:</span>
                <span className="font-semibold text-slate-800">{datasetToDelete.name}</span>
              </div>
              {datasetToDelete.row_count !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Record Count:</span>
                  <span className="font-mono text-slate-700 font-semibold">
                    {Number(datasetToDelete.row_count || 0).toLocaleString()} rows
                  </span>
                </div>
              )}
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
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
                id="confirm-delete-dataset-btn"
                className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition flex items-center gap-1.5 shadow-2xs"
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>{isDeleting ? 'Deleting...' : 'Delete Dataset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

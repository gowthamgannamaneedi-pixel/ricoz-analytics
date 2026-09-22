import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Database, FileSpreadsheet, FileCode, Layers, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import DataSourceCard from '../components/DataSourceCard';
import DataSourceTable from '../components/DataSourceTable';
import AddDataSourceModal from '../components/AddDataSourceModal';

/**
 * Real Data Sources Management Page
 */
export default function DataSourcesPage() {
  const { token } = useAuth();

  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchSources = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/data-sources', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to load data sources.');
      }
      setSources(data.data || []);
    } catch (err) {
      setError(err.message);
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

  const handleDelete = async (id) => {
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/data-sources/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete data source.');
      }
      // Remove from list
      setSources(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      alert(`Delete Error: ${err.message}`);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSourceCreated = (result) => {
    fetchSources(false);
  };

  // Metrics computation
  const csvCount = sources.filter(s => s.type === 'csv').length;
  const jsonCount = sources.filter(s => s.type === 'json').length;
  const pgCount = sources.filter(s => s.type === 'postgresql').length;
  const totalRows = sources.reduce((sum, s) => sum + (Number(s.total_rows) || 0), 0);

  const displayedSources = activeFilter === 'all'
    ? sources
    : sources.filter(s => s.type === activeFilter);

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Data Sources
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Connect and manage your business data.
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
            onClick={() => setIsModalOpen(true)}
            id="open-add-source-modal-btn"
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add Data Source</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-md border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <p className="font-bold">Failed to load data sources</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DataSourceCard
          type="total"
          title="All Sources"
          count={sources.length}
          subtitle={`${totalRows.toLocaleString()} total rows ingested`}
          isActive={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
        />
        <DataSourceCard
          type="csv"
          title="CSV Uploads"
          count={csvCount}
          subtitle="Delimited flat tables"
          isActive={activeFilter === 'csv'}
          onClick={() => setActiveFilter('csv')}
        />
        <DataSourceCard
          type="json"
          title="JSON Datasets"
          count={jsonCount}
          subtitle="Structured nested objects"
          isActive={activeFilter === 'json'}
          onClick={() => setActiveFilter('json')}
        />
        <DataSourceCard
          type="postgresql"
          title="PostgreSQL"
          count={pgCount}
          subtitle="Direct database connections"
          isActive={activeFilter === 'postgresql'}
          onClick={() => setActiveFilter('postgresql')}
        />
      </div>

      {/* Data Sources Table */}
      {isLoading ? (
        <div className="rounded-md border border-slate-200 bg-white p-12 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-xs font-medium text-slate-500">
            Fetching connected data sources from database...
          </p>
        </div>
      ) : (
        <DataSourceTable
          sources={displayedSources}
          onDelete={handleDelete}
          isDeleting={isDeleting}
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

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Database,
  FileSpreadsheet,
  FileCode,
  Layers,
  Search,
  Plus,
  Trash2,
  Calendar,
  ExternalLink,
  ArrowUpDown,
  RefreshCw,
  Loader2,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreVertical,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Server,
  Share2,
  Table as TableIcon,
  LayoutGrid,
  Info,
  Check,
  Edit2,
  Eye,
  ArrowRight,
  FolderOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { RefreshButton } from '../components/ui/RefreshButton';
import AddDataSourceModal from '../components/AddDataSourceModal';
import {
  getDataSources,
  getDataSourceById,
  syncDataSource,
  deleteDataSource,
  updateDataSource
} from '../services/api';

/**
 * Enterprise Data Sources Management Workspace
 * Closely follows visual reference composition, hierarchy, and styling
 * Powered exclusively by real API/database data
 */
export default function DataSourcesPage() {
  const { user, token, isViewer, currentRole } = useAuth();
  const navigate = useNavigate();

  // Data State
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Filters & Search
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'csv' | 'json' | 'postgresql' | 'rest_api'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'connected' | 'error'
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [sortKey, setSortKey] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals & Action States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewingSource, setViewingSource] = useState(null);
  const [editingSource, setEditingSource] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', endpoint: '', status: 'active' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [actionMenuId, setActionMenuId] = useState(null);

  // Selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Refs for outside click
  const filterDropdownRef = useRef(null);
  const actionMenuRef = useRef(null);

  // Toast Helper
  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setIsFilterDropdownOpen(false);
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setActionMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch real data sources from backend
  const fetchSources = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError('');

    try {
      const res = await getDataSources();
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setSources(list);
    } catch (err) {
      setError(err.message || 'Failed to fetch data sources from server.');
      setSources([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, [token]);

  // Refresh handler
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchSources(false);
    showToast('Data sources refreshed.');
  };

  // Sync handler
  const handleSync = async (id, name) => {
    if (isViewer) {
      showToast('Viewers do not have permission to sync data sources.', 'error');
      return;
    }
    setSyncingId(id);
    setActionMenuId(null);
    try {
      const res = await syncDataSource(id);
      showToast(res?.message || `Data source "${name || id}" synced successfully.`);
      await fetchSources(false);
    } catch (err) {
      showToast(err.message || `Failed to sync data source "${name || id}".`, 'error');
      await fetchSources(false);
    } finally {
      setSyncingId(null);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (source) => {
    setActionMenuId(null);
    setEditingSource(source);
    setEditForm({
      name: source.name || '',
      endpoint: source.config?.host || source.config?.url || source.config?.endpoint_url || '',
      status: source.status || 'active'
    });
  };

  // Submit Edit
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingSource) return;
    if (!editForm.name.trim()) {
      showToast('Data source name is required.', 'error');
      return;
    }

    setIsSavingEdit(true);
    try {
      const updatedConfig = { ...(editingSource.config || {}) };
      if (editingSource.type === 'postgresql') {
        updatedConfig.host = editForm.endpoint;
      } else if (editingSource.type === 'rest_api' || editingSource.type === 'api') {
        updatedConfig.url = editForm.endpoint;
        updatedConfig.endpoint_url = editForm.endpoint;
      }

      await updateDataSource(editingSource.id, {
        name: editForm.name.trim(),
        config: updatedConfig,
        status: editForm.status
      });

      showToast(`Data source "${editForm.name}" updated successfully.`);
      setEditingSource(null);
      await fetchSources(false);
    } catch (err) {
      showToast(err.message || 'Failed to update data source.', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open View Details Modal / Drawer
  const handleOpenDetails = async (source) => {
    setActionMenuId(null);
    setViewingSource(source);
    try {
      const detailed = await getDataSourceById(source.id);
      if (detailed?.data) {
        setViewingSource(detailed.data);
      }
    } catch (_) {
      // keep current source if detail fetch fails
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!sourceToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDataSource(sourceToDelete.id);
      showToast(`Data source "${sourceToDelete.name}" deleted.`);
      setSources(prev => prev.filter(s => s.id !== sourceToDelete.id));
      setSourceToDelete(null);
      if (viewingSource?.id === sourceToDelete.id) {
        setViewingSource(null);
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete data source.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Add source success
  const handleSourceCreated = (result) => {
    showToast('New data source connected successfully.');
    fetchSources(false);
  };

  // Metrics computation from REAL data
  const totalCount = sources.length;
  const csvCount = sources.filter(s => s.type === 'csv').length;
  const jsonCount = sources.filter(s => s.type === 'json').length;
  const pgCount = sources.filter(s => s.type === 'postgresql').length;
  const apiCount = sources.filter(s => s.type === 'rest_api' || s.type === 'api').length;

  const getPercentage = (count) => {
    if (totalCount === 0) return '0%';
    return `${Math.round((count / totalCount) * 100)}% of sources`;
  };

  // Filtering & Sorting
  const filteredSources = useMemo(() => {
    let result = [...sources];

    // Filter by type tab
    if (activeTab !== 'all') {
      if (activeTab === 'rest_api') {
        result = result.filter(s => s.type === 'rest_api' || s.type === 'api');
      } else {
        result = result.filter(s => s.type === activeTab);
      }
    }

    // Filter by status dropdown
    if (statusFilter !== 'all') {
      if (statusFilter === 'active_ready') {
        result = result.filter(s => s.status === 'active' || s.status === 'connected');
      } else if (statusFilter === 'error_disconnected') {
        result = result.filter(s => s.status === 'error' || s.status === 'disconnected');
      } else {
        result = result.filter(s => s.status === statusFilter);
      }
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.type && s.type.toLowerCase().includes(q)) ||
        (s.status && s.status.toLowerCase().includes(q)) ||
        (s.config?.host && s.config.host.toLowerCase().includes(q)) ||
        (s.config?.database && s.config.database.toLowerCase().includes(q)) ||
        (s.config?.url && s.config.url.toLowerCase().includes(q)) ||
        (s.config?.originalFilename && s.config.originalFilename.toLowerCase().includes(q)) ||
        (s.config?.filename && s.config.filename.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sortKey) {
      result.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];
        if (sortKey === 'name') {
          valA = (a.name || '').toLowerCase();
          valB = (b.name || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (sortKey === 'total_rows' || sortKey === 'dataset_count') {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });
    }

    return result;
  }, [sources, activeTab, statusFilter, searchQuery, sortKey, sortOrder]);

  // Paginated items
  const totalPages = Math.max(1, Math.ceil(filteredSources.length / pageSize));
  const paginatedSources = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSources.slice(start, start + pageSize);
  }, [filteredSources, currentPage, pageSize]);

  // Handle Sort Toggle
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  // Select all checkbox
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(paginatedSources.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Helper icons and styles
  const getTypeIcon = (type) => {
    switch (type) {
      case 'csv':
        return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
      case 'json':
        return <FileCode className="h-5 w-5 text-amber-600" />;
      case 'postgresql':
        return <Database className="h-5 w-5 text-blue-600" />;
      case 'rest_api':
      case 'api':
        return <Share2 className="h-5 w-5 text-purple-600" />;
      default:
        return <Layers className="h-5 w-5 text-slate-600" />;
    }
  };

  const getTypeBg = (type) => {
    switch (type) {
      case 'csv':
        return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
      case 'json':
        return 'bg-amber-50 text-amber-600 border border-amber-100';
      case 'postgresql':
        return 'bg-blue-50 text-blue-600 border border-blue-100';
      case 'rest_api':
      case 'api':
        return 'bg-purple-50 text-purple-600 border border-purple-100';
      default:
        return 'bg-slate-50 text-slate-600 border border-slate-200';
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'csv':
        return (
          <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/90 font-mono">
            CSV File
          </span>
        );
      case 'json':
        return (
          <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/90 font-mono">
            JSON File
          </span>
        );
      case 'postgresql':
        return (
          <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/90 font-mono">
            PostgreSQL
          </span>
        );
      case 'rest_api':
      case 'api':
        return (
          <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/90 font-mono">
            REST API
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono">
            {(type || 'SOURCE').toUpperCase()}
          </span>
        );
    }
  };

  const getStatusBadge = (status, lastSynced) => {
    const isHealthy = status === 'active' || status === 'connected';
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${
              isHealthy ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          />
          <span
            className={`text-xs font-semibold ${
              isHealthy ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {isHealthy ? (status === 'connected' ? 'Connected' : 'Active & Ready') : 'Disconnected'}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 font-normal">
          {lastSynced
            ? `Last synced ${new Date(lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Active pipeline'}
        </p>
      </div>
    );
  };

  const getOriginSummary = (source) => {
    if (source.type === 'postgresql') {
      const host = source.config?.host || 'Cloud Host';
      const database = source.config?.database ? ` · Database: ${source.config.database}` : '';
      return `Host: ${host}${database}`;
    }
    if (source.type === 'rest_api' || source.type === 'api') {
      const url = source.config?.url || source.config?.endpoint_url || 'https://api.endpoint';
      return `Endpoint: ${url}`;
    }
    const filename = source.config?.originalFilename || source.config?.filename || 'Uploaded File';
    return `File: ${filename}`;
  };

  return (
    <div className="space-y-5 pb-16 font-sans antialiased text-slate-900">
      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER                                                     */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        {/* Breadcrumb Navigation matching Wireframe */}
        <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <span className="hover:text-slate-600 transition cursor-pointer" onClick={() => navigate('/dashboard')}>
            Workspace
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="hover:text-slate-600 transition cursor-pointer">
            Production
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-slate-900 font-bold">
            Data Sources & Connectors
          </span>
        </nav>

        {/* Page Title & Controls Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
                Data Sources
              </h1>
              {currentRole && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
                  {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal leading-relaxed">
              Connect and manage your business data.
            </p>
            {!isViewer && (
              <div className="mt-2.5">
                <Button
                  id="connect-source-btn"
                  onClick={() => setIsAddModalOpen(true)}
                  variant="primary"
                  className="h-10 px-4 rounded-xl font-semibold shadow-xs text-xs gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Data Sources</span>
                </Button>
              </div>
            )}
          </div>

          {/* Right Action Controls Toolbar */}
          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
            <Button
              id="refresh-sources-btn"
              onClick={handleRefresh}
              disabled={isRefreshing}
              variant="secondary"
              className="h-10 px-4 rounded-xl font-semibold shadow-2xs text-xs gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-rose-600' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 2. TOAST ALERTS & NOTIFICATIONS                                   */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            toastMessage.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-slate-900 text-white'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="h-4 w-4 text-rose-200" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          )}
          <span>{toastMessage.message}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-700 shadow-2xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <p className="font-bold">Failed to load data sources</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 3. FOUR METRIC SUMMARY CARDS (Wireframe Layout)                    */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: All Sources */}
        <div
          onClick={() => setActiveTab('all')}
          className={`rounded-2xl border p-5 transition-all text-left cursor-pointer shadow-2xs ${
            activeTab === 'all'
              ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-500/25 shadow-xs'
              : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              All Sources
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <Database className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <p className="font-mono text-3xl font-extrabold tracking-tight text-slate-900">
              {totalCount}
            </p>
            <p className="mt-1.5 text-xs text-slate-400 truncate">
              All connected data sources
            </p>
          </div>
        </div>

        {/* Card 2: CSV Uploads */}
        <div
          onClick={() => setActiveTab('csv')}
          className={`rounded-2xl border p-5 transition-all text-left cursor-pointer shadow-2xs ${
            activeTab === 'csv'
              ? 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500/25 shadow-xs'
              : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              CSV Uploads
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <p className="font-mono text-3xl font-extrabold tracking-tight text-slate-900">
              {csvCount}
            </p>
            <p className="mt-1.5 text-xs text-slate-400 truncate">
              Structured file uploads ({getPercentage(csvCount)})
            </p>
          </div>
        </div>

        {/* Card 3: JSON Datasets */}
        <div
          onClick={() => setActiveTab('json')}
          className={`rounded-2xl border p-5 transition-all text-left cursor-pointer shadow-2xs ${
            activeTab === 'json'
              ? 'border-amber-500 bg-amber-50/20 ring-1 ring-amber-500/25 shadow-xs'
              : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              JSON Datasets
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <FileCode className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <p className="font-mono text-3xl font-extrabold tracking-tight text-slate-900">
              {jsonCount}
            </p>
            <p className="mt-1.5 text-xs text-slate-400 truncate">
              Semi-structured payloads ({getPercentage(jsonCount)})
            </p>
          </div>
        </div>

        {/* Card 4: PostgreSQL */}
        <div
          onClick={() => setActiveTab('postgresql')}
          className={`rounded-2xl border p-5 transition-all text-left cursor-pointer shadow-2xs ${
            activeTab === 'postgresql'
              ? 'border-blue-500 bg-blue-50/20 ring-1 ring-blue-500/25 shadow-xs'
              : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              PostgreSQL
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Database className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <p className="font-mono text-3xl font-extrabold tracking-tight text-slate-900">
              {pgCount}
            </p>
            <p className="mt-1.5 text-xs text-slate-400 truncate">
              Direct database connections ({getPercentage(pgCount)})
            </p>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 4. ACTIVE DATA SOURCES SECTION (Wireframe Header & Controls)      */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="pt-2">
        <div className="flex items-center gap-2.5 pb-2">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Active Data Sources
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-bold border border-slate-200">
            {filteredSources.length} {filteredSources.length === 1 ? 'Source' : 'Sources'}
          </span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-3">
        {/* Left Segmented Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          <button
            type="button"
            id="tab-all-sources"
            onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'all'
                ? 'bg-rose-50 text-rose-700 shadow-2xs border border-rose-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>All Sources</span>
            <span className="px-1.5 py-0.2 rounded-md bg-white border border-slate-200 text-[10px] font-mono font-bold text-slate-600">
              {totalCount}
            </span>
          </button>

          <button
            type="button"
            id="tab-csv"
            onClick={() => { setActiveTab('csv'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'csv'
                ? 'bg-emerald-50 text-emerald-700 shadow-2xs border border-emerald-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>CSV</span>
            <span className="px-1.5 py-0.2 rounded-md bg-white border border-slate-200 text-[10px] font-mono font-bold text-slate-600">
              {csvCount}
            </span>
          </button>

          <button
            type="button"
            id="tab-json"
            onClick={() => { setActiveTab('json'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'json'
                ? 'bg-amber-50 text-amber-700 shadow-2xs border border-amber-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileCode className="h-3.5 w-3.5" />
            <span>JSON</span>
            <span className="px-1.5 py-0.2 rounded-md bg-white border border-slate-200 text-[10px] font-mono font-bold text-slate-600">
              {jsonCount}
            </span>
          </button>

          <button
            type="button"
            id="tab-postgresql"
            onClick={() => { setActiveTab('postgresql'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'postgresql'
                ? 'bg-blue-50 text-blue-700 shadow-2xs border border-blue-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>PostgreSQL</span>
            <span className="px-1.5 py-0.2 rounded-md bg-white border border-slate-200 text-[10px] font-mono font-bold text-slate-600">
              {pgCount}
            </span>
          </button>

          <button
            type="button"
            id="tab-rest-api"
            onClick={() => { setActiveTab('rest_api'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'rest_api'
                ? 'bg-purple-50 text-purple-700 shadow-2xs border border-purple-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>REST API</span>
            <span className="px-1.5 py-0.2 rounded-md bg-white border border-slate-200 text-[10px] font-mono font-bold text-slate-600">
              {apiCount}
            </span>
          </button>
        </div>

        {/* Right Search, Filters & View Mode Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              id="search-sources-input"
              type="text"
              placeholder="Search sources, origins, or types..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-rose-600 focus:outline-none transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                id="clear-search-btn"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600"
                title="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Filter Dropdown */}
          <div className="relative" ref={filterDropdownRef}>
            <button
              type="button"
              id="filter-sources-btn"
              onClick={() => setIsFilterDropdownOpen(prev => !prev)}
              className={`flex items-center gap-2 h-9 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer shadow-2xs ${
                statusFilter !== 'all'
                  ? 'border-rose-500 bg-rose-50/50 text-rose-700'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <span>Filter</span>
              {statusFilter !== 'all' && (
                <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
              )}
            </button>

            {isFilterDropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 text-xs animate-in fade-in duration-100">
                <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Filter by Status
                </p>
                <button
                  type="button"
                  onClick={() => { setStatusFilter('all'); setIsFilterDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-xs cursor-pointer ${
                    statusFilter === 'all' ? 'bg-rose-50 font-bold text-rose-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>All Statuses</span>
                  {statusFilter === 'all' && <Check className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => { setStatusFilter('active_ready'); setIsFilterDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-xs cursor-pointer ${
                    statusFilter === 'active_ready' ? 'bg-rose-50 font-bold text-rose-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Active & Ready / Connected</span>
                  </span>
                  {statusFilter === 'active_ready' && <Check className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => { setStatusFilter('error_disconnected'); setIsFilterDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-xs cursor-pointer ${
                    statusFilter === 'error_disconnected' ? 'bg-rose-50 font-bold text-rose-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <span>Disconnected / Error</span>
                  </span>
                  {statusFilter === 'error_disconnected' && <Check className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              id="view-table-btn"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Table View"
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              id="view-grid-btn"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 6. MAIN CONTENT AREA: TABLE OR GRID                                */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-16 flex flex-col items-center justify-center space-y-3 shadow-2xs">
          <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
          <p className="text-xs font-semibold text-slate-600">
            Fetching connected data sources and pipeline health...
          </p>
        </div>
      ) : filteredSources.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-slate-200/90 bg-white p-16 text-center space-y-4 shadow-2xs">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 mx-auto">
            <Database className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {searchQuery ? `No sources matched "${searchQuery}"` : 'No Connected Data Sources'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              {searchQuery
                ? 'Try adjusting your search terms or clearing active filters.'
                : 'Connect external database pipelines or upload CSV and JSON tabular files to begin ingesting telemetry.'}
            </p>
          </div>
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 underline cursor-pointer"
            >
              Clear search filter
            </button>
          ) : (
            !isViewer && (
              <Button
                onClick={() => setIsAddModalOpen(true)}
                variant="primary"
                className="mt-2 text-xs font-semibold"
              >
                <Plus className="h-4 w-4" />
                <span>Connect First Data Source</span>
              </Button>
            )
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={
                        paginatedSources.length > 0 &&
                        paginatedSources.every(s => selectedIds.includes(s.id))
                      }
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  </th>

                  <th
                    onClick={() => handleSort('name')}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>NAME & DETAILS</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>

                  <th className="py-3.5 px-4 whitespace-nowrap">TYPE</th>

                  <th className="py-3.5 px-4 whitespace-nowrap">CONNECTION STATUS</th>

                  <th
                    onClick={() => handleSort('dataset_count')}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>DATASETS PRODUCED</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('total_rows')}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>INGESTED RECORDS</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('created_at')}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>LAST SYNC / IMPORT</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>

                  <th className="py-3.5 px-4 text-right whitespace-nowrap">ACTIONS</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedSources.map((source, idx) => (
                  <tr key={source.id} className={`transition-colors hover:bg-slate-50/60 group ${actionMenuId === source.id ? 'relative z-30' : ''}`}>
                    {/* Checkbox */}
                    <td className="py-3.5 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(source.id)}
                        onChange={() => handleToggleSelect(source.id)}
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </td>

                    {/* Name & Details */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl shrink-0 ${getTypeBg(source.type)}`}>
                          {getTypeIcon(source.type)}
                        </div>
                        <div className="min-w-0 max-w-xs sm:max-w-sm">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(source)}
                            className="font-bold text-slate-900 hover:text-rose-600 transition text-left truncate block text-xs cursor-pointer"
                          >
                            {source.name}
                          </button>
                          <span className="text-[11px] text-slate-500 font-normal block truncate mt-0.5">
                            {getOriginSummary(source)}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {source.created_by_name ? `Uploaded by ${source.created_by_name}` : 'Added by Admin'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Type Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getTypeBadge(source.type)}
                    </td>

                    {/* Connection Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(source.status, source.last_synced_at || source.updated_at)}
                    </td>

                    {/* Datasets Produced */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <Link
                        to="/datasets"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-rose-600 group/link transition"
                        title="View table in Datasets workspace"
                      >
                        <TableIcon className="h-3.5 w-3.5 text-slate-400 group-hover/link:text-rose-500" />
                        <span>{source.dataset_count || 1} {source.dataset_count === 1 ? 'Dataset' : 'Datasets'}</span>
                        <ExternalLink className="h-3 w-3 text-slate-400 group-hover/link:text-rose-500" />
                      </Link>
                    </td>

                    {/* Ingested Records */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-slate-800">
                      {typeof source.total_rows === 'number'
                        ? `${source.total_rows.toLocaleString()} rows`
                        : '0 rows'}
                    </td>

                    {/* Last Sync / Import */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 text-[11px]">
                      {source.created_at ? (
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span>
                            {new Date(source.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">— Never synced</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 relative">
                        {/* Sync Button */}
                        <button
                          type="button"
                          id={`sync-source-${source.id}`}
                          onClick={() => handleSync(source.id, source.name)}
                          disabled={syncingId === source.id || isViewer}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer disabled:opacity-40"
                          title="Synchronize Data Source"
                          aria-label={`Sync ${source.name}`}
                        >
                          {syncingId === source.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </button>

                        {/* View Details Button */}
                        <button
                          type="button"
                          id={`details-source-${source.id}`}
                          onClick={() => handleOpenDetails(source)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          title="View Source Details"
                          aria-label={`Details for ${source.name}`}
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* 3-dots Menu Button */}
                        <button
                          type="button"
                          id={`menu-source-${source.id}`}
                          onClick={() => setActionMenuId(actionMenuId === source.id ? null : source.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          title="More options"
                          aria-label={`More options for ${source.name}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {actionMenuId === source.id && (
                          <div
                            ref={actionMenuRef}
                            className={`absolute right-0 ${
                              idx >= paginatedSources.length - 2 || paginatedSources.length <= 3
                                ? 'bottom-full mb-1.5'
                                : 'top-8 mt-1'
                            } w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 p-1 shadow-xl z-50 text-xs text-left animate-in fade-in duration-100 space-y-0.5`}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenDetails(source)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 font-medium cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5 text-slate-400" />
                              <span>View Details</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSync(source.id, source.name)}
                              disabled={isViewer}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 font-medium cursor-pointer disabled:opacity-40"
                            >
                              <RefreshCw className="h-3.5 w-3.5 text-rose-600" />
                              <span>Sync Pipeline</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate('/datasets')}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 font-medium cursor-pointer"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                              <span>Explore Datasets</span>
                            </button>
                            {!isViewer && (
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(source)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 font-medium cursor-pointer"
                              >
                                <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                                <span>Edit Connection</span>
                              </button>
                            )}
                            {!isViewer && (
                              <div className="border-t border-slate-100 dark:border-slate-800 my-1 pt-1">
                                <button
                                  type="button"
                                  id={`delete-btn-${source.id}`}
                                  onClick={() => {
                                    setActionMenuId(null);
                                    setSourceToDelete(source);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-700 font-semibold cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                                  <span>Delete Source</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 bg-white text-xs text-slate-500 font-medium">
            <div>
              Showing{' '}
              <strong className="text-slate-800">
                {filteredSources.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-800">
                {Math.min(currentPage * pageSize, filteredSources.length)}
              </strong>{' '}
              of <strong className="text-slate-800">{filteredSources.length}</strong> sources
            </div>

            <div className="flex items-center gap-3">
              {/* Page navigation */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  id="prev-page-btn"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                  title="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold border border-rose-200/80 text-xs">
                  {currentPage}
                </span>

                <button
                  type="button"
                  id="next-page-btn"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                  title="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Page size selector */}
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedSources.map((source) => (
            <div
              key={source.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:shadow-xs hover:border-rose-200 transition space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${getTypeBg(source.type)}`}>
                    {getTypeIcon(source.type)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{source.name}</h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {source.type.toUpperCase()}
                    </p>
                  </div>
                </div>
                {getTypeBadge(source.type)}
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                <p className="truncate">
                  <strong className="text-slate-700">Origin:</strong> {getOriginSummary(source)}
                </p>
                <p>
                  <strong className="text-slate-700">Records:</strong>{' '}
                  <span className="font-mono font-bold">
                    {typeof source.total_rows === 'number' ? source.total_rows.toLocaleString() : 0} rows
                  </span>
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                {getStatusBadge(source.status, source.last_synced_at)}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSync(source.id, source.name)}
                    disabled={syncingId === source.id || isViewer}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    title="Sync"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenDetails(source)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    title="Details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 7. VIEW DETAILS MODAL / DRAWER                                    */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {viewingSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${getTypeBg(viewingSource.type)}`}>
                  {getTypeIcon(viewingSource.type)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{viewingSource.name}</h3>
                  <p className="text-xs text-slate-500">Data Source Pipeline Details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingSource(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Source Type</span>
                  <div className="mt-1">{getTypeBadge(viewingSource.type)}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                  <div className="mt-1">
                    {getStatusBadge(viewingSource.status, viewingSource.last_synced_at)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Ingested</span>
                  <p className="mt-1 font-mono font-bold text-slate-900">
                    {typeof viewingSource.total_rows === 'number'
                      ? `${viewingSource.total_rows.toLocaleString()} rows`
                      : '0 rows'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Created At</span>
                  <p className="mt-1 text-slate-600">
                    {new Date(viewingSource.created_at || Date.now()).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Connection Configuration
                </span>
                <div className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
                  <pre>{JSON.stringify(viewingSource.config || {}, null, 2)}</pre>
                </div>
              </div>

              {viewingSource.datasets && viewingSource.datasets.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Produced Datasets ({viewingSource.datasets.length})
                  </span>
                  <div className="space-y-1.5">
                    {viewingSource.datasets.map(ds => (
                      <div
                        key={ds.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white"
                      >
                        <div className="flex items-center gap-2">
                          <TableIcon className="h-4 w-4 text-rose-600" />
                          <span className="font-semibold text-slate-900">{ds.name}</span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">
                          {ds.row_count || 0} rows
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingSource(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Close
              </button>
              <Button
                variant="primary"
                onClick={() => {
                  setViewingSource(null);
                  navigate('/datasets');
                }}
                className="h-9 px-4 text-xs font-semibold"
              >
                <span>Explore Datasets</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 8. EDIT CONNECTION MODAL                                          */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {editingSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <Edit2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Data Source</h3>
                  <p className="text-[11px] text-slate-500">Modify configuration settings</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSource(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Source Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-rose-600 shadow-2xs font-medium"
                  required
                />
              </div>

              {(editingSource.type === 'postgresql' || editingSource.type === 'rest_api' || editingSource.type === 'api') && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {editingSource.type === 'postgresql' ? 'Database Host' : 'Endpoint URL'}
                  </label>
                  <input
                    type="text"
                    value={editForm.endpoint}
                    onChange={(e) => setEditForm({ ...editForm, endpoint: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-rose-600 shadow-2xs font-mono text-[11px]"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-rose-600 shadow-2xs cursor-pointer font-medium"
                >
                  <option value="active">Active & Ready</option>
                  <option value="connected">Connected</option>
                  <option value="disconnected">Disconnected</option>
                  <option value="error">Error</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSource(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={isSavingEdit}
                  variant="primary"
                  className="h-9 px-4 rounded-xl text-xs font-semibold"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 9. DELETE CONFIRMATION MODAL                                      */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {sourceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Data Source</h3>
                <p className="text-[11px] text-slate-500">Cascade removal of pipeline connection</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900">{sourceToDelete.name}</strong>? Any associated datasets and cached files will be disconnected.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                id="cancel-delete-source-btn"
                onClick={() => setSourceToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <Button
                id="confirm-delete-source-btn"
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                variant="danger"
                className="h-9 px-4 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                {isDeleting ? 'Deleting...' : 'Delete Source'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 10. CONNECT DATA SOURCE MODAL                                     */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <AddDataSourceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleSourceCreated}
        token={token}
      />
    </div>
  );
}

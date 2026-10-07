import React, { useState, useEffect } from 'react';
import {
  Network,
  Plus,
  Trash2,
  Edit3,
  Link2,
  ArrowRight,
  Database,
  Table,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Layers,
  Sparkles,
  Play,
  HelpCircle,
  Eye,
  Key,
  ChevronRight,
  ShieldCheck,
  X
} from 'lucide-react';
import {
  getDatasets,
  getDatasetRelationships,
  createDatasetRelationship,
  updateDatasetRelationship,
  deleteDatasetRelationship,
  executeRelationalQuery
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { RefreshButton } from '../components/ui/RefreshButton';

/**
 * Enterprise Relational Data Modeling & Dataset Joins Page (Phase 14)
 */
export default function DataModelingPage() {
  const { user } = useAuth();
  const [datasets, setDatasets] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Modal State for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [modalForm, setModalForm] = useState({
    source_dataset_id: '',
    source_column: '',
    target_dataset_id: '',
    target_column: '',
    relationship_type: 'many_to_one',
    description: ''
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Relational Query Testing State
  const [testQueryModalOpen, setTestQueryModalOpen] = useState(false);
  const [testBaseDatasetId, setTestBaseDatasetId] = useState('');
  const [testJoinedDatasetId, setTestJoinedDatasetId] = useState('');
  const [testDimension, setTestDimension] = useState('');
  const [testMetric, setTestMetric] = useState('');
  const [testAggregation, setTestAggregation] = useState('SUM');
  const [testResults, setTestResults] = useState(null);
  const [testingQuery, setTestingQuery] = useState(false);
  const [testError, setTestError] = useState('');

  // Delete Confirmation
  const [deletingId, setDeletingId] = useState(null);

  const canManage = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'analyst';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dsRes, relRes] = await Promise.all([
        getDatasets().catch(() => ({ data: [] })),
        getDatasetRelationships().catch(() => ({ data: [] }))
      ]);

      const dsList = dsRes.data || dsRes.datasets || [];
      const relList = relRes.data || relRes.relationships || [];

      setDatasets(dsList);
      setRelationships(relList);

      if (dsList.length >= 2 && !testBaseDatasetId) {
        setTestBaseDatasetId(String(dsList[0].id));
        setTestJoinedDatasetId(String(dsList[1].id));
      }
    } catch (err) {
      console.error('Failed to load modeling data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setFormError('');
    setFormSuccess('');
    if (datasets.length >= 2) {
      const srcDs = datasets[0];
      const tgtDs = datasets[1];
      const srcCols = parseSchemaColumns(srcDs);
      const tgtCols = parseSchemaColumns(tgtDs);

      setModalForm({
        source_dataset_id: String(srcDs.id),
        source_column: srcCols[0]?.name || '',
        target_dataset_id: String(tgtDs.id),
        target_column: tgtCols[0]?.name || '',
        relationship_type: 'many_to_one',
        description: ''
      });
    } else {
      setModalForm({
        source_dataset_id: datasets[0]?.id ? String(datasets[0].id) : '',
        source_column: '',
        target_dataset_id: '',
        target_column: '',
        relationship_type: 'many_to_one',
        description: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rel) => {
    setEditingId(rel.id);
    setFormError('');
    setFormSuccess('');
    setModalForm({
      source_dataset_id: String(rel.source_dataset_id),
      source_column: rel.source_column,
      target_dataset_id: String(rel.target_dataset_id),
      target_column: rel.target_column,
      relationship_type: rel.relationship_type || 'many_to_one',
      description: rel.description || ''
    });
    setIsModalOpen(true);
  };

  const handleSaveRelationship = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!modalForm.source_dataset_id || !modalForm.target_dataset_id) {
      setFormError('Please select both a source and target dataset.');
      return;
    }

    if (!modalForm.source_column || !modalForm.target_column) {
      setFormError('Please choose the linking columns for both datasets.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await updateDatasetRelationship(editingId, {
          source_column: modalForm.source_column,
          target_column: modalForm.target_column,
          relationship_type: modalForm.relationship_type,
          description: modalForm.description
        });
        setFormSuccess('Relationship updated successfully!');
      } else {
        await createDatasetRelationship({
          source_dataset_id: Number(modalForm.source_dataset_id),
          source_column: modalForm.source_column,
          target_dataset_id: Number(modalForm.target_dataset_id),
          target_column: modalForm.target_column,
          relationship_type: modalForm.relationship_type,
          description: modalForm.description
        });
        setFormSuccess('Relationship established successfully!');
      }

      await loadData();
      setTimeout(() => {
        setIsModalOpen(false);
      }, 700);
    } catch (err) {
      setFormError(err.message || 'Failed to save dataset relationship.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this dataset relationship?')) return;
    setDeletingId(id);
    try {
      await deleteDatasetRelationship(id);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete relationship');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExecuteTestRelationalQuery = async () => {
    if (!testBaseDatasetId) return;
    setTestingQuery(true);
    setTestError('');
    setTestResults(null);

    try {
      const res = await executeRelationalQuery({
        base_dataset_id: Number(testBaseDatasetId),
        joins: testJoinedDatasetId ? [{ dataset_id: Number(testJoinedDatasetId), type: 'left' }] : [],
        dimensions: testDimension ? [testDimension] : [],
        metrics: testMetric ? [{ column: testMetric, aggregation: testAggregation }] : [],
        limit: 20
      });

      setTestResults(res);
    } catch (err) {
      setTestError(err.message || 'Relational query failed to execute.');
    } finally {
      setTestingQuery(false);
    }
  };

  const parseSchemaColumns = (dataset) => {
    if (!dataset) return [];
    let schema = dataset.schema || [];
    if (typeof schema === 'string') {
      try { schema = JSON.parse(schema); } catch (_) { schema = []; }
    }
    return Array.isArray(schema) ? schema : [];
  };

  const filteredRelationships = relationships.filter((rel) => {
    const srcName = rel.source_dataset_name || '';
    const tgtName = rel.target_dataset_name || '';
    const desc = rel.description || '';
    const matchSearch =
      srcName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tgtName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rel.source_column.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rel.target_column.toLowerCase().includes(searchQuery.toLowerCase()) ||
      desc.toLowerCase().includes(searchQuery.toLowerCase());

    const matchType = filterType === 'all' || rel.relationship_type === filterType;
    return matchSearch && matchType;
  });

  const selectedSourceDs = datasets.find(d => String(d.id) === String(modalForm.source_dataset_id));
  const selectedTargetDs = datasets.find(d => String(d.id) === String(modalForm.target_dataset_id));
  const sourceColumns = parseSchemaColumns(selectedSourceDs);
  const targetColumns = parseSchemaColumns(selectedTargetDs);

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* 1. Breadcrumbs matching Universal Workspace Standard */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
        <span className="hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer" onClick={() => navigate('/dashboard')}>
          Workspace
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
        <span className="hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer">
          Production
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
        <span className="text-slate-900 dark:text-slate-100 font-bold">
          Data Modeling & Relationships
        </span>
      </nav>

      {/* 2. Page Header with Title, Actions, and Status Pill positioned directly opposite */}
      <div className="space-y-4 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 font-sans">
            Data Modeling & Relationships
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-normal leading-relaxed">
            Define relational foreign keys and join boundaries across multi-table datasets.
          </p>
        </div>

        {/* Action Buttons Row with Joins Badge Exactly Opposite */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
          <div className="flex flex-wrap items-center gap-2.5">
            {canManage && (
              <Button
                onClick={handleOpenCreateModal}
                variant="primary"
                id="new-relationship-btn"
                className="h-10 px-4 text-xs font-semibold rounded-xl shadow-xs gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>New Relationship</span>
              </Button>
            )}

            <Button
              onClick={() => {
                setTestQueryModalOpen(true);
                setTestResults(null);
              }}
              variant="secondary"
              id="test-relational-query-btn"
              className="h-10 px-4 text-xs font-semibold rounded-xl shadow-2xs gap-2"
            >
              <Play className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              <span>Test Relational Query</span>
            </Button>
          </div>

          <div className="flex items-center shrink-0">
            <span className="inline-flex items-center h-10 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-bold border border-slate-200/80 dark:border-slate-700 shadow-2xs">
              {relationships.length} Active Joins • {datasets.length} Datasets
            </span>
          </div>
        </div>
      </div>

      {/* 3. Schema Visualizer Blueprint / Architecture Graph */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <h2 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-200">
              Active Relational Architecture Graph
            </h2>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
            {relationships.length} Active Joins • {datasets.length} Datasets
          </span>
        </div>

        {relationships.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50/60 dark:bg-slate-850/60">
            <Layers className="h-10 w-10 text-slate-400 dark:text-slate-500 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No relationships configured</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Link datasets like Orders and Customers on matching keys to unlock cross-table dimensional metrics.
            </p>
            {canManage && (
              <button
                onClick={handleOpenCreateModal}
                className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-semibold text-white transition cursor-pointer shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Connect Datasets</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {relationships.slice(0, 3).map((rel) => (
              <div
                key={rel.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70 p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="uppercase text-rose-700 dark:text-rose-400 font-bold">{rel.relationship_type.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/60 font-semibold">
                      Verified
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 flex-1 border border-slate-200 dark:border-slate-800 min-w-0 shadow-2xs">
                      <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{rel.source_dataset_name || 'Source Dataset'}</div>
                      <div className="text-[11px] text-rose-600 dark:text-rose-400 font-mono truncate mt-0.5">.{rel.source_column}</div>
                    </div>

                    <div className="flex flex-col items-center shrink-0 px-1">
                      <ArrowRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">LEFT JOIN</span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 flex-1 border border-slate-200 dark:border-slate-800 min-w-0 shadow-2xs">
                      <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{rel.target_dataset_name || 'Target Dataset'}</div>
                      <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono truncate mt-0.5">.{rel.target_column}</div>
                    </div>
                  </div>
                </div>

                {rel.description && (
                  <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                    "{rel.description}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search relationships, tables, columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 h-10 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/40 dark:hover:bg-rose-950/20 focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100 dark:focus:ring-rose-900/40 shadow-2xs transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 h-10 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 focus:border-rose-600 focus:outline-none cursor-pointer shadow-2xs transition"
          >
            <option value="all">All Relationship Types</option>
            <option value="many_to_one">Many-to-One (N:1)</option>
            <option value="one_to_many">One-to-Many (1:N)</option>
            <option value="one_to_one">One-to-One (1:1)</option>
            <option value="many_to_many">Many-to-Many (N:N)</option>
          </select>

          <button
            onClick={loadData}
            title="Refresh relationships"
            aria-label="Refresh relationships"
            className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 transition shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-rose-600 dark:text-rose-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Relationship List Table */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
        <div className="rz-table-wrap">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-850/80 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3">Source Dataset & Column</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Target Dataset & Column</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-rose-600 dark:text-rose-400" />
                    Loading dataset relationships...
                  </td>
                </tr>
              ) : filteredRelationships.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <Database className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    No relationships found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRelationships.map((rel) => (
                  <tr key={rel.id} className="hover:bg-rose-50/40 dark:hover:bg-rose-950/20 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Table className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                        {rel.source_dataset_name || 'Dataset'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                        <Key className="h-3 w-3 text-amber-500" />
                        {rel.source_column}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {rel.relationship_type}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Table className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        {rel.target_dataset_name || 'Dataset'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                        <Key className="h-3 w-3 text-amber-500" />
                        {rel.target_column}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 max-w-xs truncate text-slate-500 dark:text-slate-400">
                      {rel.description || '—'}
                    </td>

                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                      <div className="font-medium text-slate-700 dark:text-slate-300">{rel.creator_name || 'Admin'}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(rel.created_at).toLocaleDateString()}</div>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManage && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(rel)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50/80 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              title="Edit"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(rel.id)}
                              disabled={deletingId === rel.id}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Relationship Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200/90 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/80 shadow-2xs">
                  <Link2 className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {editingId ? 'Edit Dataset Relationship' : 'Create Dataset Relationship'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 p-3 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <div>{formError}</div>
              </div>
            )}

            {formSuccess && (
              <div className="mt-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-3 text-xs text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <div>{formSuccess}</div>
              </div>
            )}

            <form onSubmit={handleSaveRelationship} className="mt-4 space-y-4 text-xs">
              {/* Source Dataset & Column */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Source Dataset</label>
                  <select
                    disabled={Boolean(editingId)}
                    value={modalForm.source_dataset_id}
                    onChange={(e) => {
                      const newSrcId = e.target.value;
                      const ds = datasets.find(d => String(d.id) === newSrcId);
                      const cols = parseSchemaColumns(ds);
                      setModalForm({
                        ...modalForm,
                        source_dataset_id: newSrcId,
                        source_column: cols[0]?.name || ''
                      });
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 focus:border-rose-600 focus:outline-none cursor-pointer transition shadow-2xs"
                  >
                    <option value="">Select source...</option>
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Source Column</label>
                  <select
                    value={modalForm.source_column}
                    onChange={(e) => setModalForm({ ...modalForm, source_column: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 focus:border-rose-600 focus:outline-none cursor-pointer transition shadow-2xs"
                  >
                    <option value="">Select column...</option>
                    {sourceColumns.map((col) => (
                      <option key={col.name} value={col.name}>
                        {col.name} ({col.type || 'text'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Dataset & Column */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Dataset</label>
                  <select
                    disabled={Boolean(editingId)}
                    value={modalForm.target_dataset_id}
                    onChange={(e) => {
                      const newTgtId = e.target.value;
                      const ds = datasets.find(d => String(d.id) === newTgtId);
                      const cols = parseSchemaColumns(ds);
                      setModalForm({
                        ...modalForm,
                        target_dataset_id: newTgtId,
                        target_column: cols[0]?.name || ''
                      });
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 focus:border-rose-600 focus:outline-none cursor-pointer transition shadow-2xs"
                  >
                    <option value="">Select target...</option>
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Column</label>
                  <select
                    value={modalForm.target_column}
                    onChange={(e) => setModalForm({ ...modalForm, target_column: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 focus:border-rose-600 focus:outline-none cursor-pointer transition shadow-2xs"
                  >
                    <option value="">Select column...</option>
                    {targetColumns.map((col) => (
                      <option key={col.name} value={col.name}>
                        {col.name} ({col.type || 'text'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Relationship Type */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Relationship Type</label>
                <select
                  value={modalForm.relationship_type}
                  onChange={(e) => setModalForm({ ...modalForm, relationship_type: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 focus:border-rose-600 focus:outline-none cursor-pointer transition shadow-2xs"
                >
                  <option value="many_to_one">Many-to-One (N:1) - (e.g. Orders to Customers)</option>
                  <option value="one_to_many">One-to-Many (1:N) - (e.g. Customers to Orders)</option>
                  <option value="one_to_one">One-to-One (1:1)</option>
                  <option value="many_to_many">Many-to-Many (N:N)</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Description / Rationale</label>
                <input
                  type="text"
                  placeholder="e.g. Links customer master profile to transactional order streams"
                  value={modalForm.description}
                  onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/40 dark:hover:bg-rose-950/20 focus:border-rose-600 focus:outline-none transition shadow-2xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition cursor-pointer shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-semibold text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingId ? 'Save Changes' : 'Establish Relationship'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Relational Query Tester Modal */}
      {testQueryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200/90 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/80 shadow-2xs">
                  <Play className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Relational Analytics Query Sandbox
                </h3>
              </div>
              <button
                onClick={() => setTestQueryModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Test cross-table joins and dimensional aggregations in real-time before assembling dashboards.
            </p>

            {testError && (
              <div className="mt-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 p-3 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <div>{testError}</div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Base Dataset</label>
                <select
                  value={testBaseDatasetId}
                  onChange={(e) => setTestBaseDatasetId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 focus:border-rose-600 focus:outline-none cursor-pointer transition shadow-2xs"
                >
                  <option value="">Select base dataset...</option>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Join With (Related Dataset)</label>
                <select
                  value={testJoinedDatasetId}
                  onChange={(e) => setTestJoinedDatasetId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 focus:border-rose-600 focus:outline-none cursor-pointer transition shadow-2xs"
                >
                  <option value="">Select target dataset...</option>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Dimension (e.g. region, name)</label>
                <input
                  type="text"
                  placeholder="e.g. region or customers.region"
                  value={testDimension}
                  onChange={(e) => setTestDimension(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/40 dark:hover:bg-rose-950/20 focus:border-rose-600 focus:outline-none font-mono transition shadow-2xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Metric & Aggregation</label>
                <div className="flex gap-2">
                  <select
                    value={testAggregation}
                    onChange={(e) => setTestAggregation(e.target.value)}
                    className="w-24 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 focus:border-rose-600 focus:outline-none font-mono cursor-pointer transition shadow-2xs"
                  >
                    <option value="SUM">SUM</option>
                    <option value="AVG">AVG</option>
                    <option value="COUNT">COUNT</option>
                    <option value="MIN">MIN</option>
                    <option value="MAX">MAX</option>
                  </select>
                  <input
                    type="text"
                    placeholder="e.g. revenue or amount"
                    value={testMetric}
                    onChange={(e) => setTestMetric(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/40 dark:hover:bg-rose-950/20 focus:border-rose-600 focus:outline-none font-mono transition shadow-2xs"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleExecuteTestRelationalQuery}
                disabled={testingQuery || !testBaseDatasetId}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 transition cursor-pointer"
              >
                {testingQuery ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                <span>Run Relational Query</span>
              </button>
            </div>

            {/* Test Results Output */}
            {testResults && (
              <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Query Results ({testResults.totalCount || testResults.rows?.length || 0} rows)
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                    Execution: {testResults.executionTimeMs || 12}ms
                  </span>
                </div>

                <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-[11px] shadow-2xs">
                  {testResults.rows && testResults.rows.length > 0 ? (
                    <table className="w-full text-left">
                      <thead className="bg-slate-200/70 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                        <tr>
                          {Object.keys(testResults.rows[0]).map((k) => (
                            <th key={k} className="px-3 py-1.5 font-mono">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {testResults.rows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-100 dark:hover:bg-slate-800/60">
                            {Object.values(r).map((v, vi) => (
                              <td key={vi} className="px-3 py-1.5 font-mono text-slate-800 dark:text-slate-200">
                                {typeof v === 'number' ? v.toLocaleString() : String(v)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-4 text-center text-slate-400">0 rows returned</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

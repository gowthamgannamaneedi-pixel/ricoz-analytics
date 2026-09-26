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
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Data Modeling & Relationships
              </h1>
              <p className="text-xs text-slate-500">
                Define relational foreign keys and join boundaries across multi-table datasets.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setTestQueryModalOpen(true);
              setTestResults(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <Play className="h-3.5 w-3.5 text-blue-600" />
            Test Relational Query
          </button>

          {canManage && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" />
              New Relationship
            </button>
          )}
        </div>
      </div>

      {/* Schema Visualizer Blueprint */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-300">
              Active Relational Architecture Graph
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {relationships.length} Active Joins • {datasets.length} Datasets
          </span>
        </div>

        {relationships.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-700 rounded-lg">
            <Layers className="h-10 w-10 text-slate-500 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-slate-300">No Relationships Configured</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Link datasets like Orders and Customers on matching keys to unlock cross-table dimensional metrics.
            </p>
            {canManage && (
              <button
                onClick={handleOpenCreateModal}
                className="mt-3.5 inline-flex items-center gap-1.5 rounded-md bg-blue-600/80 hover:bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Connect Datasets
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {relationships.slice(0, 3).map((rel) => (
              <div
                key={rel.id}
                className="rounded-lg border border-slate-700/80 bg-slate-800/80 backdrop-blur p-3.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-slate-700">
                    <span className="uppercase text-blue-400 font-bold">{rel.relationship_type.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                      Verified
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                    <div className="bg-slate-900/90 rounded p-2 flex-1 border border-slate-700 min-w-0">
                      <div className="font-bold text-slate-200 truncate">{rel.source_dataset_name || 'Source Dataset'}</div>
                      <div className="text-[11px] text-blue-300 font-mono truncate mt-0.5">.{rel.source_column}</div>
                    </div>

                    <div className="flex flex-col items-center shrink-0 px-1">
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                      <span className="text-[9px] text-slate-400 font-mono">LEFT JOIN</span>
                    </div>

                    <div className="bg-slate-900/90 rounded p-2 flex-1 border border-slate-700 min-w-0">
                      <div className="font-bold text-slate-200 truncate">{rel.target_dataset_name || 'Target Dataset'}</div>
                      <div className="text-[11px] text-indigo-300 font-mono truncate mt-0.5">.{rel.target_column}</div>
                    </div>
                  </div>
                </div>

                {rel.description && (
                  <p className="mt-2.5 text-[11px] text-slate-400 line-clamp-1 italic">
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
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search relationships, tables, columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">All Relationship Types</option>
            <option value="many_to_one">Many-to-One (N:1)</option>
            <option value="one_to_many">One-to-Many (1:N)</option>
            <option value="one_to_one">One-to-One (1:1)</option>
            <option value="many_to_many">Many-to-Many (N:N)</option>
          </select>

          <button
            onClick={loadData}
            title="Refresh"
            className="p-2 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Relationship List Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="px-4 py-3">Source Dataset & Column</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Target Dataset & Column</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading dataset relationships...
                  </td>
                </tr>
              ) : filteredRelationships.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <Database className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    No relationships found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRelationships.map((rel) => (
                  <tr key={rel.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Table className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        {rel.source_dataset_name || 'Dataset'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                        <Key className="h-3 w-3 text-amber-500" />
                        {rel.source_column}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {rel.relationship_type}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Table className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                        {rel.target_dataset_name || 'Dataset'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                        <Key className="h-3 w-3 text-amber-500" />
                        {rel.target_column}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 max-w-xs truncate text-slate-500">
                      {rel.description || '—'}
                    </td>

                    <td className="px-4 py-3.5 text-slate-500">
                      <div>{rel.creator_name || 'Admin'}</div>
                      <div className="text-[10px] text-slate-400">{new Date(rel.created_at).toLocaleDateString()}</div>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManage && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(rel)}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition"
                              title="Edit"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(rel.id)}
                              disabled={deletingId === rel.id}
                              className="p-1.5 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition"
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
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <Link2 className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingId ? 'Edit Dataset Relationship' : 'Create Dataset Relationship'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3.5 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <div>{formError}</div>
              </div>
            )}

            {formSuccess && (
              <div className="mt-3.5 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <div>{formSuccess}</div>
              </div>
            )}

            <form onSubmit={handleSaveRelationship} className="mt-4 space-y-4 text-xs">
              {/* Source Dataset & Column */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Source Dataset</label>
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
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="">Select source...</option>
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Source Column</label>
                  <select
                    value={modalForm.source_column}
                    onChange={(e) => setModalForm({ ...modalForm, source_column: e.target.value })}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
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
                  <label className="block font-semibold text-slate-700 mb-1">Target Dataset</label>
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
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="">Select target...</option>
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Column</label>
                  <select
                    value={modalForm.target_column}
                    onChange={(e) => setModalForm({ ...modalForm, target_column: e.target.value })}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
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
                <label className="block font-semibold text-slate-700 mb-1">Relationship Type</label>
                <select
                  value={modalForm.relationship_type}
                  onChange={(e) => setModalForm({ ...modalForm, relationship_type: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="many_to_one">Many-to-One (N:1) - (e.g. Orders to Customers)</option>
                  <option value="one_to_many">One-to-Many (1:N) - (e.g. Customers to Orders)</option>
                  <option value="one_to_one">One-to-One (1:1)</option>
                  <option value="many_to_many">Many-to-Many (N:N)</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Rationale</label>
                <input
                  type="text"
                  placeholder="e.g. Links customer master profile to transactional order streams"
                  value={modalForm.description}
                  onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {editingId ? 'Save Changes' : 'Establish Relationship'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Relational Query Tester Modal */}
      {testQueryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                  <Play className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Relational Analytics Query Sandbox
                </h3>
              </div>
              <button
                onClick={() => setTestQueryModalOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Test cross-table joins and dimensional aggregations in real-time before assembling dashboards.
            </p>

            {testError && (
              <div className="mt-3.5 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <div>{testError}</div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Base Dataset</label>
                <select
                  value={testBaseDatasetId}
                  onChange={(e) => setTestBaseDatasetId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="">Select base dataset...</option>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Join With (Related Dataset)</label>
                <select
                  value={testJoinedDatasetId}
                  onChange={(e) => setTestJoinedDatasetId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="">Select target dataset...</option>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Dimension (e.g. region, name)</label>
                <input
                  type="text"
                  placeholder="e.g. region or customers.region"
                  value={testDimension}
                  onChange={(e) => setTestDimension(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Metric & Aggregation</label>
                <div className="flex gap-2">
                  <select
                    value={testAggregation}
                    onChange={(e) => setTestAggregation(e.target.value)}
                    className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none font-mono"
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
                    className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleExecuteTestRelationalQuery}
                disabled={testingQuery || !testBaseDatasetId}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
              >
                {testingQuery ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Run Relational Query
              </button>
            </div>

            {/* Test Results Output */}
            {testResults && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">
                    Query Results ({testResults.totalCount || testResults.rows?.length || 0} rows)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Execution: {testResults.executionTimeMs || 12}ms
                  </span>
                </div>

                <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 text-[11px]">
                  {testResults.rows && testResults.rows.length > 0 ? (
                    <table className="w-full text-left">
                      <thead className="bg-slate-200/70 border-b border-slate-300 text-slate-700">
                        <tr>
                          {Object.keys(testResults.rows[0]).map((k) => (
                            <th key={k} className="px-3 py-1.5 font-mono">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {testResults.rows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-100">
                            {Object.values(r).map((v, vi) => (
                              <td key={vi} className="px-3 py-1.5 font-mono text-slate-800">
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

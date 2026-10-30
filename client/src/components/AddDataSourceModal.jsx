import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FileSpreadsheet, FileCode, Database, CheckCircle2, AlertCircle, Loader2, ArrowRight, Server, Key, ShieldCheck, RefreshCw } from 'lucide-react';
import FileUpload from './FileUpload';
import UploadProgress from './UploadProgress';
import { API_BASE_URL, testApiDataSource, testMongoDataSource, createDataSource, uploadDataSourceFile, MAX_UPLOAD_SIZE_MB, getActiveOrganizationId } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Select } from './ui/Select';

/**
 * Enterprise Add Data Source Modal
 * Supports CSV/JSON file ingestion, PostgreSQL databases, MongoDB, and REST API connectors
 */
export default function AddDataSourceModal({ isOpen, onClose, onSuccess, token: propToken }) {
  const auth = useAuth();
  const user = auth?.user || null;
  const isAuthLoading = Boolean(auth?.isLoading);
  const activeOrgId = auth?.activeOrganizationId || user?.organization_id || getActiveOrganizationId();
  const isOrgReady = Boolean(!isAuthLoading && activeOrgId);
  const token = propToken || auth?.token;

  const [activeTab, setActiveTab] = useState('csv'); // 'csv' | 'json' | 'postgresql' | 'mongodb' | 'rest_api'

  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [sourceName, setSourceName] = useState('');
  const [description, setDescription] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('uploading');
  const [stageMessage, setStageMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ name: '', file: '' });

  // PostgreSQL Connection State
  const [pgForm, setPgForm] = useState({
    name: '',
    host: '',
    port: '5432',
    database: '',
    user: '',
    password: '',
    ssl: false
  });
  const [isTestingPg, setIsTestingPg] = useState(false);
  const [pgTestResult, setPgTestResult] = useState(null);

  // MongoDB Connection State
  const [mongoForm, setMongoForm] = useState({
    name: '',
    mode: 'uri', // 'uri' | 'fields'
    uri: '',
    host: '',
    port: '27017',
    database: '',
    user: '',
    password: '',
    authSource: 'admin',
    ssl: true,
    collection: ''
  });
  const [isTestingMongo, setIsTestingMongo] = useState(false);
  const [mongoTestResult, setMongoTestResult] = useState(null);
  const [mongoCollections, setMongoCollections] = useState([]);

  // REST API Connector State
  const [apiForm, setApiForm] = useState({
    name: '',
    url: '',
    method: 'GET',
    authType: 'none', // 'none' | 'bearer' | 'api_key' | 'basic'
    token: '',
    apiKey: '',
    apiKeyHeader: 'X-API-Key',
    username: '',
    password: '',
    dataKey: '',
    headers: ''
  });
  // Lock body scroll and handle Escape key while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e) => {
      if (e.key === 'Escape' && !isProcessing) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = orig;
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, isProcessing]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setError('');
    setFieldErrors(prev => ({ ...prev, file: '' }));
    if (file && !sourceName) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setSourceName(nameWithoutExt);
      setFieldErrors(prev => ({ ...prev, name: '' }));
    }
  };

  const handlePgChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPgForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setPgTestResult(null);
    setError('');
  };

  const handleMongoChange = (e) => {
    const { name, value, type, checked } = e.target;
    setMongoForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setMongoTestResult(null);
    setError('');
  };

  const handleApiChange = (e) => {
    const { name, value } = e.target;
    setApiForm(prev => ({ ...prev, [name]: value }));
    setApiTestResult(null);
    setError('');
  };

  // Test PostgreSQL Connection
  const handleTestPostgres = async () => {
    if (!pgForm.host || !pgForm.database || !pgForm.user) {
      setError('Please provide Host, Database name, and Username to test connection.');
      return;
    }

    setIsTestingPg(true);
    setPgTestResult(null);
    setError('');

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      if (activeOrgId) {
        headers['X-Organization-Id'] = activeOrgId;
      }
      const res = await fetch(`${API_BASE_URL}/data-sources/test-connection`, {
        method: 'POST',
        headers,
        body: JSON.stringify(pgForm)
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setPgTestResult(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || `PostgreSQL connection test failed (HTTP ${res.status}).`);
      }
    } catch (err) {
      setError(err.message || 'PostgreSQL connection test failed.');
    } finally {
      setIsTestingPg(false);
    }
  };

  // Test MongoDB Connection
  const handleTestMongo = async () => {
    const config = mongoForm.mode === 'uri'
      ? { uri: mongoForm.uri.trim() }
      : {
          host: mongoForm.host.trim(),
          port: mongoForm.port,
          database: mongoForm.database.trim(),
          user: mongoForm.user.trim(),
          password: mongoForm.password,
          authSource: mongoForm.authSource.trim(),
          ssl: mongoForm.ssl
        };

    if (mongoForm.mode === 'uri' && !mongoForm.uri.trim()) {
      setError('Please provide a MongoDB connection URI to test.');
      return;
    }
    if (mongoForm.mode === 'fields' && (!mongoForm.host.trim() || !mongoForm.database.trim())) {
      setError('Host and Database name are required to test MongoDB connection.');
      return;
    }

    setIsTestingMongo(true);
    setMongoTestResult(null);
    setError('');

    try {
      const res = await testMongoDataSource(config);
      if (res && res.success) {
        setMongoTestResult(res);
        setMongoCollections(res.collections || []);
        if (res.collections && res.collections.length > 0 && !mongoForm.collection) {
          setMongoForm(prev => ({ ...prev, collection: res.collections[0] }));
        }
      } else {
        setError(res?.message || 'MongoDB connection test failed.');
      }
    } catch (err) {
      setError(err.message || 'MongoDB connection test failed.');
    } finally {
      setIsTestingMongo(false);
    }
  };

  // Test REST API Endpoint
  const handleTestApi = async () => {
    if (!apiForm.url || (!apiForm.url.startsWith('http://') && !apiForm.url.startsWith('https://'))) {
      setError('Please provide a valid HTTP/HTTPS endpoint URL to test.');
      return;
    }
    setIsTestingApi(true);
    setApiTestResult(null);
    setError('');

    try {
      let parsedHeaders = {};
      if (apiForm.headers.trim()) {
        try {
          parsedHeaders = JSON.parse(apiForm.headers);
        } catch (_) {
          setError('Custom headers must be in valid JSON format (e.g. {"Accept": "application/json"})');
          setIsTestingApi(false);
          return;
        }
      }

      const res = await testApiDataSource({
        url: apiForm.url.trim(),
        method: apiForm.method,
        authType: apiForm.authType,
        token: apiForm.token.trim() || undefined,
        apiKey: apiForm.apiKey.trim() || undefined,
        apiKeyHeader: apiForm.apiKeyHeader.trim() || undefined,
        username: apiForm.username.trim() || undefined,
        password: apiForm.password || undefined,
        headers: parsedHeaders,
        dataKey: apiForm.dataKey.trim() || undefined
      });

      if (res && res.success) {
        setApiTestResult(res);
      } else {
        setError(res?.message || 'Failed to connect to API endpoint.');
      }
    } catch (err) {
      setError(err.message || 'API connection test failed.');
    } finally {
      setIsTestingApi(false);
    }
  };

  // Submit PostgreSQL Source
  const handlePostgresSubmit = async (e) => {
    e.preventDefault();
    if (!activeOrgId) {
      setError('Cannot create PostgreSQL data source: No tenant organization associated with current session.');
      return;
    }
    if (!pgForm.name.trim()) {
      setError('Please provide a Data Source Name.');
      return;
    }
    if (!pgForm.host || !pgForm.database || !pgForm.user) {
      setError('Host, Database name, and Username are required.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const res = await createDataSource({
        name: pgForm.name.trim(),
        type: 'postgresql',
        config: pgForm,
        organization_id: activeOrgId
      });

      if (res && res.success) {
        onSuccess(res.data);
        handleClose();
      } else {
        setError(res?.message || 'Failed to create PostgreSQL data source.');
      }
    } catch (err) {
      setError(err.message || 'Failed to create PostgreSQL data source.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit MongoDB Source
  const handleMongoSubmit = async (e) => {
    e.preventDefault();
    if (!activeOrgId) {
      setError('Cannot create MongoDB data source: No tenant organization associated with current session.');
      return;
    }
    if (!mongoForm.name.trim()) {
      setError('Please provide a Data Source Name.');
      return;
    }
    if (mongoForm.mode === 'uri' && !mongoForm.uri.trim()) {
      setError('Connection URI is required.');
      return;
    }
    if (mongoForm.mode === 'fields' && (!mongoForm.host.trim() || !mongoForm.database.trim())) {
      setError('Host and Database name are required.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const config = mongoForm.mode === 'uri'
        ? { uri: mongoForm.uri.trim(), collection: mongoForm.collection.trim() || undefined }
        : {
            host: mongoForm.host.trim(),
            port: mongoForm.port,
            database: mongoForm.database.trim(),
            user: mongoForm.user.trim(),
            password: mongoForm.password,
            authSource: mongoForm.authSource.trim(),
            ssl: mongoForm.ssl,
            collection: mongoForm.collection.trim() || undefined
          };

      const res = await createDataSource({
        name: mongoForm.name.trim(),
        type: 'mongodb',
        config,
        organization_id: activeOrgId
      });

      if (res && res.success) {
        onSuccess(res.data);
        handleClose();
      } else {
        setError(res?.message || 'Failed to create MongoDB data source.');
      }
    } catch (err) {
      setError(err.message || 'Failed to create MongoDB data source.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit REST API Source
  const handleApiSubmit = async (e) => {
    e.preventDefault();
    if (!apiForm.name.trim() || !apiForm.url.trim()) {
      setError('Data Source Name and Endpoint URL are required.');
      return;
    }
    setIsProcessing(true);
    setError('');
    try {
      let parsedHeaders = {};
      if (apiForm.headers.trim()) {
        try {
          parsedHeaders = JSON.parse(apiForm.headers);
        } catch (_) {
          setError('Headers must be valid JSON format.');
          setIsProcessing(false);
          return;
        }
      }
      const res = await createDataSource({
        name: apiForm.name.trim(),
        type: 'rest_api',
        config: {
          url: apiForm.url.trim(),
          method: apiForm.method,
          authType: apiForm.authType,
          token: apiForm.token.trim() || undefined,
          apiKey: apiForm.apiKey.trim() || undefined,
          apiKeyHeader: apiForm.apiKeyHeader.trim() || undefined,
          username: apiForm.username.trim() || undefined,
          password: apiForm.password || undefined,
          headers: parsedHeaders,
          dataKey: apiForm.dataKey.trim() || undefined
        },
        organization_id: activeOrgId
      });
      if (res && res.success) {
        onSuccess(res.data);
        handleClose();
      } else {
        setError(res?.message || 'Failed to create REST API data source.');
      }
    } catch (err) {
      setError(err.message || 'Failed to create REST API data source.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit File Upload (CSV/JSON)
  const handleFileUploadSubmit = async (e) => {
    e.preventDefault();
    if (!activeOrgId) {
      setError('Cannot upload dataset: No tenant organization associated with current session. Please verify your workspace membership.');
      return;
    }
    const errs = {};
    if (!selectedFile) {
      errs.file = `Please select a ${activeTab.toUpperCase()} file to upload.`;
    }
    if (!sourceName.trim()) {
      errs.name = 'Data Source Name is required.';
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setIsProcessing(true);
    setError('');
    setUploadProgress(0);
    setUploadStage('uploading');
    setStageMessage('Uploading data file to enterprise storage...');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', sourceName.trim());
      formData.append('organization_id', activeOrgId);
      if (description.trim()) {
        formData.append('description', description.trim());
      }

      const res = await uploadDataSourceFile(formData, (progressEvent) => {
        setUploadProgress(progressEvent.percentage);
        setUploadStage(progressEvent.stage);
        setStageMessage(progressEvent.message);
      }, { organizationId: activeOrgId });

      if (res && res.success) {
        onSuccess(res.data);
        handleClose();
      } else {
        setError(res?.message || 'Failed to upload and ingest file.');
      }
    } catch (err) {
      setError(err.message || 'File upload failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setSelectedFile(null);
    setSourceName('');
    setDescription('');
    setError('');
    setFieldErrors({ name: '', file: '' });
    setPgTestResult(null);
    setMongoTestResult(null);
    setApiTestResult(null);
    onClose();
  };

  const isPgValid = Boolean(pgForm.name.trim() && pgForm.host.trim() && pgForm.database.trim() && pgForm.user.trim());
  const isMongoValid = Boolean(
    mongoForm.name.trim() &&
    (mongoForm.mode === 'uri' ? mongoForm.uri.trim() : (mongoForm.host.trim() && mongoForm.database.trim()))
  );
  const isApiValid = Boolean(apiForm.name.trim() && apiForm.url.trim());

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 dark:bg-black/85 backdrop-blur-xs font-sans overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          handleClose();
        }
      }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200/90 dark:border-[#334155] bg-white dark:bg-[#111827] text-slate-900 dark:text-[#F8FAFC] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#334155] bg-white dark:bg-[#111827] shrink-0">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#F8FAFC]">
              Connect Data Source
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
              Upload files or connect PostgreSQL, MongoDB, and REST API pipelines
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-700 dark:hover:text-[#F8FAFC] transition disabled:opacity-40 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto border-b border-slate-200/80 dark:border-[#334155] bg-slate-50/60 dark:bg-[#0F172A] px-6 shrink-0 gap-6 scrollbar-none">
          <button
            type="button"
            onClick={() => { setActiveTab('csv'); setError(''); }}
            disabled={isProcessing}
            className={`flex items-center gap-2 py-3 px-1 text-xs font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'csv'
                ? 'border-[#E11D48] text-[#FB7185] dark:border-[#E11D48] dark:text-[#FB7185] bg-transparent font-bold'
                : 'border-transparent text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#CBD5E1] bg-transparent'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('json'); setError(''); }}
            disabled={isProcessing}
            className={`flex items-center gap-2 py-3 px-1 text-xs font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'json'
                ? 'border-[#E11D48] text-[#FB7185] dark:border-[#E11D48] dark:text-[#FB7185] bg-transparent font-bold'
                : 'border-transparent text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#CBD5E1] bg-transparent'
            }`}
          >
            <FileCode className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span>JSON</span>
          </button>

          <button
            type="button"
            id="modal-tab-postgresql"
            onClick={() => { setActiveTab('postgresql'); setError(''); }}
            disabled={isProcessing}
            className={`flex items-center gap-2 py-3 px-1 text-xs font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'postgresql'
                ? 'border-[#E11D48] text-[#FB7185] dark:border-[#E11D48] dark:text-[#FB7185] bg-transparent font-bold'
                : 'border-transparent text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#CBD5E1] bg-transparent'
            }`}
          >
            <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>PostgreSQL</span>
          </button>

          <button
            type="button"
            id="modal-tab-mongodb"
            onClick={() => { setActiveTab('mongodb'); setError(''); }}
            disabled={isProcessing}
            className={`flex items-center gap-2 py-3 px-1 text-xs font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'mongodb'
                ? 'border-[#E11D48] text-[#FB7185] dark:border-[#E11D48] dark:text-[#FB7185] bg-transparent font-bold'
                : 'border-transparent text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#CBD5E1] bg-transparent'
            }`}
          >
            <Database className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>MongoDB</span>
          </button>

          <button
            type="button"
            id="modal-tab-rest-api"
            onClick={() => { setActiveTab('rest_api'); setError(''); }}
            disabled={isProcessing}
            className={`flex items-center gap-2 py-3 px-1 text-xs font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'rest_api'
                ? 'border-[#E11D48] text-[#FB7185] dark:border-[#E11D48] dark:text-[#FB7185] bg-transparent font-bold'
                : 'border-transparent text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#CBD5E1] bg-transparent'
            }`}
          >
            <Server className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span>REST API</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {isAuthLoading && (
            <div className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-950/40 p-3.5 text-xs text-blue-700 dark:text-blue-300">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
              <span>Initializing workspace organization context. Please wait...</span>
            </div>
          )}

          {!isAuthLoading && !activeOrgId && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/40 p-3.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold">No Tenant Workspace Associated</p>
                <p className="mt-0.5 text-[11px] opacity-90">
                  Your session does not have an active tenant organization assigned. Please verify your workspace membership or contact your organization administrator.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. CSV or JSON File Upload */}
          {(activeTab === 'csv' || activeTab === 'json') && (
            <form onSubmit={handleFileUploadSubmit} noValidate className="space-y-4">
              <div>
                <FileUpload
                  accept={activeTab === 'csv' ? '.csv' : '.json'}
                  maxSizeMb={MAX_UPLOAD_SIZE_MB}
                  selectedFile={selectedFile}
                  onFileSelect={handleFileSelect}
                  error={fieldErrors.file}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="source-name">
                    Data Source Name *
                  </label>
                  <input
                    id="source-name"
                    name="name"
                    type="text"
                    required
                    placeholder="e.g. Sales Metrics Q3"
                    value={sourceName}
                    onChange={(e) => {
                      setSourceName(e.target.value);
                      if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: '' }));
                    }}
                    disabled={isProcessing}
                    className={`w-full rounded-lg border bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition ${
                      fieldErrors.name ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200 focus:border-rose-600'
                    }`}
                  />
                  {fieldErrors.name && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="source-desc">
                    Description (Optional)
                  </label>
                  <input
                    id="source-desc"
                    name="description"
                    type="text"
                    placeholder="Short summary of this dataset"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isProcessing}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                  />
                </div>
              </div>

              {isProcessing && (
                <UploadProgress
                  progress={uploadProgress}
                  stage={uploadStage}
                  stageMessage={stageMessage}
                />
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isProcessing}
                  className="rounded-lg border border-slate-200/90 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !isOrgReady || !selectedFile || !sourceName.trim()}
                  id="submit-file-source-btn"
                  className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50 shadow-2xs cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Ingesting Dataset...</span>
                    </>
                  ) : (
                    <>
                      <span>Upload & Process</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 2. PostgreSQL Direct Connection */}
          {activeTab === 'postgresql' && (
            <form onSubmit={handlePostgresSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="pg-name">
                  Connection Name *
                </label>
                <input
                  id="pg-name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Analytics Production PostgreSQL"
                  value={pgForm.name}
                  onChange={handlePgChange}
                  disabled={isProcessing}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="pg-host">
                    Host / Server Address *
                  </label>
                  <input
                    id="pg-host"
                    name="host"
                    type="text"
                    required
                    placeholder="db.yourcompany.com"
                    value={pgForm.host}
                    onChange={handlePgChange}
                    disabled={isProcessing}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="pg-port">
                    Port
                  </label>
                  <input
                    id="pg-port"
                    name="port"
                    type="number"
                    placeholder="5432"
                    value={pgForm.port}
                    onChange={handlePgChange}
                    disabled={isProcessing}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none font-mono transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="pg-database">
                    Database Name *
                  </label>
                  <input
                    id="pg-database"
                    name="database"
                    type="text"
                    required
                    placeholder="analytics_production"
                    value={pgForm.database}
                    onChange={handlePgChange}
                    disabled={isProcessing}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="pg-user">
                    Database User *
                  </label>
                  <input
                    id="pg-user"
                    name="user"
                    type="text"
                    required
                    placeholder="readonly_user"
                    value={pgForm.user}
                    onChange={handlePgChange}
                    disabled={isProcessing}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="pg-password">
                  Database Password
                </label>
                <input
                  id="pg-password"
                  name="password"
                  type="password"
                  placeholder="••••••••••••"
                  value={pgForm.password}
                  onChange={handlePgChange}
                  disabled={isProcessing}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="pg-ssl"
                  name="ssl"
                  type="checkbox"
                  checked={pgForm.ssl}
                  onChange={handlePgChange}
                  disabled={isProcessing}
                  className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="pg-ssl" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Require SSL Connection (Recommended for cloud databases)
                </label>
              </div>

              <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                🔒 <strong>AES-256 Encrypted:</strong> Passwords are encrypted at rest with server-side keys. We recommend a read-only role.
              </p>

              {pgTestResult && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  pgTestResult.success
                    ? 'bg-emerald-50 border-emerald-200/90 text-emerald-800'
                    : 'bg-rose-50 border-rose-200/90 text-rose-800'
                }`}>
                  {pgTestResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">{pgTestResult.message}</p>
                    {pgTestResult.serverVersion && (
                      <p className="font-mono text-[10px] text-emerald-600 mt-0.5">
                        {pgTestResult.serverVersion.slice(0, 50)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestPostgres}
                  disabled={isTestingPg || isProcessing}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-40 cursor-pointer"
                >
                  {isTestingPg ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-600" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <>
                      <Server className="h-3.5 w-3.5 text-slate-500" />
                      <span>Test Connection</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isProcessing}
                    className="rounded-lg border border-slate-200/90 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing || !isOrgReady || !isPgValid}
                    id="submit-pg-source-btn"
                    className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50 shadow-2xs cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <span>Connect Source</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* 3. MongoDB Database Connector */}
          {activeTab === 'mongodb' && (
            <form onSubmit={handleMongoSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="mongo-name">
                  Data Source Name *
                </label>
                <input
                  id="mongo-name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Production MongoDB Atlas Cluster"
                  value={mongoForm.name}
                  onChange={handleMongoChange}
                  disabled={isProcessing}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                />
              </div>

              {/* Mode Selector */}
              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setMongoForm(prev => ({ ...prev, mode: 'uri' }))}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                    mongoForm.mode === 'uri' ? 'bg-white shadow-2xs text-rose-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Connection URI (Recommended)
                </button>
                <button
                  type="button"
                  onClick={() => setMongoForm(prev => ({ ...prev, mode: 'fields' }))}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                    mongoForm.mode === 'fields' ? 'bg-white shadow-2xs text-rose-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Host & Credentials
                </button>
              </div>

              {mongoForm.mode === 'uri' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="mongo-uri">
                    MongoDB Connection URI * (mongodb:// or mongodb+srv://)
                  </label>
                  <input
                    id="mongo-uri"
                    name="uri"
                    type="password"
                    required
                    placeholder="mongodb+srv://user:password@cluster.mongodb.net/analytics?retryWrites=true"
                    value={mongoForm.uri}
                    onChange={handleMongoChange}
                    disabled={isProcessing}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-mono text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Works seamlessly with MongoDB Atlas, Replica Sets, and self-hosted instances.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="mongo-host">
                        Host Address *
                      </label>
                      <input
                        id="mongo-host"
                        name="host"
                        type="text"
                        required
                        placeholder="cluster0.mongodb.net"
                        value={mongoForm.host}
                        onChange={handleMongoChange}
                        disabled={isProcessing}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="mongo-port">
                        Port
                      </label>
                      <input
                        id="mongo-port"
                        name="port"
                        type="number"
                        placeholder="27017"
                        value={mongoForm.port}
                        onChange={handleMongoChange}
                        disabled={isProcessing}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-mono text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="mongo-database">
                        Database Name *
                      </label>
                      <input
                        id="mongo-database"
                        name="database"
                        type="text"
                        required
                        placeholder="production_telemetry"
                        value={mongoForm.database}
                        onChange={handleMongoChange}
                        disabled={isProcessing}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="mongo-user">
                        Username
                      </label>
                      <input
                        id="mongo-user"
                        name="user"
                        type="text"
                        placeholder="analytics_reader"
                        value={mongoForm.user}
                        onChange={handleMongoChange}
                        disabled={isProcessing}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="mongo-password">
                        Password
                      </label>
                      <input
                        id="mongo-password"
                        name="password"
                        type="password"
                        placeholder="••••••••••••"
                        value={mongoForm.password}
                        onChange={handleMongoChange}
                        disabled={isProcessing}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="mongo-authSource">
                        Auth Database
                      </label>
                      <input
                        id="mongo-authSource"
                        name="authSource"
                        type="text"
                        placeholder="admin"
                        value={mongoForm.authSource}
                        onChange={handleMongoChange}
                        disabled={isProcessing}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      id="mongo-ssl"
                      name="ssl"
                      type="checkbox"
                      checked={mongoForm.ssl}
                      onChange={handleMongoChange}
                      disabled={isProcessing}
                      className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <label htmlFor="mongo-ssl" className="text-xs text-slate-700 font-medium cursor-pointer">
                      Enable TLS / SSL Connection (Required for MongoDB Atlas)
                    </label>
                  </div>
                </div>
              )}

              {/* Target Collection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="mongo-collection">
                  Target Collection (Optional · Ingests data immediately into analytics)
                </label>
                {mongoCollections.length > 0 ? (
                  <Select
                    id="mongo-collection"
                    name="collection"
                    value={mongoForm.collection}
                    onChange={handleMongoChange}
                    disabled={isProcessing}
                    className="w-full"
                  >
                    <option value="">-- Choose Discovered Collection --</option>
                    {mongoCollections.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </Select>
                ) : (
                  <input
                    id="mongo-collection"
                    name="collection"
                    type="text"
                    placeholder="e.g. orders, users, metrics"
                    value={mongoForm.collection}
                    onChange={handleMongoChange}
                    disabled={isProcessing}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                  />
                )}
              </div>

              <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                🔒 <strong>Read-Only & Encrypted:</strong> Queries are strictly read-only. Credentials and URIs are encrypted at rest with AES-256-GCM.
              </p>

              {/* MongoDB Test Result Banner */}
              {mongoTestResult && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  mongoTestResult.success
                    ? 'bg-emerald-50 border-emerald-200/90 text-emerald-800'
                    : 'bg-rose-50 border-rose-200/90 text-rose-800'
                }`}>
                  {mongoTestResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">{mongoTestResult.message}</p>
                    {mongoTestResult.collections && mongoTestResult.collections.length > 0 && (
                      <p className="text-[11px] text-emerald-700 mt-1">
                        Discovered {mongoTestResult.collections.length} collection(s): <span className="font-mono font-medium">{mongoTestResult.collections.slice(0, 5).join(', ')}{mongoTestResult.collections.length > 5 ? '...' : ''}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  id="test-mongo-btn"
                  onClick={handleTestMongo}
                  disabled={isTestingMongo || isProcessing}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-40 cursor-pointer"
                >
                  {isTestingMongo ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-600" />
                      <span>Testing MongoDB...</span>
                    </>
                  ) : (
                    <>
                      <Server className="h-3.5 w-3.5 text-slate-500" />
                      <span>Test Connection</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isProcessing}
                    className="rounded-lg border border-slate-200/90 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing || !isOrgReady || !isMongoValid}
                    id="submit-mongo-source-btn"
                    className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50 shadow-2xs cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <span>Connect Source</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* 4. REST API Endpoint Connector */}
          {activeTab === 'rest_api' && (
            <form onSubmit={handleApiSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="api-name">
                    Data Source Name *
                  </label>
                  <input
                    id="api-name"
                    name="name"
                    type="text"
                    required
                    placeholder="e.g. Stripe Payments API"
                    value={apiForm.name}
                    onChange={handleApiChange}
                    disabled={isProcessing}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="api-method">
                    HTTP Method
                  </label>
                  <Select
                    id="api-method"
                    name="method"
                    value={apiForm.method}
                    onChange={handleApiChange}
                    disabled={isProcessing}
                    className="w-full"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="api-url">
                  Endpoint URL * (HTTP or HTTPS)
                </label>
                <input
                  id="api-url"
                  name="url"
                  type="url"
                  required
                  placeholder="https://api.yourcompany.com/v1/telemetry"
                  value={apiForm.url}
                  onChange={handleApiChange}
                  disabled={isProcessing}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                />
              </div>

              {/* Authentication Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="api-authType">
                    Authentication Scheme
                  </label>
                  <Select
                    id="api-authType"
                    name="authType"
                    value={apiForm.authType}
                    onChange={handleApiChange}
                    disabled={isProcessing}
                    className="w-full"
                  >
                    <option value="none">No Authentication (Public)</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="api_key">API Key (Header)</option>
                    <option value="basic">Basic Auth (User/Password)</option>
                  </Select>
                </div>

                {apiForm.authType === 'bearer' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="api-token">
                      Bearer Token *
                    </label>
                    <input
                      id="api-token"
                      name="token"
                      type="password"
                      placeholder="eyJhbGciOi..."
                      value={apiForm.token}
                      onChange={handleApiChange}
                      disabled={isProcessing}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                    />
                  </div>
                )}

                {apiForm.authType === 'api_key' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="api-apiKey">
                      API Key Secret *
                    </label>
                    <input
                      id="api-apiKey"
                      name="apiKey"
                      type="password"
                      placeholder="key_live_..."
                      value={apiForm.apiKey}
                      onChange={handleApiChange}
                      disabled={isProcessing}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                    />
                  </div>
                )}

                {apiForm.authType === 'basic' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="api-username">
                        Username
                      </label>
                      <input
                        id="api-username"
                        name="username"
                        type="text"
                        placeholder="api_user"
                        value={apiForm.username}
                        onChange={handleApiChange}
                        disabled={isProcessing}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-rose-600 focus:outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="api-password">
                        Password
                      </label>
                      <input
                        id="api-password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        value={apiForm.password}
                        onChange={handleApiChange}
                        disabled={isProcessing}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 focus:border-rose-600 focus:outline-none transition"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="api-dataKey">
                  JSON Records Key (Optional)
                </label>
                <input
                  id="api-dataKey"
                  name="dataKey"
                  type="text"
                  placeholder="e.g. data or items (Leave blank if root response is array)"
                  value={apiForm.dataKey}
                  onChange={handleApiChange}
                  disabled={isProcessing}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="api-headers">
                  Custom Request Headers (Optional JSON format)
                </label>
                <textarea
                  id="api-headers"
                  name="headers"
                  rows={2}
                  placeholder='{"Accept": "application/json", "X-Custom-Env": "production"}'
                  value={apiForm.headers}
                  onChange={handleApiChange}
                  disabled={isProcessing}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-xs font-mono text-slate-900 placeholder-slate-400 focus:border-rose-600 focus:outline-none transition"
                />
              </div>

              <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                🌐 <strong>SSRF-Protected:</strong> Protected with DNS rebinding defenses, private CIDR filtering, and redirect validation.
              </p>

              {/* Connection Test Result Banner */}
              {apiTestResult && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  apiTestResult.success
                    ? 'bg-emerald-50 border-emerald-200/90 text-emerald-800'
                    : 'bg-rose-50 border-rose-200/90 text-rose-800'
                }`}>
                  {apiTestResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">{apiTestResult.message}</p>
                    {apiTestResult.recordCount !== undefined && (
                      <p className="font-mono text-[10px] text-emerald-600 mt-0.5">
                        Sample preview verified: {apiTestResult.recordCount} rows detected
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  id="test-api-btn"
                  onClick={handleTestApi}
                  disabled={isTestingApi || isProcessing}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-40 cursor-pointer"
                >
                  {isTestingApi ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-600" />
                      <span>Testing API...</span>
                    </>
                  ) : (
                    <>
                      <Server className="h-3.5 w-3.5 text-slate-500" />
                      <span>Test Endpoint</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isProcessing}
                    className="rounded-lg border border-slate-200/90 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing || !isOrgReady || !isApiValid}
                    id="submit-api-source-btn"
                    className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50 shadow-2xs cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Connecting & Ingesting...</span>
                      </>
                    ) : (
                      <>
                        <span>Connect & Ingest</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

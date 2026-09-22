import React, { useState } from 'react';
import { X, FileSpreadsheet, FileCode, Database, CheckCircle2, AlertCircle, Loader2, ArrowRight, Server } from 'lucide-react';
import FileUpload from './FileUpload';
import UploadProgress from './UploadProgress';

/**
 * Enterprise Add Data Source Modal
 * Supports CSV/JSON file ingestion and PostgreSQL database connections
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSuccess: (data: any) => void,
 *   token: string
 * }} props
 */
export default function AddDataSourceModal({ isOpen, onClose, onSuccess, token }) {
  const [activeTab, setActiveTab] = useState('csv'); // 'csv' | 'json' | 'postgresql'
  
  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [sourceName, setSourceName] = useState('');
  const [description, setDescription] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('uploading');
  const [stageMessage, setStageMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

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

  if (!isOpen) return null;

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setError('');
    if (file && !sourceName) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setSourceName(nameWithoutExt);
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
      const res = await fetch('/api/data-sources/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(pgForm)
      });
      const data = await res.json();
      setPgTestResult(data);
    } catch (err) {
      setPgTestResult({
        success: false,
        message: err.message || 'Failed to connect to database host.'
      });
    } finally {
      setIsTestingPg(false);
    }
  };

  // Submit PostgreSQL Source
  const handlePostgresSubmit = async (e) => {
    e.preventDefault();
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
      const res = await fetch('/api/data-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: pgForm.name.trim(),
          type: 'postgresql',
          config: pgForm
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to configure PostgreSQL source.');
      }

      onSuccess(data);
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit File Upload (CSV/JSON)
  const handleFileUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError(`Please select a ${activeTab.toUpperCase()} file to upload.`);
      return;
    }

    setIsProcessing(true);
    setError('');
    setUploadProgress(15);
    setUploadStage('uploading');
    setStageMessage('Uploading raw file payload...');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('name', sourceName.trim() || selectedFile.name);
    formData.append('description', description.trim());

    try {
      // Step simulator for realistic ingest pipeline feedback
      const progressTimer = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 85) {
            clearInterval(progressTimer);
            return prev;
          }
          if (prev >= 40 && uploadStage === 'uploading') {
            setUploadStage('parsing');
            setStageMessage('Parsing data records & validating delimiters...');
          } else if (prev >= 65 && uploadStage === 'parsing') {
            setUploadStage('schema');
            setStageMessage('Inferring column data types and generating statistics...');
          }
          return prev + 15;
        });
      }, 180);

      const res = await fetch('/api/data-sources/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      clearInterval(progressTimer);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Upload failed.');
      }

      setUploadProgress(100);
      setUploadStage('complete');
      setStageMessage('Ingestion complete! Generating preview...');

      setTimeout(() => {
        onSuccess(data);
        handleClose();
      }, 600);
    } catch (err) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setSourceName('');
    setDescription('');
    setUploadProgress(0);
    setIsProcessing(false);
    setError('');
    setPgTestResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs font-sans">
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white shrink-0">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Add New Data Source
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect external databases or upload structured tabular files
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-5 shrink-0">
          <button
            type="button"
            onClick={() => { setActiveTab('csv'); setError(''); }}
            disabled={isProcessing}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'csv'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Upload CSV</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('json'); setError(''); }}
            disabled={isProcessing}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'json'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="h-4 w-4 text-amber-600" />
            <span>Upload JSON</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('postgresql'); setError(''); }}
            disabled={isProcessing}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'postgresql'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="h-4 w-4 text-blue-600" />
            <span>PostgreSQL Database</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="flex items-start gap-2.5 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* CSV or JSON Upload Mode */}
          {(activeTab === 'csv' || activeTab === 'json') && (
            <form onSubmit={handleFileUploadSubmit} className="space-y-4">
              <FileUpload
                accept={activeTab === 'csv' ? '.csv' : '.json'}
                maxSizeMb={25}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1" htmlFor="sourceName">
                    Data Source Name
                  </label>
                  <input
                    id="sourceName"
                    type="text"
                    required
                    placeholder="e.g. Q4 Regional Sales"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    disabled={isProcessing}
                    className="w-full rounded-md border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1" htmlFor="description">
                    Description (Optional)
                  </label>
                  <input
                    id="description"
                    type="text"
                    placeholder="e.g. Ingested from branch telemetry"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isProcessing}
                    className="w-full rounded-md border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none"
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

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isProcessing}
                  className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !selectedFile}
                  id="submit-file-source-btn"
                  className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 shadow-xs"
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

          {/* PostgreSQL Direct Connection Mode */}
          {activeTab === 'postgresql' && (
            <form onSubmit={handlePostgresSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1" htmlFor="pg-name">
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
                  className="w-full rounded-md border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1" htmlFor="pg-host">
                    Host / Server Address *
                  </label>
                  <input
                    id="pg-host"
                    name="host"
                    type="text"
                    required
                    placeholder="localhost or db.company.internal"
                    value={pgForm.host}
                    onChange={handlePgChange}
                    disabled={isProcessing}
                    className="w-full rounded-md border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1" htmlFor="pg-port">
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
                    className="w-full rounded-md border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1" htmlFor="pg-database">
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
                    className="w-full rounded-md border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1" htmlFor="pg-user">
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
                    className="w-full rounded-md border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1" htmlFor="pg-password">
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
                  className="w-full rounded-md border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="pg-ssl"
                  name="ssl"
                  type="checkbox"
                  checked={pgForm.ssl}
                  onChange={handlePgChange}
                  disabled={isProcessing}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="pg-ssl" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Require SSL Connection (Recommended for cloud databases)
                </label>
              </div>

              {/* Connection Test Result Banner */}
              {pgTestResult && (
                <div className={`p-3 rounded-md border text-xs flex items-start gap-2.5 ${
                  pgTestResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
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
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
                >
                  {isTestingPg ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
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
                    className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    id="submit-pg-source-btn"
                    className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 shadow-xs"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
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
        </div>
      </div>
    </div>
  );
}

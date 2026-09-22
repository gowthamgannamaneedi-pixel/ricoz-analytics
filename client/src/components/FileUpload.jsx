import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, FileCode, File, X, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * Enterprise Drag-and-Drop File Upload Component
 * @param {{
 *   accept: string,
 *   maxSizeMb?: number,
 *   selectedFile: File | null,
 *   onFileSelect: (file: File | null) => void,
 *   error?: string
 * }} props
 */
export default function FileUpload({
  accept = '.csv, .json',
  maxSizeMb = 25,
  selectedFile,
  onFileSelect,
  error
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState('');

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const validateAndSelect = (file) => {
    setLocalError('');
    if (!file) return;

    // Size check
    const maxBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      setLocalError(`File size (${formatFileSize(file.size)}) exceeds the ${maxSizeMb}MB maximum limit.`);
      return;
    }

    // Extension check
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'csv' && ext !== 'json') {
      setLocalError('Invalid file format. Please upload a .csv or .json file.');
      return;
    }

    onFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelect(e.target.files[0]);
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onFileSelect(null);
  };

  const getFileIcon = (filename) => {
    const ext = (filename || '').split('.').pop().toLowerCase();
    if (ext === 'csv') return <FileSpreadsheet className="h-6 w-6 text-emerald-600" />;
    if (ext === 'json') return <FileCode className="h-6 w-6 text-amber-600" />;
    return <File className="h-6 w-6 text-blue-600" />;
  };

  const displayError = error || localError;

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        className="hidden"
        id="file-upload-input"
      />

      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-6 sm:p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50'
              : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          <div className="rounded-full bg-white p-3 border border-slate-200 shadow-2xs text-blue-600 mb-3">
            <UploadCloud className="h-6 w-6 text-blue-600" />
          </div>

          <p className="text-xs font-semibold text-slate-800">
            Click to browse or drag and drop your data file
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Supports CSV and JSON datasets up to {maxSizeMb}MB
          </p>

          <div className="flex items-center gap-2 mt-4">
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-white text-emerald-700 border border-slate-200 shadow-2xs">
              .CSV
            </span>
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-white text-amber-700 border border-slate-200 shadow-2xs">
              .JSON
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded bg-slate-50 border border-slate-100 shrink-0">
              {getFileIcon(selectedFile.name)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {selectedFile.name}
              </p>
              <p className="font-mono text-[11px] text-slate-400">
                {formatFileSize(selectedFile.size)} · Ready to ingest
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRemove}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            title="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {displayError && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  );
}

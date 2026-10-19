import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, FileCode, File, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { MAX_UPLOAD_SIZE_MB } from '../services/api';

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
  maxSizeMb = MAX_UPLOAD_SIZE_MB,
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
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 sm:p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-rose-500 bg-rose-50/50 dark:bg-[#2A1422]/60'
              : 'border-slate-200/90 dark:border-[#334155] bg-slate-50/40 dark:bg-[#0F172A] hover:bg-slate-50/80 dark:hover:bg-[#1E293B] hover:border-slate-300 dark:hover:border-slate-600'
          }`}
        >
          <div className="rounded-full bg-white dark:bg-[#1E293B] p-3 border border-slate-200/90 dark:border-[#334155] shadow-2xs text-rose-600 dark:text-[#FB7185] mb-2.5">
            <UploadCloud className="h-6 w-6 text-rose-600 dark:text-[#FB7185]" />
          </div>

          <p className="text-xs font-semibold text-slate-800 dark:text-[#CBD5E1]">
            Click to browse or drag and drop your data file
          </p>
          <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-1">
            Supports CSV and JSON files up to {maxSizeMb}MB
          </p>

          <div className="flex items-center gap-2 mt-3.5">
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-[#1E293B] text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 shadow-2xs">
              .CSV
            </span>
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-[#1E293B] text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80 shadow-2xs">
              .JSON
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-slate-200/90 dark:border-[#334155] bg-white dark:bg-[#0F172A] p-3.5 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#1E293B] border border-slate-100 dark:border-[#334155] shrink-0">
              {getFileIcon(selectedFile.name)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-[#F8FAFC] truncate">
                {selectedFile.name}
              </p>
              <p className="font-mono text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5">
                {formatFileSize(selectedFile.size)} · Ready to ingest
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRemove}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-700 dark:hover:text-[#F8FAFC] transition cursor-pointer"
            title="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {displayError && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-[#2A1422] p-3 text-xs text-rose-700 dark:text-[#FDA4AF]">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-[#FB7185]" />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  );
}

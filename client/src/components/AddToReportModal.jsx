import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileText,
  FolderPlus,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Sparkles,
  Calendar,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { getReports, createReport, addInsightToReport } from '../services/api';

const FORMAT_OPTIONS = [
  { value: 'pdf', label: 'PDF Document', desc: 'Formatted executive briefing', icon: '📄' },
  { value: 'excel', label: 'Excel Workbook (.xlsx)', desc: 'Multi-sheet tabular workbook', icon: '📊' },
  { value: 'csv', label: 'CSV Spreadsheet', desc: 'Raw tabular metric data export', icon: '📑' },
  { value: 'json', label: 'Structured JSON', desc: 'Machine-readable analytics schema', icon: '⚡' }
];

export default function AddToReportModal({
  isOpen,
  onClose,
  insight,
  onSuccess
}) {
  const [activeTab, setActiveTab] = useState('existing'); // 'existing' | 'new'
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState('');
  
  // New report form fields
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFormat, setNewFormat] = useState('pdf');

  // Submit status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Initialize modal state whenever it opens or insight changes
  useEffect(() => {
    if (!isOpen || !insight) return;

    setError(null);
    setSelectedReportId('');
    setNewTitle(`Executive Brief: ${insight.title || 'AI Observation'}`);
    setNewDescription(insight.summary || '');
    setNewFormat('pdf');

    let isMounted = true;
    setLoadingReports(true);

    getReports()
      .then((res) => {
        if (!isMounted) return;
        const list = res.reports || res.data || [];
        setReports(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list.length > 0) {
          setSelectedReportId(list[0].id);
          setActiveTab('existing');
        } else {
          setActiveTab('new');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[AddToReportModal] Failed to load existing reports:', err);
        setReports([]);
        setActiveTab('new');
      })
      .finally(() => {
        if (isMounted) setLoadingReports(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, insight?.id]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = orig;
    };
  }, [isOpen]);

  if (!isOpen || !insight) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!insight?.id) {
      setError('Insight reference is missing or invalid.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let targetReportId = selectedReportId;
      let targetReportTitle = '';

      if (activeTab === 'new') {
        if (!newTitle.trim()) {
          setError('Please provide a report title.');
          setSubmitting(false);
          return;
        }

        // 1. Create the new report definition
        const createRes = await createReport({
          title: newTitle.trim(),
          description: newDescription.trim(),
          format: newFormat,
          status: 'draft'
        });

        const createdReport = createRes.report || createRes.data || createRes;
        if (!createdReport?.id) {
          throw new Error('Failed to create new report definition.');
        }

        targetReportId = createdReport.id;
        targetReportTitle = createdReport.title || newTitle.trim();
      } else {
        if (!selectedReportId) {
          setError('Please select a report to attach this insight to.');
          setSubmitting(false);
          return;
        }
        const matched = reports.find((r) => String(r.id) === String(selectedReportId));
        targetReportTitle = matched?.title || 'Report';
      }

      // 2. Associate insight with the report
      await addInsightToReport(targetReportId, insight.id);

      if (onSuccess) {
        onSuccess(`Insight successfully attached to report "${targetReportTitle}".`);
      }
      onClose();
    } catch (err) {
      console.error('[AddToReportModal] Submit error:', err);
      setError(err.message || 'Failed to attach insight to report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto font-sans"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-[#111827] shadow-2xl border border-slate-200/90 dark:border-[#334155] overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-[#334155] bg-slate-50/70 dark:bg-[#111827] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-[#F8FAFC] leading-tight">
                Add Insight to Report
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                Attach this evidence-grounded finding into an executive analytics report
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 dark:hover:bg-[#1E293B] hover:text-slate-700 dark:hover:text-[#F8FAFC] transition cursor-pointer shrink-0 disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Insight Preview Card */}
        <div className="px-6 pt-4 pb-2 shrink-0">
          <div className="p-3 rounded-xl border border-rose-100 dark:border-rose-950 bg-rose-50/40 dark:bg-[#201520] flex items-start gap-3">
            <span className="text-xs uppercase font-mono font-bold px-2 py-0.5 rounded bg-white dark:bg-[#111827] text-rose-700 dark:text-[#FDA4AF] border border-rose-200 dark:border-rose-900/60 shrink-0">
              {insight.type || 'insight'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-[#F8FAFC] line-clamp-1">
                {insight.title}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-[#CBD5E1] line-clamp-1 mt-0.5">
                {insight.summary}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="px-6 pt-2 shrink-0">
          <div className="flex rounded-xl bg-slate-100 dark:bg-[#1E293B] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('existing')}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'existing'
                  ? 'bg-white dark:bg-[#0F172A] text-slate-900 dark:text-[#F8FAFC] shadow-2xs'
                  : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Add to Existing Report ({reports.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('new')}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'new'
                  ? 'bg-white dark:bg-[#0F172A] text-slate-900 dark:text-[#F8FAFC] shadow-2xs'
                  : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Report</span>
            </button>
          </div>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-[#2A1422] border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-[#FDA4AF] text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'existing' ? (
            /* TAB 1: Existing Reports Selector */
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#CBD5E1]">
                Select Target Report
              </label>

              {loadingReports ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-[#94A3B8]">
                  <Loader2 className="w-5 h-5 animate-spin text-rose-600" />
                  <span className="text-xs">Loading organization reports...</span>
                </div>
              ) : reports.length === 0 ? (
                <div className="p-5 rounded-xl border border-dashed border-slate-300 dark:border-[#334155] text-center space-y-2">
                  <p className="text-xs text-slate-600 dark:text-[#94A3B8]">
                    No reports found in this organization workspace yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('new')}
                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                  >
                    <span>Create your first report now</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {reports.map((rep) => {
                    const isSelected = String(rep.id) === String(selectedReportId);
                    return (
                      <div
                        key={rep.id}
                        onClick={() => setSelectedReportId(rep.id)}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-rose-600 dark:border-[#E11D48] bg-rose-50/40 dark:bg-[#2A1422] ring-1 ring-rose-600 dark:ring-[#E11D48]'
                            : 'border-slate-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] hover:bg-slate-50 dark:hover:bg-[#1E293B]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold ${isSelected ? 'text-rose-900 dark:text-[#FDA4AF]' : 'text-slate-800 dark:text-[#CBD5E1]'}`}>
                            {rep.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] line-clamp-1 mt-0.5">
                            {rep.description || 'General analytics report'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-[#1E293B] text-slate-600 dark:text-[#94A3B8]">
                            {rep.format || 'pdf'}
                          </span>
                          <input
                            type="radio"
                            name="targetReport"
                            checked={isSelected}
                            onChange={() => setSelectedReportId(rep.id)}
                            className="h-4 w-4 text-rose-600 focus:ring-rose-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: Create New Report */
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] mb-1">
                  Report Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Q4 Executive Performance Digest"
                  className="w-full rounded-xl border border-slate-300 dark:border-[#334155] bg-white dark:bg-[#0F172A] px-3.5 py-2 text-xs text-slate-800 dark:text-[#F8FAFC] placeholder-slate-400 focus:border-rose-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] mb-1">
                  Description / Context
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Report objectives and business context..."
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#334155] bg-white dark:bg-[#0F172A] px-3.5 py-2 text-xs text-slate-800 dark:text-[#F8FAFC] placeholder-slate-400 focus:border-rose-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] mb-1.5">
                  Output Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {FORMAT_OPTIONS.map((opt) => {
                    const isSelected = newFormat === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setNewFormat(opt.value)}
                        className={`flex items-start gap-2 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? 'border-rose-600 dark:border-[#E11D48] bg-rose-50/50 dark:bg-[#2A1422] ring-1 ring-rose-600 dark:ring-[#E11D48]'
                            : 'border-slate-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] hover:bg-slate-50 dark:hover:bg-[#1E293B]'
                        }`}
                      >
                        <span className="text-base shrink-0">{opt.icon}</span>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold ${isSelected ? 'text-rose-900 dark:text-[#FDA4AF]' : 'text-slate-800 dark:text-[#CBD5E1]'}`}>
                            {opt.label}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-[#94A3B8] line-clamp-1">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-[#334155] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-[#334155] bg-white dark:bg-[#1E293B] text-slate-700 dark:text-[#CBD5E1] text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (activeTab === 'existing' && (!selectedReportId || reports.length === 0))}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Attaching...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{activeTab === 'new' ? 'Create & Attach' : 'Add to Report'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}


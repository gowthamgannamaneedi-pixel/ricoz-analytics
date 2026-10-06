import React, { useState } from 'react';
import {
  X,
  FileBarChart,
  Calendar,
  Clock,
  Mail,
  Download,
  Play,
  Share2,
  Edit3,
  Layers,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  FileType,
  History,
  Check
} from 'lucide-react';

export default function ReportViewerModal({
  isOpen,
  onClose,
  report,
  executions = [],
  onRunReport,
  onDownloadExecution,
  onShare,
  onEdit,
  isRunning = false,
  downloadingId = null,
  isViewer = false
}) {
  if (!isOpen || !report) return null;

  const recipients = Array.isArray(report.recipients)
    ? report.recipients
    : (typeof report.recipients === 'string'
      ? (() => {
          try {
            return JSON.parse(report.recipients || '[]');
          } catch {
            return [];
          }
        })()
      : []);

  // Filter executions belonging to this report
  const reportExecutions = executions.filter(
    (e) => String(e.report_id) === String(report.id) || (e.report_title && e.report_title === report.title)
  );

  const latestExecution = reportExecutions.length > 0 ? reportExecutions[0] : null;

  const formatScheduleText = (cron) => {
    if (!cron) return 'Manual / On-Demand Only';
    const c = cron.trim().toLowerCase();
    if (c === '0 9 * * *' || c === 'daily') return 'Daily (Every morning at 9:00 AM)';
    if (c === '0 9 * * 1' || c === 'weekly') return 'Weekly (Every Monday at 9:00 AM)';
    if (c === '0 9 1 * *' || c === 'monthly') return 'Monthly (1st of month at 9:00 AM)';
    return `Custom Schedule (${cron})`;
  };

  const getFormatBadge = (fmt) => {
    switch (fmt?.toLowerCase()) {
      case 'pdf':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-50 text-rose-700 border border-rose-200">PDF</span>;
      case 'excel':
      case 'xlsx':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">XLSX</span>;
      case 'csv':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-50 text-amber-700 border border-amber-200">CSV</span>;
      case 'json':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-purple-50 text-purple-700 border border-purple-200">JSON</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200">{fmt || 'FILE'}</span>;
    }
  };

  const getStatusBadge = (st) => {
    switch (st?.toLowerCase()) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Paused
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Draft
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-start gap-3.5 min-w-0 pr-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <FileBarChart className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-base font-bold text-slate-900 truncate">
                  {report.title}
                </h2>
                {getStatusBadge(report.status)}
                {getFormatBadge(report.format)}
              </div>
              <p className="text-xs text-slate-500 line-clamp-1">
                {report.description || 'Configured enterprise report pipeline.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition shrink-0 cursor-pointer"
            aria-label="Close report viewer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 max-h-[72vh] overflow-y-auto">
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                <Layers className="h-3.5 w-3.5 text-blue-600" />
                <span>Source Scope</span>
              </div>
              <p className="text-xs font-semibold text-slate-900 truncate" title={report.dashboard_title || 'Executive Overview'}>
                {report.dashboard_title || 'Executive Overview'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                <span>Cadence</span>
              </div>
              <p className="text-xs font-semibold text-slate-900 truncate">
                {report.schedule_cron ? formatScheduleText(report.schedule_cron).split('(')[0].trim() : 'On-Demand'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                <Calendar className="h-3.5 w-3.5 text-purple-600" />
                <span>Last Generated</span>
              </div>
              <p className="text-xs font-semibold text-slate-900 truncate">
                {report.last_generated_at
                  ? new Date(report.last_generated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Never executed'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                <User className="h-3.5 w-3.5 text-amber-600" />
                <span>Created By</span>
              </div>
              <p className="text-xs font-semibold text-slate-900 truncate">
                {report.creator_name || 'Organization Admin'}
              </p>
            </div>
          </div>

          {/* Description & Stakeholders Strip */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Report Purpose & Summary
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed">
                {report.description || 'This report automatically compiles core metrics, target quotas, and data tables from the referenced dashboard scope into a formatted document for executive review.'}
              </p>
            </div>

            {/* Recipients */}
            {recipients.length > 0 && (
              <div className="pt-3 border-t border-slate-100">
                <span className="text-[11px] font-medium text-slate-500 block mb-1.5">
                  Delivered To ({recipients.length} Stakeholder{recipients.length > 1 ? 's' : ''}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {recipients.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200/70"
                    >
                      <Mail className="h-3 w-3 text-slate-400" />
                      {email}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Latest Generated Artifact Spotlight */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Latest Generated Artifact
                </h4>
                <p className="text-[11px] text-slate-500">
                  Most recent document compiled by the background export engine
                </p>
              </div>

              {latestExecution && latestExecution.status === 'completed' && latestExecution.file_path && (
                <button
                  onClick={() => onDownloadExecution(latestExecution)}
                  disabled={downloadingId === latestExecution.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {downloadingId === latestExecution.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      Download {report.format ? report.format.toUpperCase() : 'Artifact'}
                    </>
                  )}
                </button>
              )}
            </div>

            {latestExecution ? (
              <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-white rounded-lg border border-slate-200 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">
                      {latestExecution.report_title || report.title}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Generated {new Date(latestExecution.created_at).toLocaleString()} • {latestExecution.file_size ? `${Math.round(latestExecution.file_size / 1024)} KB` : 'Ready'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-slate-500">Trigger:</span>
                  <span className="font-medium text-slate-700">{latestExecution.executed_by_name || 'Scheduler'}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-white rounded-lg border border-dashed border-slate-200">
                <History className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-slate-700">No export artifacts generated yet</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Click "Run Report Now" below to compile your first export.
                </p>
              </div>
            )}
          </div>

          {/* Past Executions History Table */}
          {reportExecutions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Execution History ({reportExecutions.length})
                </h4>
                <span className="text-[11px] text-slate-500 font-mono">
                  Report ID: #{report.id}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Format</th>
                        <th className="px-4 py-2.5">File Size</th>
                        <th className="px-4 py-2.5">Timestamp</th>
                        <th className="px-4 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportExecutions.slice(0, 5).map((exec) => (
                        <tr key={exec.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-2.5">
                            {exec.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <Check className="h-3 w-3" /> Completed
                              </span>
                            ) : exec.status === 'failed' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                <AlertCircle className="h-3 w-3" /> Failed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                <Loader2 className="h-3 w-3 animate-spin" /> {exec.status}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">{getFormatBadge(exec.format)}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-600 text-[11px]">
                            {exec.file_size ? `${Math.round(exec.file_size / 1024)} KB` : '-'}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                            {new Date(exec.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {exec.status === 'completed' && exec.file_path ? (
                              <button
                                onClick={() => onDownloadExecution(exec)}
                                disabled={downloadingId === exec.id}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                              >
                                {downloadingId === exec.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Download className="h-3 w-3" />
                                )}
                                Download
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onShare(report)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
            >
              <Share2 className="h-3.5 w-3.5 text-slate-500" />
              Share
            </button>

            {!isViewer && onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(report);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
              >
                <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                Edit Configuration
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Close
            </button>

            <button
              onClick={() => onRunReport(report)}
              disabled={isRunning || isViewer}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Run Report Now
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

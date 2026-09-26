import React, { useState, useEffect } from 'react';
import {
  X,
  FileBarChart,
  Calendar,
  Mail,
  FileType,
  LayoutDashboard,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  Plus,
  Trash2
} from 'lucide-react';

const FORMAT_OPTIONS = [
  { value: 'pdf', label: 'PDF Document', desc: 'Formatted executive summary with charts & KPI cards', icon: '📄' },
  { value: 'excel', label: 'Excel Workbook (.xlsx)', desc: 'Multi-sheet workbook with raw data & analytics', icon: '📊' },
  { value: 'csv', label: 'CSV Spreadsheet', desc: 'Lightweight raw tabular data export', icon: '📑' },
  { value: 'json', label: 'Structured JSON', desc: 'Machine-readable analytics schema & telemetry', icon: '⚡' }
];

const SCHEDULE_PRESETS = [
  { value: 'manual', label: 'Manual / On-Demand Only', cron: null },
  { value: 'daily', label: 'Daily (Every morning at 9:00 AM)', cron: '0 9 * * *' },
  { value: 'weekly', label: 'Weekly (Every Monday at 9:00 AM)', cron: '0 9 * * 1' },
  { value: 'monthly', label: 'Monthly (1st of month at 9:00 AM)', cron: '0 9 1 * *' },
  { value: 'custom', label: 'Custom Cron Syntax', cron: '' }
];

export default function ReportModal({
  isOpen,
  onClose,
  onSave,
  report = null,
  dashboards = []
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dashboardId, setDashboardId] = useState('');
  const [format, setFormat] = useState('pdf');
  const [schedulePreset, setSchedulePreset] = useState('manual');
  const [customCron, setCustomCron] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [emailInput, setEmailInput] = useState('');
  const [status, setStatus] = useState('active');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize or reset modal state
  useEffect(() => {
    if (report) {
      setTitle(report.title || '');
      setDescription(report.description || '');
      setDashboardId(report.dashboard_id || '');
      setFormat(report.format || 'pdf');
      setStatus(report.status || 'active');

      const existingRecipients = Array.isArray(report.recipients)
        ? report.recipients
        : (typeof report.recipients === 'string' ? JSON.parse(report.recipients || '[]') : []);
      setRecipients(existingRecipients);

      if (report.schedule_cron) {
        const cron = report.schedule_cron.trim();
        if (cron === '0 9 * * *' || cron.toLowerCase() === 'daily') {
          setSchedulePreset('daily');
        } else if (cron === '0 9 * * 1' || cron.toLowerCase() === 'weekly') {
          setSchedulePreset('weekly');
        } else if (cron === '0 9 1 * *' || cron.toLowerCase() === 'monthly') {
          setSchedulePreset('monthly');
        } else {
          setSchedulePreset('custom');
          setCustomCron(cron);
        }
      } else {
        setSchedulePreset('manual');
        setCustomCron('');
      }
    } else {
      setTitle('');
      setDescription('');
      setDashboardId(dashboards.length > 0 ? dashboards[0].id : '');
      setFormat('pdf');
      setSchedulePreset('weekly');
      setCustomCron('');
      setRecipients([]);
      setStatus('active');
    }
    setError(null);
  }, [report, dashboards, isOpen]);

  if (!isOpen) return null;

  const handleAddEmail = (e) => {
    if (e) e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!recipients.includes(cleanEmail)) {
      setRecipients([...recipients, cleanEmail]);
    }
    setEmailInput('');
    setError(null);
  };

  const handleRemoveEmail = (emailToRemove) => {
    setRecipients(recipients.filter(e => e !== emailToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Report title is required.');
      return;
    }

    let finalCron = null;
    if (schedulePreset === 'daily') finalCron = '0 9 * * *';
    else if (schedulePreset === 'weekly') finalCron = '0 9 * * 1';
    else if (schedulePreset === 'monthly') finalCron = '0 9 1 * *';
    else if (schedulePreset === 'custom') {
      if (!customCron.trim()) {
        setError('Please provide a valid custom cron expression.');
        return;
      }
      finalCron = customCron.trim();
    }

    setLoading(true);
    setError(null);

    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        dashboard_id: dashboardId || null,
        format,
        schedule_cron: finalCron,
        recipients,
        status
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save report configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
              <FileBarChart className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {report ? 'Edit Report Configuration' : 'Create Automated Report'}
              </h2>
              <p className="text-[11px] text-slate-500">
                Configure data scopes, output formatting, and automated scheduling
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Report Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q4 Executive Performance Digest"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Business Context
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summary of KPIs, key focus metrics, and target stakeholders..."
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Dashboard Scope & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dashboard Telemetry Source
              </label>
              <div className="relative">
                <select
                  value={dashboardId}
                  onChange={(e) => setDashboardId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Executive Organization KPIs (All)</option>
                  {dashboards.map((dash) => (
                    <option key={dash.id} value={dash.id}>
                      {dash.title} {dash.is_default ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Report State / Pipeline Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              >
                <option value="active">Active (Running on schedule)</option>
                <option value="draft">Draft (On-demand only)</option>
                <option value="paused">Paused (Temporarily halted)</option>
              </select>
            </div>
          </div>

          {/* Format Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Output Export Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {FORMAT_OPTIONS.map((opt) => {
                const isSelected = format === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormat(opt.value)}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xl shrink-0">{opt.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Schedule Cadence */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Automated Schedule Cadence
            </label>
            <select
              value={schedulePreset}
              onChange={(e) => setSchedulePreset(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              {SCHEDULE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>

            {schedulePreset === 'custom' && (
              <div className="mt-2">
                <input
                  type="text"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  placeholder="e.g. 0 18 * * 5 (Every Friday at 6:00 PM)"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs font-mono text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Standard 5-field cron syntax: <code>minute hour day-of-month month day-of-week</code>
                </p>
              </div>
            )}
          </div>

          {/* Email Delivery Recipients */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Stakeholder Email Recipients
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddEmail();
                  }
                }}
                placeholder="colleague@company.com"
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddEmail}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>

            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {recipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-medium"
                  >
                    <Mail className="h-3 w-3 text-blue-600" />
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail(email)}
                      className="text-blue-500 hover:text-rose-600 ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold shadow-2xs hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                report ? 'Update Report' : 'Create & Schedule Report'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

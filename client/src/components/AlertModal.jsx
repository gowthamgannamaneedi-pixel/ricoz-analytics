import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Bell,
  Sliders,
  Mail,
  ShieldAlert,
  Clock,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Activity,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

const CONDITIONS = [
  { value: 'greater_than', label: 'Greater Than (>)' },
  { value: 'less_than', label: 'Less Than (<)' },
  { value: 'equal', label: 'Equal To (=)' },
  { value: 'not_equal', label: 'Not Equal To (≠)' },
  { value: 'percent_increase', label: 'Percentage Increase (▲ %)' },
  { value: 'percent_decrease', label: 'Percentage Decrease (▼ %)' }
];

const SEVERITIES = [
  { value: 'low', label: 'Low', color: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300', dot: 'bg-blue-500' },
  { value: 'medium', label: 'Medium', color: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300', dot: 'bg-amber-500' },
  { value: 'high', label: 'High', color: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300', dot: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', color: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300', dot: 'bg-rose-500' }
];

export default function AlertModal({
  isOpen,
  onClose,
  onSave,
  alert = null,
  metrics = []
}) {
  const modalRef = useRef(null);
  const triggerRef = useRef(null);
  const [name, setName] = useState('');
  const [metricId, setMetricId] = useState('');
  const [condition, setCondition] = useState('greater_than');
  const [threshold, setThreshold] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [cooldownMinutes, setCooldownMinutes] = useState(60);
  const [notificationChannels, setNotificationChannels] = useState(['in_app']);
  const [recipients, setRecipients] = useState([]);
  const [emailInput, setEmailInput] = useState('');
  const [status, setStatus] = useState('active');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Focus trap, focus restoration, and scroll lock
  useEffect(() => {
    if (!isOpen) return;

    triggerRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]'
        );
        if (focusable.length > 0) focusable[0].focus();
      }
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (alert) {
      setName(alert.name || '');
      setMetricId(alert.metric_id || (metrics.length > 0 ? metrics[0].id : ''));
      setCondition(alert.condition || 'greater_than');
      setThreshold(alert.threshold !== undefined && alert.threshold !== null ? String(alert.threshold) : '');
      setSeverity(alert.severity || 'medium');
      setCooldownMinutes(alert.cooldown_minutes !== undefined ? alert.cooldown_minutes : 60);
      setStatus(alert.status || 'active');

      const channels = Array.isArray(alert.notification_channels)
        ? alert.notification_channels
        : (typeof alert.notification_channels === 'string' ? JSON.parse(alert.notification_channels || '["in_app"]') : ['in_app']);
      setNotificationChannels(channels);

      const recs = Array.isArray(alert.recipients)
        ? alert.recipients
        : (typeof alert.recipients === 'string' ? JSON.parse(alert.recipients || '[]') : []);
      setRecipients(recs);
    } else {
      setName('');
      setMetricId(metrics.length > 0 ? metrics[0].id : '');
      setCondition('greater_than');
      setThreshold('');
      setSeverity('medium');
      setCooldownMinutes(60);
      setNotificationChannels(['in_app']);
      setRecipients([]);
      setStatus('active');
    }
    setError(null);
  }, [alert, metrics, isOpen]);

  if (!isOpen) return null;

  const handleAddEmail = (e) => {
    if (e) e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!recipients.includes(cleanEmail)) {
      setRecipients([...recipients, cleanEmail]);
      if (!notificationChannels.includes('email')) {
        setNotificationChannels([...notificationChannels, 'email']);
      }
    }
    setEmailInput('');
    setError(null);
  };

  const handleRemoveEmail = (emailToRemove) => {
    const updated = recipients.filter(e => e !== emailToRemove);
    setRecipients(updated);
    if (updated.length === 0) {
      setNotificationChannels(notificationChannels.filter(c => c !== 'email'));
    }
  };

  const toggleChannel = (channel) => {
    if (notificationChannels.includes(channel)) {
      if (channel === 'in_app' && notificationChannels.length === 1) {
        return; // Keep at least one channel
      }
      setNotificationChannels(notificationChannels.filter(c => c !== channel));
    } else {
      setNotificationChannels([...notificationChannels, channel]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Alert rule name is required.');
      return;
    }

    if (threshold === '' || isNaN(Number(threshold))) {
      setError('A valid numeric threshold is required.');
      return;
    }

    if (cooldownMinutes < 0 || isNaN(Number(cooldownMinutes))) {
      setError('Cooldown duration must be 0 or more minutes.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        metricId: metricId || null,
        condition,
        threshold: Number(threshold),
        severity,
        status,
        notificationChannels,
        cooldownMinutes: Number(cooldownMinutes),
        recipients
      };

      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save alert rule.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#111827] shadow-2xl transition-all max-h-[92vh] flex flex-col overflow-hidden my-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#334155] px-5 py-3.5 shrink-0 bg-white dark:bg-[#111827]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF1F3] dark:bg-[#2A1422] border border-rose-200/80 dark:border-rose-900/60 text-[#D91542] dark:text-[#FB7185] shrink-0">
              <Bell className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 id="alert-modal-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#F8FAFC] leading-tight">
                {alert ? 'Edit Alert Rule' : 'Create Real-Time Alert Rule'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5">
                Set operational condition thresholds and dispatch rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-700 dark:hover:text-[#F8FAFC] transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3.5 overflow-visible">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/90 dark:bg-[#2A1422] px-3 py-2 text-xs text-rose-700 dark:text-[#FDA4AF]">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: Rule Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-[#CBD5E1] mb-1">
              Alert Rule Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Critical Revenue Minimum Threshold"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full h-10 rounded-xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] px-3.5 text-xs text-slate-900 dark:text-[#F8FAFC] font-medium placeholder-slate-400 dark:placeholder-slate-500 transition focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 focus:outline-none shadow-2xs"
            />
          </div>

          {/* Row 2: Metric & Condition Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Metric Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-[#CBD5E1] mb-1">
                Target Metric / KPI
              </label>
              <Select
                value={metricId}
                onChange={(e) => setMetricId(e.target.value)}
                placeholder="Generic Organization Metric"
              >
                <option value="">-- Generic Organization Metric --</option>
                {metrics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.unit ? `(${m.unit})` : ''}
                  </option>
                ))}
              </Select>
            </div>

            {/* Condition Expression */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-[#CBD5E1] mb-1">
                Condition Trigger <span className="text-rose-500">*</span>
              </label>
              <Select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Row 3: Threshold & Cooldown Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Threshold Value */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-[#CBD5E1] mb-1">
                Threshold Boundary <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  placeholder="e.g., 100000"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  required
                  className="w-full h-10 rounded-xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] pl-3.5 pr-12 text-xs font-medium text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-slate-500 transition focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 focus:outline-none shadow-2xs"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 dark:text-[#94A3B8] font-mono pointer-events-none">
                  value
                </span>
              </div>
            </div>

            {/* Cooldown Period */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-[#CBD5E1] mb-1" title="Minimum minutes between repeat alert notifications">
                Notification Delay (Minutes)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  placeholder="60"
                  value={cooldownMinutes}
                  onChange={(e) => setCooldownMinutes(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] pl-3.5 pr-12 text-xs font-medium text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-slate-500 transition focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 focus:outline-none shadow-2xs"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 dark:text-[#94A3B8] font-mono pointer-events-none">
                  mins
                </span>
              </div>
            </div>
          </div>

          {/* Row 4: Severity Badges Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-[#CBD5E1] mb-1.5">
              Incident Severity Level
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SEVERITIES.map((sev) => {
                const isSelected = severity === sev.value;
                return (
                  <button
                    key={sev.value}
                    type="button"
                    onClick={() => setSeverity(sev.value)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border h-9 px-2.5 text-xs font-semibold transition cursor-pointer ${
                      isSelected
                        ? `${sev.color} ring-2 ring-rose-500/20 shadow-xs font-bold`
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#1E293B]'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${sev.dot}`} />
                    <span>{sev.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 5: Notification Channels & Recipient Emails */}
          <div className="rounded-xl border border-slate-200/90 dark:border-[#334155] bg-slate-50/60 dark:bg-[#0F172A] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 dark:text-[#CBD5E1] flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-rose-600 dark:text-[#FB7185]" />
                <span>Notification Dispatch Channels</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleChannel('in_app')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                    notificationChannels.includes('in_app')
                      ? 'bg-rose-600 text-white border-rose-600 dark:bg-[#E11D48] dark:border-[#E11D48] shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-[#1E293B] dark:text-[#CBD5E1] dark:border-[#334155] dark:hover:bg-[#334155]'
                  }`}
                >
                  In-App Incident Center
                </button>
                <button
                  type="button"
                  onClick={() => toggleChannel('email')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                    notificationChannels.includes('email')
                      ? 'bg-rose-600 text-white border-rose-600 dark:bg-[#E11D48] dark:border-[#E11D48] shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-[#1E293B] dark:text-[#CBD5E1] dark:border-[#334155] dark:hover:bg-[#334155]'
                  }`}
                >
                  Email Notification
                </button>
              </div>
            </div>

            {/* Email Recipients Input */}
            {notificationChannels.includes('email') && (
              <div className="pt-2 border-t border-slate-200/70 dark:border-[#334155] space-y-2">
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter email address (e.g. devops@company.com)"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEmail();
                      }
                    }}
                    className="flex-1 h-9 rounded-xl border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#111827] px-3 text-xs text-slate-800 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-slate-500 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    className="flex items-center gap-1 h-9 rounded-xl bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 transition cursor-pointer shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                {/* Recipient Chips */}
                {recipients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {recipients.map((em) => (
                      <span
                        key={em}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] px-2 py-0.5 text-[11px] font-mono text-slate-700 dark:text-[#CBD5E1] shadow-2xs"
                      >
                        <span>{em}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(em)}
                          className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer: Active Switch on Left + Action Buttons on Right */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-[#334155]">
            {/* Activation Status Switch */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStatus(status === 'active' ? 'disabled' : 'active')}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  status === 'active' ? 'bg-rose-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    status === 'active' ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-xs font-semibold text-slate-700 dark:text-[#CBD5E1]">
                {status === 'active' ? 'Rule Active' : 'Disabled'}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{alert ? 'Update Rule' : 'Create Alert'}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

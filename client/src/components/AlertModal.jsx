import React, { useState, useEffect } from 'react';
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
  CheckCircle2
} from 'lucide-react';

const CONDITIONS = [
  { value: 'greater_than', label: 'Greater Than (>)' },
  { value: 'less_than', label: 'Less Than (<)' },
  { value: 'equal', label: 'Equal To (=)' },
  { value: 'not_equal', label: 'Not Equal To (≠)' },
  { value: 'percent_increase', label: 'Percentage Increase (▲ %)' },
  { value: 'percent_decrease', label: 'Percentage Decrease (▼ %)' }
];

const SEVERITIES = [
  { value: 'low', label: 'Low', color: 'border-blue-200 bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  { value: 'medium', label: 'Medium', color: 'border-amber-200 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { value: 'high', label: 'High', color: 'border-orange-200 bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', color: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500' }
];

export default function AlertModal({
  isOpen,
  onClose,
  onSave,
  alert = null,
  metrics = []
}) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-xs p-4 sm:p-6 animate-fadeIn">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {alert ? 'Edit Alert Rule' : 'Create Real-Time Alert Rule'}
              </h2>
              <p className="text-xs text-slate-500">
                Set operational condition thresholds and notification rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Rule Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Alert Rule Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Critical Revenue Drop Alert"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Metric & Condition Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Metric Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Target Metric / KPI
              </label>
              <select
                value={metricId}
                onChange={(e) => setMetricId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-800 transition focus:border-blue-500 focus:bg-white focus:outline-none"
              >
                <option value="">-- Generic Organization Metric --</option>
                {metrics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.unit ? `(${m.unit})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Condition Expression */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Condition Trigger <span className="text-rose-500">*</span>
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-800 transition focus:border-blue-500 focus:bg-white focus:outline-none"
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Threshold & Cooldown Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Threshold Value */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Threshold Boundary <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  placeholder="e.g., 50000"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                  value
                </span>
              </div>
            </div>

            {/* Cooldown Period */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Anti-Flapping Cooldown (Minutes)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  placeholder="60"
                  value={cooldownMinutes}
                  onChange={(e) => setCooldownMinutes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                  mins
                </span>
              </div>
            </div>
          </div>

          {/* Severity Badges Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-2">
              Incident Severity Level
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {SEVERITIES.map((sev) => {
                const isSelected = severity === sev.value;
                return (
                  <button
                    key={sev.value}
                    type="button"
                    onClick={() => setSeverity(sev.value)}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-2 px-3 text-xs font-semibold transition ${
                      isSelected
                        ? `${sev.color} ring-2 ring-blue-500/20 shadow-xs`
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${sev.dot}`} />
                    <span>{sev.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notification Channels & Recipient Emails */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-blue-600" />
                <span>Notification Dispatch Channels</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleChannel('in_app')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                    notificationChannels.includes('in_app')
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  In-App Incident Center
                </button>
                <button
                  type="button"
                  onClick={() => toggleChannel('email')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                    notificationChannels.includes('email')
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Email Notification
                </button>
              </div>
            </div>

            {/* Email Recipients Input */}
            {notificationChannels.includes('email') && (
              <div className="pt-2 border-t border-slate-200/60 space-y-2">
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
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 hover:bg-blue-100 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                {/* Recipient Chips */}
                {recipients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {recipients.map((em) => (
                      <span
                        key={em}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-mono text-slate-700 shadow-2xs"
                      >
                        <span>{em}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(em)}
                          className="text-slate-400 hover:text-rose-600 transition"
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

          {/* Active / Disabled Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
            <div>
              <p className="text-xs font-semibold text-slate-800">Rule Activation Status</p>
              <p className="text-[11px] text-slate-500">
                {status === 'active' ? 'Rule is currently active and evaluated by background scheduler.' : 'Rule is disabled and will not evaluate or trigger.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStatus(status === 'active' ? 'disabled' : 'active')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                status === 'active' ? 'bg-blue-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  status === 'active' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
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
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

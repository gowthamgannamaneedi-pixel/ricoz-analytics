import React, { useState, useEffect } from 'react';
import { X, LayoutDashboard, Check, AlertCircle, Loader2, Star, Globe } from 'lucide-react';

/**
 * Enterprise Dashboard Create / Edit Modal
 */
export default function DashboardModal({
  isOpen,
  onClose,
  onSave,
  dashboard = null,
  isLoading = false
}) {
  const isEditing = Boolean(dashboard && dashboard.id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (dashboard) {
      setTitle(dashboard.title || '');
      setDescription(dashboard.description || '');
      setIsDefault(Boolean(dashboard.is_default));
      setIsPublic(Boolean(dashboard.is_public));
    } else {
      setTitle('');
      setDescription('');
      setIsDefault(false);
      setIsPublic(false);
    }
    setError('');
  }, [dashboard, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please provide a dashboard title.');
      return;
    }

    if (title.length > 255) {
      setError('Dashboard title must be under 255 characters.');
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      is_default: isDefault,
      is_public: isPublic
    };

    try {
      await onSave(payload);
    } catch (err) {
      setError(err.message || 'Failed to save dashboard.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {isEditing ? 'Edit Dashboard' : 'Create New Dashboard'}
              </h2>
              <p className="text-xs text-slate-500">
                {isEditing ? 'Update your dashboard configuration' : 'Configure layout and widgets for your team'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dashboard Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Executive Sales Performance"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summary of objectives and monitored KPIs for this dashboard..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Options: Default & Public Checkboxes */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50/70 transition cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Star className={`h-3.5 w-3.5 ${isDefault ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                  <span>Set as Default Organization Dashboard</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  This dashboard will open automatically when team members visit the overview page.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50/70 transition cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Globe className="h-3.5 w-3.5 text-slate-400" />
                  <span>Make Public / Shareable</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Allows viewing across authorized shared organization pipelines.
                </p>
              </div>
            </label>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50 shadow-xs"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>{isEditing ? 'Save Changes' : 'Create Dashboard'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

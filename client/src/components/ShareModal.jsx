import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Share2,
  Users,
  User,
  Shield,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  ChevronDown
} from 'lucide-react';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import {
  shareDashboardApi,
  getDashboardSharesApi,
  revokeDashboardShareApi,
  shareReportApi,
  getReportSharesApi,
  revokeReportShareApi,
  shareInsightApi,
  getInsightSharesApi,
  revokeInsightShareApi,
  getTeamsApi,
  getUsers
} from '../services/api';

/**
 * Reusable Enterprise Resource Share Modal
 * Supports sharing Dashboards, Reports, and AI Insights with specific users or teams.
 */
export default function ShareModal({
  isOpen,
  onClose,
  resourceType, // 'dashboard' | 'report' | 'insight'
  resourceId,
  resourceTitle = 'Resource'
}) {
  const [activeTab, setActiveTab] = useState('user'); // 'user' | 'team'
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [shares, setShares] = useState([]);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [permission, setPermission] = useState('viewer');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (isOpen && resourceId) {
      loadData();
    }
  }, [isOpen, resourceId, resourceType]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersRes, teamsRes] = await Promise.all([
        getUsers({ limit: 100 }).catch(() => ({ data: [] })),
        getTeamsApi().catch(() => ({ data: [] }))
      ]);

      setUsers(usersRes.data || []);
      setTeams(teamsRes.data || []);

      // Load existing shares based on resource type
      let sharesRes = { data: [] };
      if (resourceType === 'dashboard') {
        sharesRes = await getDashboardSharesApi(resourceId).catch(() => ({ data: [] }));
      } else if (resourceType === 'report') {
        sharesRes = await getReportSharesApi(resourceId).catch(() => ({ data: [] }));
      } else if (resourceType === 'insight') {
        sharesRes = await getInsightSharesApi(resourceId).catch(() => ({ data: [] }));
      }

      setShares(sharesRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load share settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    if (!selectedTargetId) {
      setError(`Please select a ${activeTab} to share with.`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      const payload = {
        targetUserId: activeTab === 'user' ? selectedTargetId : null,
        targetTeamId: activeTab === 'team' ? selectedTargetId : null,
        permission
      };

      if (resourceType === 'dashboard') {
        await shareDashboardApi(resourceId, payload);
      } else if (resourceType === 'report') {
        await shareReportApi(resourceId, payload);
      } else if (resourceType === 'insight') {
        await shareInsightApi(resourceId, payload);
      }

      setSuccessMsg('Access granted successfully.');
      setSelectedTargetId('');
      // Reload shares
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to share resource.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (shareId) => {
    try {
      if (resourceType === 'dashboard') {
        await revokeDashboardShareApi(resourceId, shareId);
      } else if (resourceType === 'report') {
        await revokeReportShareApi(resourceId, shareId);
      } else if (resourceType === 'insight' || resourceType === 'ai_insight') {
        await revokeInsightShareApi(resourceId, shareId);
      }
      setShares(shares.filter(s => s.id !== shareId));
      setSuccessMsg('Access revoked.');
    } catch (err) {
      setError(err.message || 'Failed to revoke access.');
    }
  };

  // Lock body scroll and handle Escape key while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = orig;
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 dark:bg-black/85 backdrop-blur-xs font-sans overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[#111827] text-slate-900 dark:text-[#F8FAFC] p-6 shadow-2xl border border-slate-200 dark:border-[#334155] my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-[#334155]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-[#FB7185] border border-rose-100 dark:border-rose-900/60">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-[#F8FAFC] text-sm">
                Share {resourceType ? resourceType.charAt(0).toUpperCase() + resourceType.slice(1) : 'Resource'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] truncate max-w-[280px]">{resourceTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-[#94A3B8] hover:text-slate-600 dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#1E293B] transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-[#2A1422] border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-[#FDA4AF]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-700 dark:text-emerald-300">
            <Check className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Share Form */}
        <form onSubmit={handleShare} className="mt-4 space-y-4">
          {/* Target Selector Tabs */}
          <div className="flex rounded-lg bg-slate-100 dark:bg-[#0F172A] p-1 text-xs border border-slate-200/80 dark:border-[#334155]">
            <button
              type="button"
              onClick={() => { setActiveTab('user'); setSelectedTargetId(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition cursor-pointer ${
                activeTab === 'user' ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-[#F8FAFC] shadow-2xs font-semibold' : 'text-slate-500 dark:text-[#94A3B8] hover:text-slate-700 dark:hover:text-[#CBD5E1]'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>Specific User</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('team'); setSelectedTargetId(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition cursor-pointer ${
                activeTab === 'team' ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-[#F8FAFC] shadow-2xs font-semibold' : 'text-slate-500 dark:text-[#94A3B8] hover:text-slate-700 dark:hover:text-[#CBD5E1]'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Workspace Team</span>
            </button>
          </div>

          {/* Target Dropdown & Role */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] mb-1">
                Select {activeTab === 'user' ? 'Organization User' : 'Team'}
              </label>
              <Select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                className="w-full"
              >
                <option value="">Choose {activeTab}...</option>
                {activeTab === 'user' ? (
                  users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) — {u.role?.toUpperCase()}
                    </option>
                  ))
                ) : (
                  teams.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.member_count || 0} members)
                    </option>
                  ))
                )}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] mb-1">Permission</label>
              <Select
                value={permission}
                onChange={(e) => setPermission(e.target.value)}
                className="w-full"
              >
                <option value="viewer">Viewer</option>
                {resourceType !== 'insight' && <option value="editor">Editor</option>}
              </Select>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !selectedTargetId}
            loading={submitting}
            className="w-full"
          >
            <Share2 className="h-4 w-4" />
            <span>Grant {permission.toUpperCase()} Access</span>
          </Button>
        </form>

        {/* Existing Shares List */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-[#334155]">
          <h4 className="text-xs font-semibold text-slate-900 dark:text-[#F8FAFC] mb-2">Current Shared Access ({shares.length})</h4>

          {loading ? (
            <div className="py-4 text-center text-xs text-slate-400 dark:text-[#94A3B8]">Loading access list...</div>
          ) : shares.length === 0 ? (
            <div className="py-3 text-center text-xs text-slate-400 dark:text-[#94A3B8] bg-slate-50 dark:bg-[#0F172A] rounded-lg border border-dashed border-slate-200 dark:border-[#334155]">
              Only workspace owners/admins currently have access.
            </div>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {shares.map(share => (
                <div
                  key={share.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-[#0F172A] border border-slate-200/70 dark:border-[#334155] text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {share.target_team_name ? (
                      <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    ) : (
                      <User className="h-4 w-4 text-rose-600 dark:text-[#FB7185] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-[#CBD5E1] truncate">
                        {share.target_team_name || share.target_user_name || 'Organization Member'}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-[#94A3B8] truncate">
                        {share.target_user_email || 'Team Shared'} · Shared by {share.shared_by_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      share.permission === 'editor'
                        ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80'
                        : 'bg-rose-50 dark:bg-[#2A1422] text-rose-700 dark:text-[#FDA4AF] border border-rose-200 dark:border-rose-900/80'
                    }`}>
                      {share.permission}
                    </span>
                    <button
                      onClick={() => handleRevoke(share.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-rose-400 hover:bg-red-50 dark:hover:bg-[#2A1422] transition cursor-pointer"
                      title="Revoke access"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

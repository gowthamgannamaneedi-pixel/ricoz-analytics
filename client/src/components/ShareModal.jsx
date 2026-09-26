import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Users,
  User,
  Shield,
  Trash2,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';
import {
  shareDashboardApi,
  getDashboardSharesApi,
  revokeDashboardShareApi,
  shareReportApi,
  getReportSharesApi,
  revokeReportShareApi,
  shareInsightApi,
  getInsightSharesApi,
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
      }
      setShares(shares.filter(s => s.id !== shareId));
      setSuccessMsg('Access revoked.');
    } catch (err) {
      setError(err.message || 'Failed to revoke access.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Share {resourceType.toUpperCase()}</h3>
              <p className="text-xs text-slate-500 truncate max-w-[280px]">{resourceTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
            <Check className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Share Form */}
        <form onSubmit={handleShare} className="mt-4 space-y-4">
          {/* Target Selector Tabs */}
          <div className="flex rounded-lg bg-slate-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => { setActiveTab('user'); setSelectedTargetId(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition ${
                activeTab === 'user' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>Specific User</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('team'); setSelectedTargetId(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition ${
                activeTab === 'team' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Workspace Team</span>
            </button>
          </div>

          {/* Target Dropdown & Role */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-slate-700 mb-1">
                Select {activeTab === 'user' ? 'Organization User' : 'Team'}
              </label>
              <select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
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
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Permission</label>
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              >
                <option value="viewer">Viewer</option>
                {resourceType !== 'insight' && <option value="editor">Editor</option>}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedTargetId}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            <span>Grant {permission.toUpperCase()} Access</span>
          </button>
        </form>

        {/* Existing Shares List */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-semibold text-slate-900 mb-2">Current Shared Access ({shares.length})</h4>

          {loading ? (
            <div className="py-4 text-center text-xs text-slate-400">Loading access list...</div>
          ) : shares.length === 0 ? (
            <div className="py-3 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              Only workspace owners/admins currently have access.
            </div>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {shares.map(share => (
                <div
                  key={share.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {share.target_team_name ? (
                      <Users className="h-4 w-4 text-indigo-600 shrink-0" />
                    ) : (
                      <User className="h-4 w-4 text-blue-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">
                        {share.target_team_name || share.target_user_name || 'Organization Member'}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {share.target_user_email || 'Team Shared'} · Shared by {share.shared_by_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      share.permission === 'editor'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {share.permission}
                    </span>
                    <button
                      onClick={() => handleRevoke(share.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
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
    </div>
  );
}

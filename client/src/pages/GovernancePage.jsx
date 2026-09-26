import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Users,
  Building2,
  FileText,
  Clock,
  Key,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Edit3,
  UserCheck,
  UserX,
  Lock,
  Layers,
  Sparkles,
  TrendingUp,
  Bell,
  Database,
  Calendar,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Info,
  Sliders,
  Check,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getAdminOrganization,
  updateAdminOrganization,
  getAdminStats,
  getAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
  getAdminAuditLogs,
  getAdminPermissions
} from '../services/api';

/**
 * Phase 13: Enterprise Governance, Workspace Management & Audit Trails
 */
export default function GovernancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager';

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Overview Data
  const [orgData, setOrgData] = useState(null);
  const [statsData, setStatsData] = useState(null);

  // Team / User Management Data
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userLimit] = useState(10);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userLoading, setUserLoading] = useState(false);

  // User Action Modals
  const [selectedUserForRole, setSelectedUserForRole] = useState(null);
  const [newRole, setNewRole] = useState('viewer');
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState(false);

  const [selectedUserForStatus, setSelectedUserForStatus] = useState(null);
  const [newStatus, setNewStatus] = useState('active');
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Audit Logs Data
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit] = useState(15);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditResourceFilter, setAuditResourceFilter] = useState('all');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);
  const [inspectMetadata, setInspectMetadata] = useState(null);

  // RBAC Permission Matrix Data
  const [permissionMatrix, setPermissionMatrix] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);

  // Organization Settings Form
  const [orgName, setOrgName] = useState('');
  const [orgTimezone, setOrgTimezone] = useState('UTC');
  const [orgDateFormat, setOrgDateFormat] = useState('YYYY-MM-DD');
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Clear toast notifications after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 7000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Load Organization & Overview Data
  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [orgRes, statsRes] = await Promise.all([
        getAdminOrganization().catch(() => null),
        getAdminStats().catch(() => null)
      ]);

      if (orgRes?.organization) {
        setOrgData(orgRes.organization);
        setOrgName(orgRes.organization.name || '');
        const s = orgRes.organization.settings || {};
        setOrgTimezone(s.timezone || 'UTC');
        setOrgDateFormat(s.dateFormat || 'YYYY-MM-DD');
      }

      if (statsRes?.stats) {
        setStatsData(statsRes.stats);
      } else if (orgRes?.organization?.stats) {
        setStatsData(orgRes.organization.stats);
      }
    } catch (err) {
      console.error('Failed to load overview:', err);
      setError('Could not load organization data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Team Members
  const loadUsers = useCallback(async () => {
    try {
      setUserLoading(true);
      const params = {
        page: userPage,
        limit: userLimit,
        search: userSearch.trim(),
        role: userRoleFilter,
        status: userStatusFilter
      };
      const res = await getAdminUsers(params);
      if (res?.data) {
        setUsers(res.data.users || []);
        setUsersTotal(res.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setUserLoading(false);
    }
  }, [userPage, userLimit, userSearch, userRoleFilter, userStatusFilter]);

  // Load Audit Logs
  const loadAuditLogs = useCallback(async () => {
    try {
      setAuditLoading(true);
      const params = {
        page: auditPage,
        limit: auditLimit,
        search: auditSearch.trim(),
        action: auditActionFilter,
        resourceType: auditResourceFilter,
        startDate: auditStartDate,
        endDate: auditEndDate
      };
      const res = await getAdminAuditLogs(params);
      if (res?.data) {
        setAuditLogs(res.data.logs || []);
        setAuditTotal(res.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage, auditLimit, auditSearch, auditActionFilter, auditResourceFilter, auditStartDate, auditEndDate]);

  // Load Permissions
  const loadPermissions = useCallback(async () => {
    try {
      const res = await getAdminPermissions();
      if (res?.data) {
        setPermissionMatrix(res.data.matrix || {});
        setUserPermissions(res.data.userPermissions || []);
      }
    } catch (err) {
      console.error('Failed to load permissions:', err);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    loadOverview();
    loadPermissions();
  }, [loadOverview, loadPermissions]);

  // Tab change triggers
  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab, loadUsers, loadAuditLogs]);

  // Handle Role Update
  const handleRoleUpdate = async () => {
    if (!selectedUserForRole) return;
    try {
      setRoleUpdating(true);
      const res = await updateAdminUserRole(selectedUserForRole.id, newRole);
      if (res.success) {
        setSuccessMessage(`User role successfully changed to "${newRole}".`);
        setRoleModalOpen(false);
        setSelectedUserForRole(null);
        loadUsers();
        loadOverview();
      } else {
        setError(res.message || 'Failed to update role.');
      }
    } catch (err) {
      setError(err.message || 'Error changing user role.');
    } finally {
      setRoleUpdating(false);
    }
  };

  // Handle Status Update
  const handleStatusUpdate = async () => {
    if (!selectedUserForStatus) return;
    try {
      setStatusUpdating(true);
      const res = await updateAdminUserStatus(selectedUserForStatus.id, newStatus);
      if (res.success) {
        setSuccessMessage(`User status successfully changed to "${newStatus}".`);
        setStatusModalOpen(false);
        setSelectedUserForStatus(null);
        loadUsers();
        loadOverview();
      } else {
        setError(res.message || 'Failed to update user status.');
      }
    } catch (err) {
      setError(err.message || 'Error changing user status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Handle Org Settings Save
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setError('Organization name cannot be empty.');
      return;
    }
    try {
      setSettingsSaving(true);
      const payload = {
        name: orgName.trim(),
        settings: {
          timezone: orgTimezone,
          dateFormat: orgDateFormat
        }
      };
      const res = await updateAdminOrganization(payload);
      if (res.success) {
        setSuccessMessage('Organization governance profile updated successfully.');
        setOrgData(res.organization);
      } else {
        setError(res.message || 'Failed to update organization settings.');
      }
    } catch (err) {
      setError(err.message || 'Error saving organization settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const getRoleBadge = (role) => {
    const r = (role || 'viewer').toLowerCase();
    switch (r) {
      case 'admin':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">Admin</span>;
      case 'manager':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">Manager</span>;
      case 'analyst':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Analyst</span>;
      case 'viewer':
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">Viewer</span>;
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || 'active').toLowerCase();
    switch (s) {
      case 'active':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Active</span>;
      case 'inactive':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"><span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>Inactive</span>;
      case 'deactivated':
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Deactivated</span>;
    }
  };

  const getActionBadge = (action) => {
    const act = (action || '').toUpperCase();
    if (act.includes('LOGIN') || act.includes('LOGOUT') || act.includes('REGISTER')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">{act}</span>;
    }
    if (act.includes('DELETE') || act.includes('DEACTIVAT')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">{act}</span>;
    }
    if (act.includes('CREATE') || act.includes('RESOLV')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{act}</span>;
    }
    if (act.includes('UPDATE') || act.includes('ROLE') || act.includes('STATUS')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">{act}</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">{act}</span>;
  };

  const roleDistribution = statsData?.roleDistribution || { admin: 1, manager: 0, analyst: 0, viewer: 0 };
  const totalMembers = statsData?.membersCount || 1;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Shield className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Workspace Governance & Audit Logs
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Enterprise tenant administration, team access controls, RBAC matrix, and immutable audit trails
              </p>
            </div>
          </div>
        </div>

        {orgData && (
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <Building2 className="w-5 h-5 text-slate-400" />
            <div>
              <div className="text-xs text-slate-400 font-medium">ORGANIZATION</div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {orgData.name}
              </div>
            </div>
            <span className="ml-2 px-2 py-0.5 text-xs font-semibold uppercase rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
              {orgData.plan || 'Enterprise'}
            </span>
          </div>
        )}
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Overview & Stats
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'users'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Team Members ({statsData?.membersCount ?? usersTotal})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'audit'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          Audit Trails
        </button>

        <button
          onClick={() => setActiveTab('permissions')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'permissions'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Key className="w-4 h-4" />
          RBAC Matrix
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'settings'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Governance Settings
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & STATS */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-400">Team Members</span>
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <Users className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {statsData?.membersCount ?? 0}
              </div>
              <div className="mt-1 text-xs text-emerald-600 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {statsData?.activeMembersCount ?? 0} Active accounts
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-400">Datasets Connected</span>
                <span className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                  <Database className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {statsData?.datasetsCount ?? 0}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Enterprise multi-tenant isolated
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-400">Dashboards & Reports</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <Layers className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {(statsData?.dashboardsCount || 0) + (statsData?.reportsCount || 0)}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {statsData?.dashboardsCount || 0} Dashboards • {statsData?.reportsCount || 0} Scheduled reports
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-400">ML & AI Telemetry</span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {(statsData?.forecastsCount || 0) + (statsData?.aiQueriesCount || 0)}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {statsData?.forecastsCount || 0} Forecasts • {statsData?.aiQueriesCount || 0} AI queries
              </div>
            </div>
          </div>

          {/* Role Distribution & Security Posture */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Role Distribution & Team Access
              </h3>
              <p className="text-xs text-slate-500">
                Visual breakdown of privileges assigned across members in this workspace
              </p>

              {/* Progress Bar */}
              <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div style={{ width: `${((roleDistribution.admin || 0) / totalMembers) * 100}%` }} className="bg-purple-500" title={`Admin: ${roleDistribution.admin}`} />
                <div style={{ width: `${((roleDistribution.manager || 0) / totalMembers) * 100}%` }} className="bg-blue-500" title={`Manager: ${roleDistribution.manager}`} />
                <div style={{ width: `${((roleDistribution.analyst || 0) / totalMembers) * 100}%` }} className="bg-amber-500" title={`Analyst: ${roleDistribution.analyst}`} />
                <div style={{ width: `${((roleDistribution.viewer || 0) / totalMembers) * 100}%` }} className="bg-slate-400" title={`Viewer: ${roleDistribution.viewer}`} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50">
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold">Administrators</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{roleDistribution.admin || 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Managers</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{roleDistribution.manager || 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50">
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Analysts</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{roleDistribution.analyst || 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-500 font-semibold">Viewers</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{roleDistribution.viewer || 0}</div>
                </div>
              </div>
            </div>

            {/* Governance Security Status */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-600" />
                Security & Isolation
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300">Tenant Isolation (RLS)</div>
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Enforced</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300">Immutable Audit Logs</div>
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300">Credential Scrubbing</div>
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Strict</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300">Current Session Role</div>
                  {getRoleBadge(user?.role)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEAM & USER MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden space-y-4 p-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                placeholder="Search member by name or email..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={userRoleFilter}
                onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1); }}
                className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="analyst">Analyst</option>
                <option value="viewer">Viewer</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => { setUserStatusFilter(e.target.value); setUserPage(1); }}
                className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="deactivated">Deactivated</option>
              </select>

              <button
                onClick={loadUsers}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                title="Refresh user list"
              >
                <RefreshCw className={`w-4 h-4 ${userLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Members Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs uppercase font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Active</th>
                  <th className="px-4 py-3">Joined Date</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-slate-400">
                      No members matched your search filter.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isSelf = Number(u.id) === Number(user?.id);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 font-bold flex items-center justify-center text-xs">
                              {u.name ? u.name.slice(0, 2).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                                {u.name}
                                {isSelf && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">You</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">{getRoleBadge(u.role)}</td>
                        <td className="px-4 py-3.5">{getStatusBadge(u.status)}</td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never logged in'}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-400">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedUserForRole(u);
                                  setNewRole(u.role || 'viewer');
                                  setRoleModalOpen(true);
                                }}
                                disabled={isSelf}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                                title={isSelf ? 'Cannot modify own role' : 'Change User Role'}
                              >
                                <Edit3 className="w-3 h-3" />
                                Role
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedUserForStatus(u);
                                  setNewStatus(u.status === 'active' ? 'deactivated' : 'active');
                                  setStatusModalOpen(true);
                                }}
                                disabled={isSelf}
                                className={`px-2.5 py-1 text-xs font-medium rounded-lg border flex items-center gap-1 ${
                                  u.status === 'active'
                                    ? 'border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/40'
                                    : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-950/40'
                                } disabled:opacity-40 disabled:cursor-not-allowed`}
                                title={isSelf ? 'Cannot deactivate own account' : u.status === 'active' ? 'Deactivate user' : 'Activate user'}
                              >
                                {u.status === 'active' ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                                {u.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
            <div>
              Showing {users.length} of {usersTotal} members
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                disabled={userPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2">Page {userPage}</span>
              <button
                onClick={() => setUserPage((p) => p + 1)}
                disabled={userPage * userLimit >= usersTotal}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AUDIT TRAILS */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 p-6">
          {/* Audit Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }}
                placeholder="Search action or description..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={auditActionFilter}
              onChange={(e) => { setAuditActionFilter(e.target.value); setAuditPage(1); }}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Actions</option>
              <option value="USER_LOGIN">User Login</option>
              <option value="USER_ROLE_CHANGED">Role Changed</option>
              <option value="USER_STATUS_CHANGED">Status Changed</option>
              <option value="DASHBOARD_CREATED">Dashboard Created</option>
              <option value="DASHBOARD_UPDATED">Dashboard Updated</option>
              <option value="DASHBOARD_DELETED">Dashboard Deleted</option>
              <option value="REPORT_CREATED">Report Created</option>
              <option value="REPORT_RUN">Report Run</option>
              <option value="ALERT_CREATED">Alert Created</option>
              <option value="ALERT_RESOLVED">Alert Resolved</option>
              <option value="FORECAST_GENERATED">Forecast Generated</option>
              <option value="AI_QUERY">AI Query</option>
              <option value="ORGANIZATION_UPDATED">Org Updated</option>
            </select>

            <select
              value={auditResourceFilter}
              onChange={(e) => { setAuditResourceFilter(e.target.value); setAuditPage(1); }}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Resources</option>
              <option value="auth">Auth</option>
              <option value="user">User</option>
              <option value="dashboard">Dashboard</option>
              <option value="report">Report</option>
              <option value="alert">Alert</option>
              <option value="forecast">Forecast</option>
              <option value="ai">AI</option>
              <option value="organization">Organization</option>
            </select>

            <button
              onClick={loadAuditLogs}
              className="px-3 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${auditLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Audit Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs uppercase font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-xs">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-sans">
                      No audit events recorded for current filter criteria.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="px-4 py-3 font-sans whitespace-nowrap">
                        {log.user_email ? (
                          <div>
                            <span className="font-medium text-slate-900 dark:text-white">{log.user_name || log.user_email}</span>
                            <span className="text-slate-400 text-xs block">{log.user_email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">System Actor</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] uppercase">
                          {log.resource_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans max-w-xs sm:max-w-md truncate text-slate-700 dark:text-slate-300">
                        {log.description}
                      </td>
                      <td className="px-4 py-3 text-right font-sans">
                        <button
                          onClick={() => setInspectMetadata(log)}
                          className="px-2 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          View Meta
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Audit Pagination */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
            <div>
              Showing {auditLogs.length} of {auditTotal} audit events
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                disabled={auditPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2">Page {auditPage}</span>
              <button
                onClick={() => setAuditPage((p) => p + 1)}
                disabled={auditPage * auditLimit >= auditTotal}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: RBAC PERMISSION MATRIX */}
      {/* ========================================================================= */}
      {activeTab === 'permissions' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-600" />
              Enterprise Role-Based Access Control (RBAC) Matrix
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Centralized capability mapping defining operational boundaries across all roles in RicozAnalytics.
            </p>
          </div>

          {permissionMatrix && Object.keys(permissionMatrix).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(permissionMatrix).map(([category, perms]) => (
                <div key={category} className="space-y-2">
                  <div className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1">
                    {category} Capabilities
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Capability / Permission</th>
                          <th className="px-4 py-2.5 text-center w-24">Admin</th>
                          <th className="px-4 py-2.5 text-center w-24">Manager</th>
                          <th className="px-4 py-2.5 text-center w-24">Analyst</th>
                          <th className="px-4 py-2.5 text-center w-24">Viewer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {perms.map((p) => {
                          const hasCallerPerm = userPermissions.includes(p.key);
                          return (
                            <tr key={p.key} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 ${hasCallerPerm ? 'bg-indigo-50/20' : ''}`}>
                              <td className="px-4 py-2.5">
                                <div className="font-medium text-slate-900 dark:text-white text-xs">{p.label}</div>
                                <div className="text-[11px] font-mono text-slate-400">{p.key}</div>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {p.roles.admin ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {p.roles.manager ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {p.roles.analyst ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {p.roles.viewer ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400">Loading permission schema...</div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: GOVERNANCE SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-6 max-w-2xl">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600" />
              Organization & Workspace Profile
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Configure global defaults, regional timestamps, and security policies for this tenant.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                Organization Name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!isAdmin}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                placeholder="E.g. Ricoz Primary Organization"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                  Default Timezone
                </label>
                <select
                  value={orgTimezone}
                  onChange={(e) => setOrgTimezone(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                  Date Format
                </label>
                <select
                  value={orgDateFormat}
                  onChange={(e) => setOrgDateFormat(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              {isAdmin ? (
                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs disabled:opacity-50 flex items-center gap-2"
                >
                  {settingsSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Save Governance Settings
                </button>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  * Only workspace Administrators can modify organization governance settings.
                </div>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHANGE USER ROLE */}
      {/* ========================================================================= */}
      {roleModalOpen && selectedUserForRole && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                Update Team Role
              </h3>
              <button onClick={() => setRoleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300">
              Change role for <strong className="text-slate-900 dark:text-white">{selectedUserForRole.name}</strong> ({selectedUserForRole.email})
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase text-slate-500">
                Select Assigned Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="admin">Administrator (Universal Full Access)</option>
                <option value="manager">Manager (Create/Edit, Reports, Alerts, Audit View)</option>
                <option value="analyst">Analyst (Dashboards, Datasets, Predictions)</option>
                <option value="viewer">Viewer (Read-Only Consumption)</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Role changes take effect immediately on next API request and will generate a high-priority audit event.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRoleUpdate}
                disabled={roleUpdating}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 flex items-center gap-2"
              >
                {roleUpdating && <RefreshCw className="w-4 h-4 animate-spin" />}
                Confirm Role Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHANGE USER STATUS */}
      {/* ========================================================================= */}
      {statusModalOpen && selectedUserForStatus && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {newStatus === 'active' ? <UserCheck className="w-5 h-5 text-emerald-600" /> : <UserX className="w-5 h-5 text-rose-600" />}
                {newStatus === 'active' ? 'Activate Account' : 'Deactivate Account'}
              </h3>
              <button onClick={() => setStatusModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to {newStatus === 'active' ? 'activate' : 'deactivate'} access for{' '}
              <strong className="text-slate-900 dark:text-white">{selectedUserForStatus.name}</strong> ({selectedUserForStatus.email})?
            </p>

            {newStatus !== 'active' && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-800 dark:text-rose-300">
                The user will be immediately barred from logging in or performing any workspace API actions until re-activated.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStatusUpdate}
                disabled={statusUpdating}
                className={`px-4 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-50 flex items-center gap-2 ${
                  newStatus === 'active' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {statusUpdating && <RefreshCw className="w-4 h-4 animate-spin" />}
                Confirm {newStatus === 'active' ? 'Activation' : 'Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INSPECT AUDIT METADATA */}
      {/* ========================================================================= */}
      {inspectMetadata && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 font-mono">
                <Info className="w-5 h-5 text-indigo-600" />
                Audit Metadata Details
              </h3>
              <button onClick={() => setInspectMetadata(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-medium">Action</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{inspectMetadata.action}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-medium">Actor</span>
                <span className="text-slate-800 dark:text-slate-200">{inspectMetadata.user_email || 'System'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-medium">Client IP</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">{inspectMetadata.ip_address || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-medium">User Agent</span>
                <span className="text-slate-600 dark:text-slate-400 max-w-xs truncate">{inspectMetadata.user_agent || 'N/A'}</span>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Sanitized Payload</div>
              <pre className="p-3 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-48">
                {JSON.stringify(inspectMetadata.metadata || {}, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectMetadata(null)}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

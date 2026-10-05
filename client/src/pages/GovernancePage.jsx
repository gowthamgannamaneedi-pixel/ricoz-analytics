import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Users,
  Building2,
  FileText,
  Clock,
  Key,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  Edit3,
  UserCheck,
  UserX,
  Lock,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Info,
  Sliders,
  Check,
  X,
  Database,
  Crown,
  Eye,
  BarChart3,
  TrendingUp,
  User,
  GitBranch
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
 * Enterprise Governance, Workspace Management & Audit Trails
 * Light enterprise SaaS redesign matching exact reference layout and specs
 */
export default function GovernancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

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
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">Admin</span>;
      case 'manager':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Manager</span>;
      case 'analyst':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Analyst</span>;
      case 'viewer':
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Viewer</span>;
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || 'active').toLowerCase();
    switch (s) {
      case 'active':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Active</span>;
      case 'inactive':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Inactive</span>;
      case 'deactivated':
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Deactivated</span>;
    }
  };

  const getActionBadge = (action) => {
    const act = (action || '').toUpperCase();
    if (act.includes('LOGIN') || act.includes('LOGOUT') || act.includes('REGISTER')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">{act}</span>;
    }
    if (act.includes('DELETE') || act.includes('DEACTIVAT')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">{act}</span>;
    }
    if (act.includes('CREATE') || act.includes('RESOLV')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">{act}</span>;
    }
    if (act.includes('UPDATE') || act.includes('ROLE') || act.includes('STATUS')) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">{act}</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">{act}</span>;
  };

  const roleDistribution = statsData?.roleDistribution || { admin: 1, manager: 0, analyst: 0, viewer: 0 };
  const totalMembers = statsData?.membersCount || (
    (roleDistribution.admin || 0) +
    (roleDistribution.manager || 0) +
    (roleDistribution.analyst || 0) +
    (roleDistribution.viewer || 0)
  ) || 1;

  const adminPct = Math.round(((roleDistribution.admin || 0) / totalMembers) * 100);
  const managerPct = Math.round(((roleDistribution.manager || 0) / totalMembers) * 100);
  const analystPct = Math.round(((roleDistribution.analyst || 0) / totalMembers) * 100);
  const viewerPct = Math.max(0, 100 - adminPct - managerPct - analystPct);

  return (
    <div className="w-full max-w-full space-y-6 pb-10">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP BANNER: Deep Enterprise Navy Gradient with Shield & Org */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0d1e3a] via-[#102a54] to-[#0c192e] p-6 sm:p-7 md:p-8 text-white shadow-md border border-slate-800/60">
        {/* Subtle Skyscraper Architecture Watermark Graphic */}
        <div className="absolute right-0 top-0 bottom-0 w-2/5 pointer-events-none opacity-20 overflow-hidden hidden sm:block">
          <svg className="w-full h-full object-cover" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M120 0 L260 200 L400 200 L400 0 Z" fill="#1e3a8a" opacity="0.3" />
            <path d="M200 0 L320 200 L400 200 L400 0 Z" fill="#2563eb" opacity="0.4" />
            <line x1="80" y1="0" x2="220" y2="200" stroke="#60a5fa" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
            <line x1="140" y1="0" x2="280" y2="200" stroke="#60a5fa" strokeWidth="1" opacity="0.3" />
            <line x1="200" y1="0" x2="340" y2="200" stroke="#60a5fa" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
            <rect x="230" y="30" width="24" height="16" rx="2" fill="#93c5fd" opacity="0.3" />
            <rect x="265" y="30" width="24" height="16" rx="2" fill="#93c5fd" opacity="0.5" />
            <rect x="300" y="30" width="24" height="16" rx="2" fill="#93c5fd" opacity="0.2" />
            <rect x="230" y="60" width="24" height="16" rx="2" fill="#93c5fd" opacity="0.6" />
            <rect x="265" y="60" width="24" height="16" rx="2" fill="#93c5fd" opacity="0.3" />
            <rect x="300" y="60" width="24" height="16" rx="2" fill="#93c5fd" opacity="0.4" />
            <rect x="230" y="90" width="24" height="16" rx="2" fill="#93c5fd" opacity="0.2" />
            <rect x="265" y="90" width="24" height="16" rx="2" fill="#93c5fd" opacity="0.6" />
            <rect x="300" y="90" width="24" height="16" rx="2" fill="#93c5fd" opacity="0.3" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Left: Shield Icon + Title + Subtitle */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-900/40 shrink-0 border border-blue-400/30">
              <Shield className="w-7 h-7 text-white" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Workspace Governance & Audit Logs
              </h1>
              <p className="text-xs sm:text-sm text-blue-200/80 mt-1 max-w-2xl font-normal leading-relaxed">
                Enterprise tenant administration, team access controls, RBAC matrix, and immutable audit trails
              </p>
            </div>
          </div>

          {/* Right: Organization Glassmorphic Card */}
          <div className="flex items-center gap-3.5 bg-white/[0.08] hover:bg-white/[0.12] transition-colors backdrop-blur-md border border-white/10 rounded-xl px-4 py-2.5 shadow-xs shrink-0 self-start lg:self-auto">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-blue-200/70 tracking-wider uppercase">
                ORGANIZATION
              </div>
              <div className="text-sm font-bold text-white tracking-tight">
                {orgData?.name || 'Ricoz Primary Organization'}
              </div>
            </div>
            <span className="ml-2 px-3 py-1 text-[11px] font-bold tracking-wide uppercase rounded-md bg-blue-600 text-white shadow-xs shrink-0">
              {orgData?.plan ? String(orgData.plan).toUpperCase() : 'ENTERPRISE'}
            </span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. NAVIGATION TABS: Clean Light Line with Active Indicator    */}
      {/* ------------------------------------------------------------- */}
      <div className="border-b border-slate-200 w-full overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-6 sm:gap-8 min-w-max pb-px">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 py-3 px-1 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Overview & Stats
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 py-3 px-1 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            Team Members ({statsData?.membersCount ?? usersTotal})
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 py-3 px-1 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'audit'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            Audit Trails
          </button>

          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex items-center gap-2 py-3 px-1 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'permissions'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            RBAC Matrix
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 py-3 px-1 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'settings'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Governance Settings
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & STATS                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 4 KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* Card 1: TEAM MEMBERS */}
            <div
              onClick={() => setActiveTab('users')}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between hover:shadow-md hover:border-blue-200 transition-all duration-200 group cursor-pointer"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    TEAM MEMBERS
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {statsData?.membersCount ?? 0}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>{statsData?.activeMembersCount ?? 0} Active accounts</span>
                  </div>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors shrink-0 ml-2">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>

            {/* Card 2: DATASETS CONNECTED */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between hover:shadow-md hover:border-purple-200 transition-all duration-200 group">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Database className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    DATASETS CONNECTED
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {statsData?.datasetsCount ?? 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    Enterprise multi-tenant isolated
                  </div>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-blue-600 group-hover:bg-purple-50 group-hover:text-purple-700 transition-colors shrink-0 ml-2">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>

            {/* Card 3: DASHBOARDS & REPORTS */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between hover:shadow-md hover:border-emerald-200 transition-all duration-200 group">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Layers className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    DASHBOARDS & REPORTS
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {(statsData?.dashboardsCount || 0) + (statsData?.reportsCount || 0)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    {statsData?.dashboardsCount || 0} Dashboards • {statsData?.reportsCount || 0} Scheduled reports
                  </div>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-blue-600 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors shrink-0 ml-2">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>

            {/* Card 4: ML & AI TELEMETRY */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between hover:shadow-md hover:border-amber-200 transition-all duration-200 group">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    ML & AI TELEMETRY
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {(statsData?.forecastsCount || 0) + (statsData?.aiQueriesCount || 0)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    {statsData?.forecastsCount || 0} Forecasts • {statsData?.aiQueriesCount || 0} AI queries
                  </div>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-blue-600 group-hover:bg-amber-50 group-hover:text-amber-700 transition-colors shrink-0 ml-2">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Lower Two-Column Section: Role Distribution (8 cols) & Security & Isolation (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Role Distribution & Team Access */}
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-blue-600" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Role Distribution & Team Access
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Visual breakdown of privileges assigned across members in this workspace
              </p>

              {/* Multi-segment Progress Bar */}
              <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex mt-6 gap-0.5">
                <div
                  style={{ width: `${Math.max(adminPct, roleDistribution.admin ? 4 : 0)}%` }}
                  className="bg-[#8b5cf6] transition-all duration-300"
                  title={`Administrators: ${roleDistribution.admin || 0} (${adminPct}%)`}
                />
                <div
                  style={{ width: `${Math.max(managerPct, roleDistribution.manager ? 4 : 0)}%` }}
                  className="bg-[#3b82f6] transition-all duration-300"
                  title={`Managers: ${roleDistribution.manager || 0} (${managerPct}%)`}
                />
                <div
                  style={{ width: `${Math.max(analystPct, roleDistribution.analyst ? 4 : 0)}%` }}
                  className="bg-[#f59e0b] transition-all duration-300"
                  title={`Analysts: ${roleDistribution.analyst || 0} (${analystPct}%)`}
                />
                <div
                  style={{ width: `${Math.max(viewerPct, roleDistribution.viewer ? 4 : 0)}%` }}
                  className="bg-[#cbd5e1] transition-all duration-300"
                  title={`Viewers: ${roleDistribution.viewer || 0} (${viewerPct}%)`}
                />
              </div>

              {/* 4 Role Sub-Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                {/* Administrators */}
                <div className="bg-gradient-to-br from-purple-50/60 via-white to-purple-50/20 border border-purple-100/90 rounded-2xl p-4.5 relative overflow-hidden">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700">
                    <Crown className="w-4 h-4 text-purple-600" />
                    <span>Administrators</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2.5">
                    {roleDistribution.admin || 0}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {adminPct}% of team
                  </div>
                  {/* Subtle Wave Silhouette */}
                  <svg className="absolute -bottom-2 -right-2 w-20 h-16 pointer-events-none opacity-20" viewBox="0 0 100 60" fill="none">
                    <path d="M0 60 C30 40 70 50 100 20 L100 60 Z" fill="#8b5cf6" />
                  </svg>
                </div>

                {/* Managers */}
                <div className="bg-gradient-to-br from-blue-50/60 via-white to-blue-50/20 border border-blue-100/90 rounded-2xl p-4.5 relative overflow-hidden">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>Managers</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2.5">
                    {roleDistribution.manager || 0}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {managerPct}% of team
                  </div>
                  <svg className="absolute -bottom-2 -right-2 w-20 h-16 pointer-events-none opacity-20" viewBox="0 0 100 60" fill="none">
                    <path d="M0 60 C30 40 70 50 100 20 L100 60 Z" fill="#3b82f6" />
                  </svg>
                </div>

                {/* Analysts */}
                <div className="bg-gradient-to-br from-amber-50/60 via-white to-amber-50/20 border border-amber-100/90 rounded-2xl p-4.5 relative overflow-hidden">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                    <span>Analysts</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2.5">
                    {roleDistribution.analyst || 0}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {analystPct}% of team
                  </div>
                  <svg className="absolute -bottom-2 -right-2 w-20 h-16 pointer-events-none opacity-20" viewBox="0 0 100 60" fill="none">
                    <path d="M0 60 C30 40 70 50 100 20 L100 60 Z" fill="#f59e0b" />
                  </svg>
                </div>

                {/* Viewers */}
                <div className="bg-gradient-to-br from-slate-50/80 via-white to-slate-100/30 border border-slate-200/80 rounded-2xl p-4.5 relative overflow-hidden">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <Eye className="w-4 h-4 text-slate-500" />
                    <span>Viewers</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2.5">
                    {roleDistribution.viewer || 0}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {viewerPct}% of team
                  </div>
                  <svg className="absolute -bottom-2 -right-2 w-20 h-16 pointer-events-none opacity-20" viewBox="0 0 100 60" fill="none">
                    <path d="M0 60 C30 40 70 50 100 20 L100 60 Z" fill="#64748b" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Right Column: Security & Isolation */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Security & Isolation
                  </h2>
                </div>

                <div className="space-y-3 mt-6">
                  {/* Row 1: Tenant Isolation (RLS) */}
                  <div className="bg-slate-50/70 hover:bg-slate-100/60 border border-slate-100 rounded-xl px-4 py-3.5 flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <Lock className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-xs font-medium text-slate-800 truncate">
                        Tenant Isolation (RLS)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        Enforced
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>

                  {/* Row 2: Immutable Audit Logs */}
                  <div
                    onClick={() => setActiveTab('audit')}
                    className="bg-slate-50/70 hover:bg-slate-100/60 border border-slate-100 rounded-xl px-4 py-3.5 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-xs font-medium text-slate-800 truncate">
                        Immutable Audit Logs
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        Active
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>

                  {/* Row 3: Credential Scrubbing */}
                  <div className="bg-slate-50/70 hover:bg-slate-100/60 border border-slate-100 rounded-xl px-4 py-3.5 flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <Database className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-xs font-medium text-slate-800 truncate">
                        Credential Scrubbing
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                        Strict
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>

                  {/* Row 4: Current Session Role */}
                  <div
                    onClick={() => setActiveTab('permissions')}
                    className="bg-slate-50/70 hover:bg-slate-100/60 border border-slate-100 rounded-xl px-4 py-3.5 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <User className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-xs font-medium text-slate-800 truncate">
                        Current Session Role
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/60 capitalize">
                        {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEAM & USER MANAGEMENT                                             */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                placeholder="Search member by name or email..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={userRoleFilter}
                onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1); }}
                className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors"
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
                className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="deactivated">Deactivated</option>
              </select>

              <button
                onClick={loadUsers}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                title="Refresh user list"
              >
                <RefreshCw className={`w-4 h-4 ${userLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Members Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Active</th>
                  <th className="px-4 py-3">Joined Date</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                              {u.name ? u.name.slice(0, 2).toUpperCase() : 'U'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5 truncate">
                                {u.name}
                                {isSelf && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">You</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 truncate">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">{getRoleBadge(u.role)}</td>
                        <td className="px-4 py-3.5">{getStatusBadge(u.status)}</td>
                        <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never logged in'}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedUserForRole(u);
                                  setNewRole(u.role || 'viewer');
                                  setRoleModalOpen(true);
                                }}
                                disabled={isSelf}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
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
                                className={`px-2.5 py-1 text-xs font-medium rounded-lg border flex items-center gap-1 transition-colors ${
                                  u.status === 'active'
                                    ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                                    : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
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
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium">Page {userPage}</span>
              <button
                onClick={() => setUserPage((p) => p + 1)}
                disabled={userPage * userLimit >= usersTotal}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AUDIT TRAILS                                                       */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-4 p-6">
          {/* Audit Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }}
                placeholder="Search action or description..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>

            <select
              value={auditActionFilter}
              onChange={(e) => { setAuditActionFilter(e.target.value); setAuditPage(1); }}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors"
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
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors"
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
              className="px-3 py-2 text-sm font-medium rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${auditLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Audit Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-sans">
                      No audit events recorded for current filter criteria.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-sans text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="px-4 py-3 font-sans whitespace-nowrap">
                        {log.user_email ? (
                          <div>
                            <span className="font-semibold text-slate-900">{log.user_name || log.user_email}</span>
                            <span className="text-slate-400 text-xs block">{log.user_email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">System Actor</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px] uppercase font-sans font-medium">
                          {log.resource_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans max-w-xs sm:max-w-md truncate text-slate-700">
                        {log.description}
                      </td>
                      <td className="px-4 py-3 text-right font-sans">
                        <button
                          onClick={() => setInspectMetadata(log)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
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
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium">Page {auditPage}</span>
              <button
                onClick={() => setAuditPage((p) => p + 1)}
                disabled={auditPage * auditLimit >= auditTotal}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: RBAC PERMISSION MATRIX                                             */}
      {/* ========================================================================= */}
      {activeTab === 'permissions' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" />
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
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">
                    {category} Capabilities
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5">Capability / Permission</th>
                          <th className="px-4 py-2.5 text-center w-28">Admin</th>
                          <th className="px-4 py-2.5 text-center w-28">Manager</th>
                          <th className="px-4 py-2.5 text-center w-28">Analyst</th>
                          <th className="px-4 py-2.5 text-center w-28">Viewer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {perms.map((p) => {
                          const hasCallerPerm = userPermissions.includes(p.key);
                          return (
                            <tr key={p.key} className={`hover:bg-slate-50/70 transition-colors ${hasCallerPerm ? 'bg-blue-50/20' : ''}`}>
                              <td className="px-4 py-2.5">
                                <div className="font-semibold text-slate-900 text-xs">{p.label}</div>
                                <div className="text-[11px] font-mono text-slate-400">{p.key}</div>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {p.roles.admin ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Check className="w-3 h-3 text-emerald-600" /> Allowed
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                    <X className="w-3 h-3 text-slate-400" /> Denied
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {p.roles.manager ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Check className="w-3 h-3 text-emerald-600" /> Allowed
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                    <X className="w-3 h-3 text-slate-400" /> Denied
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {p.roles.analyst ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Check className="w-3 h-3 text-emerald-600" /> Allowed
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                    <X className="w-3 h-3 text-slate-400" /> Denied
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {p.roles.viewer ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Check className="w-3 h-3 text-emerald-600" /> Allowed
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                    <X className="w-3 h-3 text-slate-400" /> Denied
                                  </span>
                                )}
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
      {/* TAB 5: GOVERNANCE SETTINGS                                                */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-7 space-y-6 max-w-2xl">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-600" />
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
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
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
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
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
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
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
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs disabled:opacity-50 flex items-center gap-2 transition-colors"
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
      {/* MODAL: CHANGE USER ROLE                                                   */}
      {/* ========================================================================= */}
      {roleModalOpen && selectedUserForRole && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                Update Team Role
              </h3>
              <button onClick={() => setRoleModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Change role for <strong className="text-slate-900 font-semibold">{selectedUserForRole.name}</strong> ({selectedUserForRole.email})
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase text-slate-500">
                Select Assigned Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="admin">Administrator (Universal Full Access)</option>
                <option value="manager">Manager (Create/Edit, Reports, Alerts, Audit View)</option>
                <option value="analyst">Analyst (Dashboards, Datasets, Predictions)</option>
                <option value="viewer">Viewer (Read-Only Consumption)</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Role changes take effect immediately on next API request and will generate a high-priority audit event.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRoleUpdate}
                disabled={roleUpdating}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center gap-2 shadow-xs transition-colors"
              >
                {roleUpdating && <RefreshCw className="w-4 h-4 animate-spin" />}
                Confirm Role Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHANGE USER STATUS                                                 */}
      {/* ========================================================================= */}
      {statusModalOpen && selectedUserForStatus && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {newStatus === 'active' ? <UserCheck className="w-5 h-5 text-emerald-600" /> : <UserX className="w-5 h-5 text-rose-600" />}
                {newStatus === 'active' ? 'Activate Account' : 'Deactivate Account'}
              </h3>
              <button onClick={() => setStatusModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Are you sure you want to {newStatus === 'active' ? 'activate' : 'deactivate'} access for{' '}
              <strong className="text-slate-900 font-semibold">{selectedUserForStatus.name}</strong> ({selectedUserForStatus.email})?
            </p>

            {newStatus !== 'active' && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                The user will be immediately barred from logging in or performing any workspace API actions until re-activated.
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStatusUpdate}
                disabled={statusUpdating}
                className={`px-4 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-50 flex items-center gap-2 shadow-xs transition-colors ${
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
      {/* MODAL: INSPECT AUDIT METADATA                                             */}
      {/* ========================================================================= */}
      {inspectMetadata && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600" />
                Audit Metadata Details
              </h3>
              <button onClick={() => setInspectMetadata(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Action</span>
                <span className="font-semibold text-slate-800">{inspectMetadata.action}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Actor</span>
                <span className="text-slate-800 font-medium">{inspectMetadata.user_email || 'System'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Client IP</span>
                <span className="font-mono text-slate-600">{inspectMetadata.ip_address || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium">User Agent</span>
                <span className="text-slate-600 max-w-xs truncate">{inspectMetadata.user_agent || 'N/A'}</span>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Sanitized Payload</div>
              <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto max-h-48">
                {JSON.stringify(inspectMetadata.metadata || {}, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectMetadata(null)}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
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

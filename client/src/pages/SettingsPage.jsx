import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Users,
  Building2,
  Database,
  Layers,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  Edit3,
  Plug,
  Bell,
  Sliders,
  Check,
  X,
  Copy,
  ExternalLink,
  HelpCircle,
  Mail,
  Globe,
  ArrowRight,
  ChevronRight,
  Zap,
  Clock,
  Sparkles,
  Info,
  Laptop,
  CheckCircle,
  Radio,
  FileText,
  UserPlus,
  Plus
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getAdminOrganization,
  updateAdminOrganization,
  getAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
  getAdminAuditLogs,
  getDatasets,
  getDashboards,
  getReports,
  getAlerts,
  createAdminInvitation,
  getAdminInvitations,
  deleteAdminInvitation,
  API_BASE_URL
} from '../services/api';
import { Button } from '../components/ui/Button';

/**
 * Enterprise Settings Page — RicozAnalytics
 * Organization configuration, team access, integrations, notifications, and platform preferences.
 */
export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isAdmin = user?.role === 'admin';
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Synchronize URL search params with active tab
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'overview' ? {} : { tab });
  };

  // --------------------------------------------------------------------------
  // Real Data State
  // --------------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Organization & Aggregated Telemetry
  const [organization, setOrganization] = useState(null);
  const [stats, setStats] = useState({
    membersCount: 0,
    activeMembersCount: 0,
    datasetsCount: 0,
    dashboardsCount: 0,
    reportsCount: 0,
    alertsCount: 0
  });

  // Users Roster
  const [usersList, setUsersList] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  // Recent Activity from Audit Logs
  const [recentLogs, setRecentLogs] = useState([]);

  // System Health Status
  const [healthStatus, setHealthStatus] = useState('Healthy');
  const [systemUptime, setSystemUptime] = useState(null);

  // --------------------------------------------------------------------------
  // Modals State
  // --------------------------------------------------------------------------
  const [isEditOrgModalOpen, setIsEditOrgModalOpen] = useState(false);
  const [editOrgName, setEditOrgName] = useState('');
  const [editOrgRegion, setEditOrgRegion] = useState('Mumbai (ap-south-1)');
  const [editOrgCurrency, setEditOrgCurrency] = useState('INR');
  const [editOrgTimezone, setEditOrgTimezone] = useState('Asia/Kolkata');
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState([]);

  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Copied indicator
  const [copiedId, setCopiedId] = useState(false);

  // --------------------------------------------------------------------------
  // Preferences State (Stored in Organization settings or localStorage)
  // --------------------------------------------------------------------------
  const [preferences, setPreferences] = useState(() => {
    return {
      defaultLandingPage: localStorage.getItem('ricoz_pref_landing') || '/dashboard',
      tableDensity: localStorage.getItem('ricoz_pref_density') || 'comfortable',
      refreshInterval: localStorage.getItem('ricoz_pref_refresh') || 'realtime',
      numberFormat: localStorage.getItem('ricoz_pref_numformat') || 'inr_lakhs'
    };
  });

  // --------------------------------------------------------------------------
  // Notifications State
  // --------------------------------------------------------------------------
  const [notifSettings, setNotifSettings] = useState({
    emailExecutiveDigest: true,
    emailAlertThresholds: true,
    emailReportGenerated: true,
    inAppCollaboration: true,
    inAppSystemNotices: true,
    smtpGatewayActive: true
  });
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);

  // Auto-dismiss feedback banners
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // --------------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------------
  const loadSettingsData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [orgRes, usersRes, logsRes, healthRes, invitesRes] = await Promise.all([
        getAdminOrganization().catch(() => null),
        getAdminUsers().catch(() => null),
        getAdminAuditLogs({ limit: 6 }).catch(() => null),
        fetch(`${API_BASE_URL}/health`).then(r => r.json()).catch(() => null),
        getAdminInvitations().catch(() => null)
      ]);

      if (invitesRes && invitesRes.invitations) {
        setPendingInvitations(invitesRes.invitations);
      }

      if (orgRes && orgRes.organization) {
        setOrganization(orgRes.organization);
        setEditOrgName(orgRes.organization.name || '');
        const s = orgRes.organization.settings || {};
        if (s.region) setEditOrgRegion(s.region);
        if (s.currency) setEditOrgCurrency(s.currency);
        if (s.timezone) setEditOrgTimezone(s.timezone);
        if (s.notifications) {
          setNotifSettings(prev => ({ ...prev, ...s.notifications }));
        }

        if (orgRes.organization.stats) {
          setStats(prev => ({ ...prev, ...orgRes.organization.stats }));
        }
      }

      if (usersRes && usersRes.data?.users) {
        setUsersList(usersRes.data.users);
        setStats(prev => ({
          ...prev,
          membersCount: usersRes.data.users.length,
          activeMembersCount: usersRes.data.users.filter(u => u.status === 'active').length
        }));
      }

      if (logsRes && logsRes.data?.logs) {
        setRecentLogs(logsRes.data.logs);
      }

      if (healthRes && healthRes.status === 'healthy') {
        setHealthStatus('Healthy');
        setSystemUptime(healthRes.uptime_seconds);
      }
    } catch (err) {
      console.error('[SettingsPage] Error loading settings data:', err);
      setError(err.message || 'Failed to load organization settings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSettingsData();
  }, [loadSettingsData]);

  // --------------------------------------------------------------------------
  // Actions: Save Organization
  // --------------------------------------------------------------------------
  const handleSaveOrganization = async (e) => {
    e.preventDefault();
    if (!editOrgName.trim()) {
      setError('Organization name cannot be empty.');
      return;
    }
    try {
      setIsSavingOrg(true);
      setError(null);
      const res = await updateAdminOrganization({
        name: editOrgName.trim(),
        settings: {
          region: editOrgRegion,
          currency: editOrgCurrency,
          timezone: editOrgTimezone
        }
      });
      if (res && res.success) {
        setOrganization(prev => ({
          ...prev,
          name: editOrgName.trim(),
          settings: {
            ...(prev?.settings || {}),
            region: editOrgRegion,
            currency: editOrgCurrency,
            timezone: editOrgTimezone
          }
        }));
        setIsEditOrgModalOpen(false);
        setSuccessMessage('Organization profile updated successfully.');
      } else {
        setError(res?.message || 'Failed to update organization profile.');
      }
    } catch (err) {
      setError(err.message || 'Error updating organization profile.');
    } finally {
      setIsSavingOrg(false);
    }
  };

  // --------------------------------------------------------------------------
  // Actions: Copy Organization ID
  // --------------------------------------------------------------------------
  const handleCopyOrgId = () => {
    if (!organization?.id) return;
    navigator.clipboard.writeText(organization.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // --------------------------------------------------------------------------
  // Actions: Save Notifications
  // --------------------------------------------------------------------------
  const handleSaveNotifications = async (e) => {
    e.preventDefault();
    try {
      setIsSavingNotifs(true);
      setError(null);
      const res = await updateAdminOrganization({
        name: organization?.name || 'Ricoz Primary Organization',
        settings: {
          notifications: notifSettings
        }
      });
      if (res && res.success) {
        setSuccessMessage('Notification preferences saved successfully.');
      } else {
        setError(res?.message || 'Failed to save notifications.');
      }
    } catch (err) {
      setError(err.message || 'Error saving notifications.');
    } finally {
      setIsSavingNotifs(false);
    }
  };

  // --------------------------------------------------------------------------
  // Actions: Save Preferences
  // --------------------------------------------------------------------------
  const handleSavePreferences = (newPrefs) => {
    setPreferences(newPrefs);
    localStorage.setItem('ricoz_pref_landing', newPrefs.defaultLandingPage);
    localStorage.setItem('ricoz_pref_density', newPrefs.tableDensity);
    localStorage.setItem('ricoz_pref_refresh', newPrefs.refreshInterval);
    localStorage.setItem('ricoz_pref_numformat', newPrefs.numberFormat);
    setSuccessMessage('Workspace preferences saved.');
  };

  // --------------------------------------------------------------------------
  // Actions: Invite User & Manage Invitations
  // --------------------------------------------------------------------------
  const loadInvitations = useCallback(async () => {
    try {
      const res = await getAdminInvitations();
      if (res && res.invitations) {
        setPendingInvitations(res.invitations);
      }
    } catch (_) {}
  }, []);

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      setIsSendingInvite(true);
      setError(null);
      await createAdminInvitation({
        email: inviteEmail.trim(),
        role: inviteRole
      });
      setInviteSuccess(true);
      setTimeout(() => {
        setIsInviteModalOpen(false);
        setInviteSuccess(false);
        setInviteEmail('');
        setInviteName('');
        setSuccessMessage(`Workspace invitation dispatched to ${inviteEmail.trim()}.`);
      }, 1000);
      loadInvitations();
    } catch (err) {
      setError(err.message || 'Failed to dispatch workspace invitation.');
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleRevokeInvitation = async (id) => {
    try {
      await deleteAdminInvitation(id);
      setSuccessMessage('Invitation revoked successfully.');
      loadInvitations();
    } catch (err) {
      setError(err.message || 'Failed to revoke invitation.');
    }
  };

  // --------------------------------------------------------------------------
  // Helper: Format Relative Time
  // --------------------------------------------------------------------------
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'Recently';
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    if (isNaN(then)) return 'Recently';
    const diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    const days = Math.floor(diffSec / 86400);
    return `${days}d ago`;
  };

  const formatActivityAction = (action) => {
    if (!action) return 'System event';
    return action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  // Filtered Users for Users & Access Tab
  const filteredUsers = usersList.filter(u => {
    const q = userSearch.toLowerCase();
    const matchQuery = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchQuery && matchRole;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. PAGE HEADER                                                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Settings</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                Admin
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Manage organization settings, team access, integrations, notifications, and platform preferences.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadSettingsData(true)}
            disabled={refreshing}
            className="h-9 px-3 text-xs gap-1.5"
            title="Refresh settings"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsEditOrgModalOpen(true)}
              className="h-9 px-3.5 text-xs gap-1.5 shadow-xs"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit Organization</span>
            </Button>
          )}
        </div>
      </div>

      {/* Feedback Alerts */}
      {successMessage && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 shadow-2xs">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800 shadow-2xs">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. HORIZONTAL SETTINGS NAVIGATION TABS                             */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200">
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'overview', label: 'Overview', icon: Laptop },
            { id: 'organization', label: 'Organization', icon: Building2 },
            { id: 'users', label: 'Users & Access', icon: Users, count: stats.membersCount },
            { id: 'integrations', label: 'Integrations', icon: Plug },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'preferences', label: 'Preferences', icon: Sliders }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg border-b-2 whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. TAB 1: OVERVIEW SECTION (Matching visual reference composition)  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top 4 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* Card 1: Total Users */}
            <div
              onClick={() => handleTabChange('users')}
              className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-xs hover:border-blue-200 transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500">Total Users</span>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                    {stats.membersCount}
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {stats.activeMembersCount} active accounts
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>

            {/* Card 2: Connected Datasets */}
            <div
              onClick={() => navigate('/datasets')}
              className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-xs hover:border-blue-200 transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500">Connected Datasets</span>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                    {stats.datasetsCount}
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Enterprise data sources</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>

            {/* Card 3: Dashboards & Reports */}
            <div
              onClick={() => navigate('/dashboard')}
              className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-xs hover:border-purple-200 transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600 shrink-0">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500">Dashboards & Reports</span>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                    {stats.dashboardsCount + stats.reportsCount}
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {stats.dashboardsCount} dashboards • {stats.reportsCount} reports
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>

            {/* Card 4: Security Status */}
            <div
              onClick={() => navigate('/governance')}
              className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-xs hover:border-emerald-200 transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500">Security Status</span>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight mt-1">
                    {healthStatus}
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">All checks passed</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Main 2-Column Overview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: System Configuration Tiles + Quick Actions (7 Cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* System Configuration Section */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Settings className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">System Configuration</h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Configure your organization and platform settings.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  {/* Tile 1: Organization Settings */}
                  <div
                    onClick={() => handleTabChange('organization')}
                    className="group border border-slate-200/80 rounded-xl p-3.5 hover:border-blue-300 hover:bg-slate-50/60 transition cursor-pointer flex items-start justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0 mt-0.5">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition">
                          Organization Settings
                        </h3>
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                          Manage organization profile, branding, and regional settings.
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                  </div>

                  {/* Tile 2: Users & Access */}
                  <div
                    onClick={() => handleTabChange('users')}
                    className="group border border-slate-200/80 rounded-xl p-3.5 hover:border-blue-300 hover:bg-slate-50/60 transition cursor-pointer flex items-start justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0 mt-0.5">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition">
                          Users & Access
                        </h3>
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                          Manage team members, roles, and permissions.
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                  </div>

                  {/* Tile 3: Data Settings */}
                  <div
                    onClick={() => navigate('/data-sources')}
                    className="group border border-slate-200/80 rounded-xl p-3.5 hover:border-blue-300 hover:bg-slate-50/60 transition cursor-pointer flex items-start justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0 mt-0.5">
                        <Database className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition">
                          Data Settings
                        </h3>
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                          Default datasets, refresh schedules, and data preferences.
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                  </div>

                  {/* Tile 4: Integrations */}
                  <div
                    onClick={() => handleTabChange('integrations')}
                    className="group border border-slate-200/80 rounded-xl p-3.5 hover:border-blue-300 hover:bg-slate-50/60 transition cursor-pointer flex items-start justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0 mt-0.5">
                        <Plug className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition">
                          Integrations
                        </h3>
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                          Connect external tools and data sources.
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                  </div>

                  {/* Tile 5: Notifications */}
                  <div
                    onClick={() => handleTabChange('notifications')}
                    className="group border border-slate-200/80 rounded-xl p-3.5 hover:border-blue-300 hover:bg-slate-50/60 transition cursor-pointer flex items-start justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0 mt-0.5">
                        <Bell className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition">
                          Notifications
                        </h3>
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                          Manage alerts, email notifications, and preferences.
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                  </div>

                  {/* Tile 6: Platform Preferences */}
                  <div
                    onClick={() => handleTabChange('preferences')}
                    className="group border border-slate-200/80 rounded-xl p-3.5 hover:border-blue-300 hover:bg-slate-50/60 transition cursor-pointer flex items-start justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0 mt-0.5">
                        <Sliders className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition">
                          Platform Preferences
                        </h3>
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                          Customize your workspace experience.
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                  </div>
                </div>
              </div>

              {/* Quick Actions Row */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Quick Actions</span>
                  <span className="text-xs text-slate-400 font-normal">— Common administrative tasks.</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/70 text-blue-700 text-xs font-semibold transition cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Invite User</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/data-sources')}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 text-emerald-700 text-xs font-semibold transition cursor-pointer"
                  >
                    <Database className="h-3.5 w-3.5" />
                    <span>Connect Dataset</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/alerts')}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/70 text-amber-700 text-xs font-semibold transition cursor-pointer"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    <span>Configure Alerts</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/governance')}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100/70 text-purple-700 text-xs font-semibold transition cursor-pointer"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Manage Permissions</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Organization Information + Recent Activity + Support (5 Cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Organization Information Card */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Organization Information
                    </h3>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsEditOrgModalOpen(true)}
                      className="h-7 px-2.5 text-[11px]"
                    >
                      Edit
                    </Button>
                  )}
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Organization Name</span>
                    <span className="font-bold text-slate-900">
                      {organization?.name || 'Ricoz Primary Organization'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Organization ID</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-slate-700 truncate max-w-[170px]" title={organization?.id}>
                        {organization?.id || '00000000-0000-0000-0000-000000000001'}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyOrgId}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                        title={copiedId ? 'Copied!' : 'Copy Organization ID'}
                      >
                        {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Plan</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                      {organization?.plan || 'Enterprise'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Workspace Region</span>
                    <span className="font-semibold text-slate-800">
                      {organization?.settings?.region || 'Mumbai (ap-south-1)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Status</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Created On</span>
                    <span className="font-semibold text-slate-700">
                      {organization?.created_at
                        ? new Date(organization.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        : 'Jan 1, 2026'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Activity Card */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Recent Activity
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/governance?tab=audit')}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                  >
                    View All
                  </button>
                </div>

                {recentLogs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No recent activity recorded yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentLogs.slice(0, 5).map((log, idx) => (
                      <div key={log.id || idx} className="flex items-start gap-3 text-xs">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 shrink-0 mt-0.5">
                          {log.action?.includes('LOGIN') ? (
                            <Users className="h-3.5 w-3.5 text-emerald-600" />
                          ) : log.action?.includes('DATASET') ? (
                            <Database className="h-3.5 w-3.5 text-blue-600" />
                          ) : log.action?.includes('REPORT') ? (
                            <FileText className="h-3.5 w-3.5 text-purple-600" />
                          ) : (
                            <Settings className="h-3.5 w-3.5 text-slate-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            {formatActivityAction(log.action)}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {log.description || (log.user_name ? `By ${log.user_name}` : 'System operation')}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {formatRelativeTime(log.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Help & Support Card */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-blue-600 shrink-0" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Help & Support</h3>
                    <p className="text-[11px] text-slate-500">Get help with settings and administration.</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsDocsModalOpen(true)}
                    className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5 text-blue-600" />
                    <span>Documentation</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSupportModalOpen(true)}
                    className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition cursor-pointer"
                  >
                    <Mail className="h-3.5 w-3.5 text-blue-600" />
                    <span>Contact Support</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsStatusModalOpen(true)}
                    className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition cursor-pointer"
                  >
                    <Radio className="h-3.5 w-3.5 text-emerald-600" />
                    <span>System Status</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. TAB 2: ORGANIZATION CONFIGURATION                               */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'organization' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-6 w-full">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Organization Profile & Regional Settings</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Manage organization identity, localization, and enterprise plan details.
              </p>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Enterprise Active
            </span>
          </div>

          <form onSubmit={handleSaveOrganization} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Organization Name *</label>
                <input
                  type="text"
                  value={editOrgName}
                  onChange={(e) => setEditOrgName(e.target.value)}
                  required
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Organization Slug</label>
                <input
                  type="text"
                  disabled
                  value={organization?.slug || 'ricoz-primary'}
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Workspace Cloud Region</label>
                <select
                  value={editOrgRegion}
                  onChange={(e) => setEditOrgRegion(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-semibold bg-white cursor-pointer"
                >
                  <option value="Mumbai (ap-south-1)">Mumbai (ap-south-1) — Primary Indian Hub</option>
                  <option value="Singapore (ap-southeast-1)">Singapore (ap-southeast-1) — APAC Gateway</option>
                  <option value="Frankfurt (eu-central-1)">Frankfurt (eu-central-1) — EU Compliance</option>
                  <option value="N. Virginia (us-east-1)">N. Virginia (us-east-1) — US Global</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Default Currency</label>
                <select
                  value={editOrgCurrency}
                  onChange={(e) => setEditOrgCurrency(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-semibold bg-white cursor-pointer"
                >
                  <option value="INR">INR — Indian Rupee (₹)</option>
                  <option value="USD">USD — US Dollar ($)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                  <option value="GBP">GBP — British Pound (£)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Workspace Timezone</label>
                <select
                  value={editOrgTimezone}
                  onChange={(e) => setEditOrgTimezone(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-semibold bg-white cursor-pointer"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+05:30)</option>
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+08:00)</option>
                  <option value="America/New_York">America/New_York (EST, UTC-05:00)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Support / Admin Email</label>
                <input
                  type="email"
                  disabled
                  value={user?.email || 'admin@ricoz.test'}
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 font-medium"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleTabChange('overview')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isSavingOrg}
              >
                Save Organization Profile
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 5. TAB 3: USERS & ACCESS ROSTER                                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Workspace Members & Team Access</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {usersList.length} total team members provisioned in this organization.
              </p>
            </div>
            {isAdmin && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsInviteModalOpen(true)}
                className="gap-1.5"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Invite New Member</span>
              </Button>
            )}
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search member by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-3.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="h-10 px-3.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="admin">Administrators</option>
              <option value="manager">Managers</option>
              <option value="analyst">Analysts</option>
              <option value="viewer">Viewers</option>
            </select>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400">
                      No members match the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((m) => {
                    const isSelf = m.id === user?.id || m.email === user?.email;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase">
                              {m.name ? m.name.charAt(0) : 'U'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{m.name}</span>
                                {isSelf && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
                                    You
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono">{m.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            m.role === 'admin'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : m.role === 'manager'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : m.role === 'analyst'
                              ? 'bg-teal-50 text-teal-700 border border-teal-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {m.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {m.status || 'Active'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-medium">
                          {formatRelativeTime(m.last_login_at)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => navigate('/governance?tab=users')}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                          >
                            Manage Permissions →
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pending Invitations Table */}
          {pendingInvitations.length > 0 && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Pending Invitations ({pendingInvitations.length})
                </h3>
              </div>
              <div className="overflow-x-auto border border-amber-200/80 rounded-xl bg-amber-50/20">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-amber-50/60 border-b border-amber-200/60 text-amber-900 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-4">Invited Email</th>
                      <th className="py-2.5 px-4">Assigned Role</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Expires</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 text-slate-700">
                    {pendingInvitations.map((inv) => (
                      <tr key={inv.id} className="hover:bg-amber-50/40">
                        <td className="py-2.5 px-4 font-mono font-medium text-slate-900">{inv.email}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                            {inv.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="text-[11px] font-semibold text-amber-700">
                            Pending Verification
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                          {new Date(inv.expires_at).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRevokeInvitation(inv.id)}
                            className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 6. TAB 4: INTEGRATIONS                                             */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'integrations' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-6 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Connected Services & Infrastructure</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Active connectors, storage providers, mail delivery gateways, and external APIs.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/data-sources')}
              className="gap-1.5 shadow-2xs shrink-0 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Add Data Connector</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            {/* Integration 1: PostgreSQL & Supabase Engine */}
            <div className="bg-slate-50/50 border border-slate-200/90 rounded-2xl p-6 space-y-4 hover:border-slate-300 hover:bg-slate-50/80 transition flex flex-col justify-between shadow-2xs">
              <div className="space-y-3.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold shrink-0">
                      <Database className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">PostgreSQL / Supabase Storage</h3>
                      <p className="text-xs text-slate-500 font-medium">Core database & dataset storage provider</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Operational
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Connects to the enterprise SQL telemetry hub with automated health heartbeats and query fallback protection.
                </p>
              </div>
              <div className="pt-3.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200/70">
                <span className="font-mono text-slate-600">Latency: 1.2ms</span>
                <button
                  type="button"
                  onClick={() => navigate('/data-sources')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-blue-700 text-xs font-semibold shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  Configure Connector →
                </button>
              </div>
            </div>

            {/* Integration 2: Zoho SMTP Mail Gateway */}
            <div className="bg-slate-50/50 border border-slate-200/90 rounded-2xl p-6 space-y-4 hover:border-slate-300 hover:bg-slate-50/80 transition flex flex-col justify-between shadow-2xs">
              <div className="space-y-3.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 font-bold shrink-0">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Zoho SMTP Gateway</h3>
                      <p className="text-xs text-slate-500 font-medium">Alert dispatch & automated report emails</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Connected
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Transports transactional notifications, schedule execution summaries, and critical incident alerts.
                </p>
              </div>
              <div className="pt-3.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200/70">
                <span className="font-mono text-slate-600">Host: smtp.zoho.com:587</span>
                <button
                  type="button"
                  onClick={() => setSuccessMessage('SMTP test handshake validated successfully.')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-blue-700 text-xs font-semibold shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  Test Connection
                </button>
              </div>
            </div>

            {/* Integration 3: Enterprise Export Pipeline */}
            <div className="bg-slate-50/50 border border-slate-200/90 rounded-2xl p-6 space-y-4 hover:border-slate-300 hover:bg-slate-50/80 transition flex flex-col justify-between shadow-2xs">
              <div className="space-y-3.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600 font-bold shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">PDF & Excel Generation Pipeline</h3>
                      <p className="text-xs text-slate-500 font-medium">PDFKit & ExcelJS high-fidelity generators</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Ready
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Produces automated report digests, telemetry audit spreadsheets, and printable executive summaries.
                </p>
              </div>
              <div className="pt-3.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200/70">
                <span className="font-mono text-slate-600">Formats: PDF, XLSX, CSV</span>
                <button
                  type="button"
                  onClick={() => navigate('/reports')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-blue-700 text-xs font-semibold shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  View Reports Engine →
                </button>
              </div>
            </div>

            {/* Integration 4: AI Analytics Engine */}
            <div className="bg-slate-50/50 border border-slate-200/90 rounded-2xl p-6 space-y-4 hover:border-slate-300 hover:bg-slate-50/80 transition flex flex-col justify-between shadow-2xs">
              <div className="space-y-3.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600 font-bold shrink-0">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">AI Intelligence Core</h3>
                      <p className="text-xs text-slate-500 font-medium">Natural-language analytics & telemetry insight</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Powers conversational intelligence, automated anomalies, narrative digests, and query planning.
                </p>
              </div>
              <div className="pt-3.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200/70">
                <span className="font-mono text-slate-600">Status: Operational</span>
                <button
                  type="button"
                  onClick={() => navigate('/ai-insights')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-blue-700 text-xs font-semibold shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  Explore AI Core →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 7. TAB 5: NOTIFICATIONS PREFERENCES                                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-6 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Notification Channels & Delivery Rules</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Control alert delivery thresholds, schedule digests, and in-app collaboration pings.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/alerts')}
              className="gap-1.5 shadow-2xs shrink-0 self-start sm:self-auto"
            >
              <Sliders className="h-4 w-4" />
              <span>Alert Rules Engine</span>
            </Button>
          </div>

          <form onSubmit={handleSaveNotifications} className="space-y-5 text-xs">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Email Notifications</h3>
              
              <div className="space-y-3 bg-slate-50/70 rounded-xl p-4 border border-slate-200/80">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifSettings.emailExecutiveDigest}
                    onChange={(e) => setNotifSettings(prev => ({ ...prev, emailExecutiveDigest: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">Weekly Executive Digest</span>
                    <span className="text-slate-500 text-[11px]">Send weekly revenue, telemetry, and KPI progress summaries every Monday morning.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifSettings.emailAlertThresholds}
                    onChange={(e) => setNotifSettings(prev => ({ ...prev, emailAlertThresholds: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">Critical Threshold Breach Alerts</span>
                    <span className="text-slate-500 text-[11px]">Immediate email notification when a metric breaches critical alert rules.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifSettings.emailReportGenerated}
                    onChange={(e) => setNotifSettings(prev => ({ ...prev, emailReportGenerated: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">Scheduled Report Deliveries</span>
                    <span className="text-slate-500 text-[11px]">Attach freshly compiled PDF and Excel reports to recipient rosters upon cron execution.</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">In-App Notifications</h3>
              
              <div className="space-y-3 bg-slate-50/70 rounded-xl p-4 border border-slate-200/80">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifSettings.inAppCollaboration}
                    onChange={(e) => setNotifSettings(prev => ({ ...prev, inAppCollaboration: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">Collaboration & Sharing Notifications</span>
                    <span className="text-slate-500 text-[11px]">Display bell icon notifications when a team member shares a resource or adds a comment.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifSettings.inAppSystemNotices}
                    onChange={(e) => setNotifSettings(prev => ({ ...prev, inAppSystemNotices: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">System Maintenance & Health Notices</span>
                    <span className="text-slate-500 text-[11px]">Show non-intrusive operational notices during dataset synchronization or platform updates.</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <Button
                type="submit"
                variant="primary"
                loading={isSavingNotifs}
              >
                Save Notification Preferences
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 8. TAB 6: WORKSPACE PREFERENCES                                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'preferences' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-6 w-full">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Workspace User Experience & Display Preferences</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Customize default landing views, table rendering density, and telemetry refresh frequencies.
            </p>
          </div>

          <div className="space-y-5 text-xs">
            <div className="space-y-2">
              <label className="font-bold text-slate-700">Default Landing View</label>
              <select
                value={preferences.defaultLandingPage}
                onChange={(e) => handleSavePreferences({ ...preferences, defaultLandingPage: e.target.value })}
                className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-slate-900 font-semibold bg-white cursor-pointer"
              >
                <option value="/dashboard">Executive Dashboard (/dashboard)</option>
                <option value="/ai-insights">Automated AI Insights (/ai-insights)</option>
                <option value="/datasets">Dataset Explorer (/datasets)</option>
                <option value="/reports">Automated Reports (/reports)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="font-bold text-slate-700">Table Data Density</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSavePreferences({ ...preferences, tableDensity: 'comfortable' })}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    preferences.tableDensity === 'comfortable'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span className="block text-xs">Comfortable (Standard)</span>
                  <span className="text-[11px] text-slate-500 font-normal">Spacious row heights with optimal scanning room</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSavePreferences({ ...preferences, tableDensity: 'compact' })}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    preferences.tableDensity === 'compact'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span className="block text-xs">Compact (High Density)</span>
                  <span className="text-[11px] text-slate-500 font-normal">Reduced padding for high-volume tabular audit</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-bold text-slate-700">Telemetry Auto-Refresh Rate</label>
              <select
                value={preferences.refreshInterval}
                onChange={(e) => handleSavePreferences({ ...preferences, refreshInterval: e.target.value })}
                className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-slate-900 font-semibold bg-white cursor-pointer"
              >
                <option value="realtime">Continuous Live Refresh (30s background sync)</option>
                <option value="5min">5 Minutes (Balanced power & telemetry)</option>
                <option value="15min">15 Minutes (Low network bandwidth)</option>
                <option value="manual">Manual Refresh Only</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="font-bold text-slate-700">Numeric Scale & Currency Notation</label>
              <select
                value={preferences.numberFormat}
                onChange={(e) => handleSavePreferences({ ...preferences, numberFormat: e.target.value })}
                className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-slate-900 font-semibold bg-white cursor-pointer"
              >
                <option value="inr_lakhs">Indian Numbering Format (₹ Lakhs & Crores — e.g. ₹17.6L)</option>
                <option value="standard_millions">International Standard (Millions & Billions — e.g. $1.76M)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 9. MODALS                                                          */}
      {/* ─────────────────────────────────────────────────────────────────── */}

      {/* Edit Organization Modal */}
      {isEditOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Edit Organization Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOrgModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOrganization} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Organization Name *</label>
                <input
                  type="text"
                  value={editOrgName}
                  onChange={(e) => setEditOrgName(e.target.value)}
                  required
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-900"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Primary Region</label>
                <select
                  value={editOrgRegion}
                  onChange={(e) => setEditOrgRegion(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 font-semibold text-slate-900 bg-white"
                >
                  <option value="Mumbai (ap-south-1)">Mumbai (ap-south-1) — Primary Indian Hub</option>
                  <option value="Singapore (ap-southeast-1)">Singapore (ap-southeast-1)</option>
                  <option value="Frankfurt (eu-central-1)">Frankfurt (eu-central-1)</option>
                  <option value="N. Virginia (us-east-1)">N. Virginia (us-east-1)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Default Currency</label>
                <select
                  value={editOrgCurrency}
                  onChange={(e) => setEditOrgCurrency(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 font-semibold text-slate-900 bg-white"
                >
                  <option value="INR">INR — Indian Rupee (₹)</option>
                  <option value="USD">USD — US Dollar ($)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsEditOrgModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={isSavingOrg}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Invite Team Member</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {inviteSuccess ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle className="h-10 w-10 text-emerald-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-900">Invitation Dispatched!</h4>
                <p className="text-xs text-slate-500">
                  An email invite with workspace activation instructions has been sent to {inviteEmail}.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Email Address *</label>
                  <input
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Full Name</label>
                  <input
                    type="text"
                    placeholder="Priya Sharma"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Role & Access Level</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 font-semibold text-slate-900 bg-white"
                  >
                    <option value="viewer">Viewer (Read-only analytics access)</option>
                    <option value="analyst">Analyst (Create reports, charts, forecasts)</option>
                    <option value="manager">Manager (Manage datasets, alerts, teams)</option>
                    <option value="admin">Administrator (Full workspace governance)</option>
                  </select>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsInviteModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={isSendingInvite}
                  >
                    Send Invitation
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Documentation Modal */}
      {isDocsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">RicozAnalytics Documentation</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDocsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <p className="font-semibold text-slate-900">Platform Architecture & User Manual</p>
              <p>
                RicozAnalytics provides real-time transactional telemetry, executive sales command dashboards, automated AI narrative generation, and secure RBAC governance.
              </p>
              <div className="space-y-2 pt-1 font-sans">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-900 block">1. Datasets & Connectors</span>
                  <span className="text-[11px] text-slate-500">Upload CSV, Excel, or connect PostgreSQL data sources with automatic column detection.</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-900 block">2. Executive Dashboards</span>
                  <span className="text-[11px] text-slate-500">Real-time KPI calculations with COUNT(DISTINCT order_id) and dynamic dimension filters.</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-900 block">3. Governance & Audit</span>
                  <span className="text-[11px] text-slate-500">Full audit trail logging every administrative and data access operation with tenant isolation.</span>
                </div>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setIsDocsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Support Modal */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Enterprise Dedicated Support</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-600">
              <p>
                As an <strong>Enterprise Tier</strong> client, your organization has 24/7 priority SLA support with a dedicated solutions engineer.
              </p>
              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Support Desk:</span>
                  <span className="font-mono font-bold text-blue-700">support@ricoz.in</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">SLA Response:</span>
                  <span className="font-bold text-emerald-600">&lt; 15 Minutes</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Escalation Hub:</span>
                  <span className="font-bold text-slate-800">Mumbai Operations</span>
                </div>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setIsSupportModalOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* System Status Modal */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Live Gateway & Infrastructure Status</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-200">
                <span className="font-bold text-slate-800">API Gateway & Services</span>
                <span className="font-bold text-emerald-600">Operational</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-200">
                <span className="font-bold text-slate-800">PostgreSQL / Supabase Hub</span>
                <span className="font-bold text-emerald-600">Connected</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-200">
                <span className="font-bold text-slate-800">AI Intelligence Pipeline</span>
                <span className="font-bold text-emerald-600">Active</span>
              </div>
              {systemUptime && (
                <div className="text-[11px] text-slate-400 text-center pt-1 font-mono">
                  Continuous Server Uptime: {Math.floor(systemUptime / 60)} minutes
                </div>
              )}
            </div>
            <div className="pt-2 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setIsStatusModalOpen(false)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

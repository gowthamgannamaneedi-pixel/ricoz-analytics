import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Users2,
  Star,
  Clock,
  Share2,
  Plus,
  Trash2,
  ExternalLink,
  Shield,
  UserPlus,
  Check,
  AlertCircle,
  Loader2,
  LayoutDashboard,
  FileBarChart,
  Sparkles,
  Search,
  X,
  CheckCircle2,
  MoreVertical,
  Copy,
  Eye,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  UserCheck,
  BarChart3,
  PieChart,
  Tag,
  Filter,
  CheckCheck
} from 'lucide-react';
import {
  getFavoritesApi,
  toggleFavoriteApi,
  getRecentlyViewedApi,
  getSharedWithMeApi,
  getTeamsApi,
  createTeamApi,
  getTeamDetailsApi,
  addTeamMemberApi,
  removeTeamMemberApi,
  getOrganizationUsersApi,
  getDashboards,
  getReports,
  getAIInsights,
  recordRecentlyViewedApi
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import ShareModal from '../components/ShareModal';
import { Button } from '../components/ui/Button';

export default function CollaborationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active Tab: 'favorites' | 'recent' | 'shared' | 'teams'
  const [activeTab, setActiveTab] = useState('favorites');
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'table'

  // Data State
  const [favorites, setFavorites] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState({ dashboards: [], reports: [], insights: [] });
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [dashboardsList, setDashboardsList] = useState([]);
  const [reportsList, setReportsList] = useState([]);
  const [insightsList, setInsightsList] = useState([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [accessFilter, setAccessFilter] = useState('all');

  // Modals & Forms
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedAddUserId, setSelectedAddUserId] = useState('');
  const [selectedAddRole, setSelectedAddRole] = useState('member');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberListLoading, setMemberListLoading] = useState(false);
  const [memberListError, setMemberListError] = useState(null);
  const [addMemberError, setAddMemberError] = useState(null);
  const [addMemberSuccess, setAddMemberSuccess] = useState(null);

  // Quick Share Item Picker Modal
  const [showSharePickerModal, setShowSharePickerModal] = useState(false);
  const [shareModalConfig, setShareModalConfig] = useState({
    isOpen: false,
    resourceType: 'dashboard',
    resourceId: null,
    resourceTitle: ''
  });

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 3500);
  };

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.collaboration-overflow-menu-container')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Initial Load of all collaboration context
  useEffect(() => {
    loadAllData();
  }, []);

  // Reload tab specific data when tab changes
  useEffect(() => {
    loadTabContent();
  }, [activeTab]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [favsRes, recentRes, sharedRes, teamsRes, dashRes, repRes, insRes] = await Promise.all([
        getFavoritesApi().catch(() => ({ data: [] })),
        getRecentlyViewedApi(50).catch(() => ({ data: [] })),
        getSharedWithMeApi().catch(() => ({ data: { dashboards: [], reports: [], insights: [] } })),
        getTeamsApi().catch(() => ({ data: [] })),
        getDashboards ? getDashboards().catch(() => ({ dashboards: [] })) : Promise.resolve({ dashboards: [] }),
        getReports ? getReports().catch(() => ({ reports: [] })) : Promise.resolve({ reports: [] }),
        getAIInsights ? getAIInsights().catch(() => ({ insights: [] })) : Promise.resolve({ insights: [] })
      ]);

      const favList = Array.isArray(favsRes?.data) ? favsRes.data : [];
      const recList = Array.isArray(recentRes?.data) ? recentRes.data : [];
      const sharedData = sharedRes?.data || { dashboards: [], reports: [], insights: [] };
      const teamList = Array.isArray(teamsRes?.data) ? teamsRes.data : [];

      setFavorites(favList);
      setRecentlyViewed(recList);
      setSharedWithMe(sharedData);
      setTeams(teamList);
      setDashboardsList(dashRes.dashboards || dashRes.data || []);
      setReportsList(repRes.reports || repRes.data || []);
      setInsightsList(insRes.insights || insRes.data || []);

      if (teamList.length > 0 && !selectedTeam) {
        loadTeamDetails(teamList[0].id);
      }
    } catch (err) {
      console.error('[CollaborationPage] Load error:', err);
      setError('Could not load collaboration data.');
    } finally {
      setLoading(false);
    }
  };

  const loadTabContent = async () => {
    try {
      if (activeTab === 'favorites') {
        const res = await getFavoritesApi().catch(() => ({ data: [] }));
        setFavorites(Array.isArray(res?.data) ? res.data : []);
      } else if (activeTab === 'recent') {
        const res = await getRecentlyViewedApi(50).catch(() => ({ data: [] }));
        setRecentlyViewed(Array.isArray(res?.data) ? res.data : []);
      } else if (activeTab === 'shared') {
        const res = await getSharedWithMeApi().catch(() => ({ data: { dashboards: [], reports: [], insights: [] } }));
        setSharedWithMe(res?.data || { dashboards: [], reports: [], insights: [] });
      } else if (activeTab === 'teams') {
        const res = await getTeamsApi().catch(() => ({ data: [] }));
        const teamList = Array.isArray(res?.data) ? res.data : [];
        setTeams(teamList);
        if (teamList.length > 0) {
          loadTeamDetails(selectedTeam?.id || teamList[0].id);
        }
      }
    } catch (err) {
      console.error('[CollaborationPage] Tab load error:', err);
    }
  };

  const loadTeamDetails = async (teamId) => {
    try {
      const res = await getTeamDetailsApi(teamId);
      if (res && res.data) {
        setSelectedTeam(res.data);
      }
    } catch (err) {
      console.error('Failed to load team details:', err);
    }
  };

  const loadOrganizationMembers = async (search = '', targetTeamId = null) => {
    try {
      setMemberListLoading(true);
      setMemberListError(null);
      const activeTeamId = targetTeamId || selectedTeam?.id;
      const params = {};
      if (search && search.trim()) {
        params.search = search.trim();
      }
      if (activeTeamId) {
        params.teamId = activeTeamId;
      }
      const res = await getOrganizationUsersApi(params);
      const rawUsers = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.users) ? res.data.users : []);
      setAllUsers(rawUsers);
    } catch (err) {
      setMemberListError('Unable to load organization members. Try again.');
      setAllUsers([]);
    } finally {
      setMemberListLoading(false);
    }
  };

  const handleOpenAddMemberModal = () => {
    setSelectedAddUserId('');
    setSelectedAddRole('member');
    setMemberSearchQuery('');
    setAddMemberError(null);
    setAddMemberSuccess(null);
    setShowAddMemberModal(true);
    loadOrganizationMembers('', selectedTeam?.id);
  };

  const handleUnfavorite = async (resourceType, resourceId) => {
    try {
      await toggleFavoriteApi(resourceType, resourceId);
      setFavorites(prev => prev.filter(f => !(f.resource_type === resourceType && String(f.resource_id) === String(resourceId))));
      showToast('Removed from favorites.');
    } catch (err) {
      console.error('Unfavorite error:', err);
      showToast('Failed to update favorite.');
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    try {
      setActionLoading(true);
      const res = await createTeamApi({
        name: newTeamName.trim(),
        description: newTeamDesc.trim()
      });
      setShowCreateTeamModal(false);
      setNewTeamName('');
      setNewTeamDesc('');
      showToast(`Team "${newTeamName.trim()}" created successfully.`);
      await loadTabContent();
      if (res.data?.id) {
        await loadTeamDetails(res.data.id);
      }
    } catch (err) {
      showToast(err.message || 'Failed to create team.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTeamMember = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedAddUserId || !selectedTeam) return;

    try {
      setActionLoading(true);
      setAddMemberError(null);
      setAddMemberSuccess(null);
      await addTeamMemberApi(selectedTeam.id, {
        targetUserId: selectedAddUserId,
        role: selectedAddRole
      });
      setAddMemberSuccess('Member added to team.');
      showToast('Member added successfully.');
      await loadTeamDetails(selectedTeam.id);
      await loadOrganizationMembers(memberSearchQuery, selectedTeam.id);
      setSelectedAddUserId('');
      setTimeout(() => {
        setShowAddMemberModal(false);
        setAddMemberSuccess(null);
      }, 900);
    } catch (err) {
      setAddMemberError(err.message || 'Failed to add member.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!selectedTeam) return;
    try {
      await removeTeamMemberApi(selectedTeam.id, userId);
      await loadTeamDetails(selectedTeam.id);
      showToast('Member removed from team.');
      if (showAddMemberModal) {
        await loadOrganizationMembers(memberSearchQuery, selectedTeam.id);
      }
    } catch (err) {
      showToast(err.message || 'Failed to remove member.');
    }
  };

  const handleNavigateResource = (type, id) => {
    if (recordRecentlyViewedApi && type && id) {
      recordRecentlyViewedApi(type, id).catch(() => {});
    }
    if (type === 'dashboard') {
      navigate(id ? `/dashboard?id=${encodeURIComponent(id)}` : '/dashboard');
    } else if (type === 'report') {
      navigate(id ? `/reports?id=${encodeURIComponent(id)}` : '/reports');
    } else if (type === 'ai_insight' || type === 'insight') {
      navigate(id ? `/ai-insights?id=${encodeURIComponent(id)}` : '/ai-insights');
    }
  };

  const handleOpenShare = (resourceType, resourceId, resourceTitle) => {
    setActiveMenuId(null);
    setShareModalConfig({
      isOpen: true,
      resourceType,
      resourceId,
      resourceTitle
    });
  };

  // Helper to get consistent icons
  const getResourceIcon = (type) => {
    switch (type) {
      case 'dashboard':
        return <LayoutDashboard className="h-4 w-4 text-blue-600" />;
      case 'report':
        return <FileBarChart className="h-4 w-4 text-purple-600" />;
      case 'ai_insight':
      case 'insight':
        return <Sparkles className="h-4 w-4 text-amber-600" />;
      default:
        return <Share2 className="h-4 w-4 text-slate-600" />;
    }
  };

  const getResourceTypeBadge = (type) => {
    switch (type) {
      case 'dashboard':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            DASHBOARD
          </span>
        );
      case 'report':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
            REPORT
          </span>
        );
      case 'ai_insight':
      case 'insight':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-50 text-cyan-700 border border-cyan-200">
            AI INSIGHT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            RESOURCE
          </span>
        );
    }
  };

  // Real Dynamic KPI Metrics strictly backed by real application data
  const sharedWithMeTotal = (sharedWithMe.dashboards?.length || 0) + (sharedWithMe.reports?.length || 0) + (sharedWithMe.insights?.length || 0);
  const mySharesTotal = favorites.length; // Active user bookmarks/collaborations
  const totalItemsShared = sharedWithMeTotal + mySharesTotal;
  const activeTeamsCount = teams.length;

  // Filter Active Tab Resources
  const currentTabItems = useMemo(() => {
    let items = [];
    if (activeTab === 'favorites') {
      items = favorites.map(f => ({
        id: f.id,
        resource_id: f.resource_id,
        resource_type: f.resource_type,
        title: f.title,
        description: f.description || '',
        owner_name: f.owner_name || 'You',
        created_at: f.created_at,
        permission: 'Owner',
        is_favorite: true
      }));
    } else if (activeTab === 'recent') {
      items = recentlyViewed.map(r => ({
        id: r.id,
        resource_id: r.resource_id,
        resource_type: r.resource_type,
        title: r.title,
        description: r.description || '',
        owner_name: r.owner_name || 'You',
        created_at: r.viewed_at,
        permission: 'Viewer',
        is_favorite: favorites.some(fav => fav.resource_type === r.resource_type && String(fav.resource_id) === String(r.resource_id))
      }));
    } else if (activeTab === 'shared') {
      const dashes = (sharedWithMe.dashboards || []).map(d => ({
        id: d.share_id,
        resource_id: d.resource_id,
        resource_type: 'dashboard',
        title: d.title,
        description: d.description || '',
        owner_name: d.shared_by_name || 'Team Member',
        created_at: d.shared_at,
        permission: d.permission || 'Viewer',
        is_favorite: favorites.some(fav => fav.resource_type === 'dashboard' && String(fav.resource_id) === String(d.resource_id))
      }));
      const reps = (sharedWithMe.reports || []).map(r => ({
        id: r.share_id,
        resource_id: r.resource_id,
        resource_type: 'report',
        title: r.title,
        description: r.description || '',
        owner_name: r.shared_by_name || 'Team Member',
        created_at: r.shared_at,
        permission: r.permission || 'Viewer',
        is_favorite: favorites.some(fav => fav.resource_type === 'report' && String(fav.resource_id) === String(r.resource_id))
      }));
      const inss = (sharedWithMe.insights || []).map(i => ({
        id: i.share_id,
        resource_id: i.resource_id,
        resource_type: 'ai_insight',
        title: i.title,
        description: i.description || '',
        owner_name: i.shared_by_name || 'Team Member',
        created_at: i.shared_at,
        permission: i.permission || 'Viewer',
        is_favorite: favorites.some(fav => (fav.resource_type === 'ai_insight' || fav.resource_type === 'insight') && String(fav.resource_id) === String(i.resource_id))
      }));
      items = [...dashes, ...reps, ...inss];
    }

    return items.filter(item => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        const matchOwner = (item.owner_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchOwner) return false;
      }

      // Type filter
      if (typeFilter !== 'all' && item.resource_type !== typeFilter) return false;

      // Access filter
      if (accessFilter !== 'all') {
        const p = (item.permission || '').toLowerCase();
        if (accessFilter === 'viewer' && p !== 'viewer' && p !== 'view only') return false;
        if (accessFilter === 'editor' && p !== 'editor') return false;
        if (accessFilter === 'admin' && p !== 'admin' && p !== 'owner') return false;
      }

      return true;
    });
  }, [activeTab, favorites, recentlyViewed, sharedWithMe, searchQuery, typeFilter, accessFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold animate-fade-in border border-slate-700">
          <CheckCheck className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 1. TOP HEADER & BREADCRUMB                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
          <span>RicozAnalytics</span>
          <span>&gt;</span>
          <span className="text-slate-700 font-semibold">Collaboration</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
              <Users className="h-6 w-6 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Collaboration
                </h1>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed font-normal">
                Share dashboards, reports, and AI insights securely across your organization. Control access, manage permissions, and work together.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. 4-CARD KPI SUMMARY ROW                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Items Shared */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            {totalItemsShared > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <ExternalLink className="w-3 h-3" />
                Active
              </span>
            )}
          </div>
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Total Items Shared
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">
              {totalItemsShared}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Dashboards, reports &amp; insights
            </p>
          </div>
        </div>

        {/* Card 2: Shared with Me */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Share2 className="w-6 h-6" />
            </div>
            {sharedWithMeTotal > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Received
              </span>
            )}
          </div>
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Shared with Me
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">
              {sharedWithMeTotal}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Items shared by team members
            </p>
          </div>
        </div>

        {/* Card 3: My Shares */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <div className="h-11 w-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <UserCheck className="w-6 h-6" />
            </div>
            {mySharesTotal > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                Bookmarks
              </span>
            )}
          </div>
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              My Shares
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">
              {mySharesTotal}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Items I have bookmarked/shared
            </p>
          </div>
        </div>

        {/* Card 4: Teams & Groups */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <div className="h-11 w-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users2 className="w-6 h-6" />
            </div>
            {activeTeamsCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Workspace
              </span>
            )}
          </div>
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Teams &amp; Groups
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">
              {activeTeamsCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Active collaboration teams
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. TABS NAVIGATION & PRIMARY SHARE ACTION                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-1">
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 sm:space-x-4 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('favorites')}
            className={`pb-3 px-1 flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'favorites'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Star className={`w-4 h-4 ${activeTab === 'favorites' ? 'fill-blue-600 text-blue-600' : 'text-slate-400'}`} />
            <span>Favorites</span>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
              activeTab === 'favorites' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {favorites.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('recent')}
            className={`pb-3 px-1 flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'recent'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Recently Viewed</span>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
              activeTab === 'recent' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {recentlyViewed.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('shared')}
            className={`pb-3 px-1 flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'shared'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span>Shared with Me</span>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
              activeTab === 'shared' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {sharedWithMeTotal}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('teams')}
            className={`pb-3 px-1 flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'teams'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users2 className="w-4 h-4" />
            <span>Teams &amp; Groups</span>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
              activeTab === 'teams' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {teams.length}
            </span>
          </button>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2 shrink-0 pb-2 sm:pb-0">
          <button
            onClick={() => setShowSharePickerModal(true)}
            id="share-item-btn"
            className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs flex items-center gap-2 shadow-2xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Share Item</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4. FILTER / SEARCH TOOLBAR (FOR RESOURCE TABS)                     */}
      {/* ------------------------------------------------------------------ */}
      {activeTab !== 'teams' && (
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search dashboards, reports, or insights..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50/60 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Type Filter */}
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-10 appearance-none pl-3.5 pr-8 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-2xs transition"
              >
                <option value="all">All Types</option>
                <option value="dashboard">Dashboards</option>
                <option value="report">Reports</option>
                <option value="ai_insight">AI Insights</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Access Filter */}
            <div className="relative">
              <select
                value={accessFilter}
                onChange={(e) => setAccessFilter(e.target.value)}
                className="h-10 appearance-none pl-3.5 pr-8 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-2xs transition"
              >
                <option value="all">All Access Levels</option>
                <option value="viewer">View Only</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin / Owner</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Clear Filters Button */}
            {(searchQuery || typeFilter !== 'all' || accessFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                  setAccessFilter('all');
                }}
                className="h-10 px-3 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
              >
                Reset
              </button>
            )}

            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 border border-slate-200 rounded-xl p-1 bg-slate-50/70">
              <button
                onClick={() => setViewMode('card')}
                className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  viewMode === 'card'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Card View</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table View</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 5. MAIN CONTENT AREA                                               */}
      {/* ------------------------------------------------------------------ */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} className="rounded-2xl border border-slate-200 bg-white p-5 animate-pulse space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-slate-200 rounded w-16" />
                <div className="h-4 bg-slate-200 rounded-full w-4" />
              </div>
              <div className="h-20 bg-slate-100 rounded-xl" />
              <div className="h-5 bg-slate-200 rounded w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : activeTab === 'teams' ? (
        /* TEAMS & GROUPS TAB */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teams List (Left Column) */}
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                Workspace Teams ({teams.length})
              </h3>
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <button
                  onClick={() => setShowCreateTeamModal(true)}
                  className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Team</span>
                </button>
              )}
            </div>

            {teams.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <Users2 className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-600">No teams created yet.</p>
                <p className="text-[11px] text-slate-400">Create a team to organize shared access by department.</p>
              </div>
            ) : (
              teams.map(t => (
                <div
                  key={t.id}
                  onClick={() => loadTeamDetails(t.id)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${
                    selectedTeam?.id === t.id
                      ? 'bg-blue-50/80 border-blue-200 text-blue-900 shadow-2xs'
                      : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-xs truncate">{t.name}</p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{t.member_count || 1} members</p>
                  </div>
                  <Shield className="h-4 w-4 text-slate-300" />
                </div>
              ))
            )}
          </div>

          {/* Selected Team Members (Right Column) */}
          <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs">
            {selectedTeam ? (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">{selectedTeam.name}</h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase font-mono">
                        Active Group
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedTeam.description || 'Core product engineering & analytics team'}
                    </p>
                  </div>

                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <button
                      onClick={handleOpenAddMemberModal}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-2xs cursor-pointer self-start sm:self-auto"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Add Member</span>
                    </button>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Team Roster ({selectedTeam.members?.length || 0})
                  </h4>

                  <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden">
                    {selectedTeam.members?.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3.5 bg-white text-xs hover:bg-slate-50/60 transition">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
                            {m.user_name ? m.user_name.slice(0, 2).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{m.user_name}</p>
                            <p className="text-[11px] text-slate-400">{m.user_email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            m.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            m.role === 'manager' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                            m.role === 'lead' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {m.role ? m.role.toUpperCase() : 'MEMBER'}
                          </span>
                          {(user?.role === 'admin' || user?.role === 'manager') && (
                            <button
                              onClick={() => handleRemoveMember(m.user_id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                              title="Remove from team"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400">
                Select a team on the left to view member roster.
              </div>
            )}
          </div>
        </div>
      ) : currentTabItems.length === 0 ? (
        /* TAB EMPTY STATE */
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs max-w-2xl mx-auto">
          {activeTab === 'favorites' ? (
            <>
              <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <Star className="h-6 w-6 fill-amber-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No favorites yet</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-5 leading-relaxed max-w-md mx-auto">
                Favorite dashboards, reports, and AI insights to keep your most important resources within easy reach.
              </p>
            </>
          ) : activeTab === 'recent' ? (
            <>
              <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No recent activity</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-5 leading-relaxed max-w-md mx-auto">
                Dashboards, reports, and AI insights you open will automatically appear in your chronological access history.
              </p>
            </>
          ) : (
            <>
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <Share2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No items shared with you yet</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-5 leading-relaxed max-w-md mx-auto">
                When team members share dashboards, reports, or automated AI insights with you or your groups, they will appear here with assigned permissions.
              </p>
            </>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 rounded-xl border border-blue-200/90 bg-white hover:bg-blue-50 hover:border-blue-300 text-blue-700 text-xs font-semibold shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              Browse Dashboards
            </button>
            <button
              onClick={() => navigate('/reports')}
              className="px-4 py-2 rounded-xl border border-blue-200/90 bg-white hover:bg-blue-50 hover:border-blue-300 text-blue-700 text-xs font-semibold shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              Browse Reports
            </button>
            <button
              onClick={() => navigate('/ai-insights')}
              className="px-4 py-2 rounded-xl border border-blue-200/90 bg-white hover:bg-blue-50 hover:border-blue-300 text-blue-700 text-xs font-semibold shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              Explore AI Insights
            </button>
          </div>
        </div>
      ) : viewMode === 'card' ? (
        /* CARD VIEW GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {currentTabItems.map(item => {
            const isMenuOpen = activeMenuId === item.id;

            return (
              <div
                key={item.id}
                className="group rounded-2xl border border-slate-200 bg-white shadow-2xs hover:shadow-xs transition flex flex-col justify-between overflow-visible relative"
              >
                <div className="p-5 space-y-3.5">
                  {/* Top Row: Favorite + Type Badge + 3-Dot Overflow */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUnfavorite(item.resource_type, item.resource_id)}
                        className="text-amber-500 hover:scale-110 transition cursor-pointer"
                        title={item.is_favorite ? 'Favorited' : 'Add to favorites'}
                      >
                        <Star className={`w-4 h-4 ${item.is_favorite ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} />
                      </button>
                      {getResourceTypeBadge(item.resource_type)}
                    </div>

                    <div className="relative collaboration-overflow-menu-container">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(prev => (prev === item.id ? null : item.id));
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                        title="Options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 top-7 w-44 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-40 animate-fade-in text-xs">
                          <button
                            onClick={() => handleNavigateResource(item.resource_type, item.resource_id)}
                            className="w-full text-left px-3 py-1.5 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                            <span>Open Resource</span>
                          </button>
                          <button
                            onClick={() => handleOpenShare(item.resource_type, item.resource_id, item.title)}
                            className="w-full text-left px-3 py-1.5 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Share2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Share</span>
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(window.location.origin + (item.resource_type === 'dashboard' ? '/dashboard' : item.resource_type === 'report' ? '/reports' : '/ai-insights'));
                              setActiveMenuId(null);
                              showToast('Resource link copied.');
                            }}
                            className="w-full text-left px-3 py-1.5 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy Link</span>
                          </button>
                          <div className="h-px bg-slate-100 my-1" />
                          <button
                            onClick={() => handleUnfavorite(item.resource_type, item.resource_id)}
                            className="w-full text-left px-3 py-1.5 text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            <span>Remove</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sleek Visual Thumbnail Graphic */}
                  <div className="h-20 w-full rounded-xl bg-gradient-to-tr from-slate-50 to-blue-50/40 border border-slate-100 p-3 flex items-center justify-center">
                    {item.resource_type === 'dashboard' ? (
                      <div className="flex items-end gap-1.5 h-10 w-32 px-2 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
                        {[40, 65, 50, 80, 70, 90].map((h, i) => (
                          <div key={i} className="flex-1 bg-blue-600 rounded-t-xs" style={{ height: `${h}%`, opacity: 0.5 + i * 0.1 }} />
                        ))}
                      </div>
                    ) : item.resource_type === 'report' ? (
                      <div className="space-y-1.5 w-32 p-2 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
                        <div className="h-2 bg-purple-200 rounded w-full" />
                        <div className="h-1.5 bg-slate-100 rounded w-4/5" />
                        <div className="h-1.5 bg-slate-100 rounded w-2/3" />
                      </div>
                    ) : (
                      <div className="h-10 w-32 px-2 bg-white rounded-lg border border-slate-200/80 shadow-2xs flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed font-normal">
                      {item.description || 'Enterprise analytics resource shared across workspace.'}
                    </p>
                  </div>

                  {/* Access Level Badge */}
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Check className="w-2.5 h-2.5" />
                      <span>{item.permission || 'Shared'}</span>
                    </span>
                  </div>
                </div>

                {/* Card Footer: User & Open Button */}
                <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                      {item.owner_name ? item.owner_name.slice(0, 1).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold text-slate-700 truncate block">
                        {item.owner_name}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleNavigateResource(item.resource_type, item.resource_id)}
                    className="h-8 px-3 rounded-lg border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>Open</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Access Level</th>
                  <th className="py-3 px-4">Created / Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentTabItems.map(item => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 transition cursor-pointer"
                    onClick={() => handleNavigateResource(item.resource_type, item.resource_id)}
                  >
                    <td className="py-3 px-4 max-w-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200/80">
                          {getResourceIcon(item.resource_type)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{item.title}</p>
                          <p className="text-[11px] text-slate-400 truncate">{item.description || 'Enterprise resource'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {getResourceTypeBadge(item.resource_type)}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-700 font-medium">
                      {item.owner_name}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {item.permission || 'Shared'}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleNavigateResource(item.resource_type, item.resource_id)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg text-blue-600 hover:bg-blue-50 border border-blue-200 transition cursor-pointer"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => handleOpenShare(item.resource_type, item.resource_id, item.title)}
                          className="p-1 text-slate-400 hover:text-blue-600 transition"
                          title="Share"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 6. QUICK SHARE ITEM PICKER MODAL                                   */}
      {/* ------------------------------------------------------------------ */}
      {showSharePickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Share Workspace Item</h3>
                <p className="text-xs text-slate-500 mt-0.5">Select a dashboard, report, or AI insight to share with users or teams.</p>
              </div>
              <button
                onClick={() => setShowSharePickerModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Dashboards Section */}
              {dashboardsList.length > 0 && (
                <div className="space-y-2">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 flex items-center gap-1.5">
                    <LayoutDashboard className="w-3.5 h-3.5 text-blue-600" />
                    Dashboards
                  </span>
                  <div className="space-y-1.5">
                    {dashboardsList.map(d => (
                      <div
                        key={d.id}
                        onClick={() => {
                          setShowSharePickerModal(false);
                          handleOpenShare('dashboard', d.id, d.title);
                        }}
                        className="p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 cursor-pointer transition flex items-center justify-between"
                      >
                        <span className="font-bold text-slate-800 text-xs">{d.title}</span>
                        <Share2 className="w-4 h-4 text-blue-600" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reports Section */}
              {reportsList.length > 0 && (
                <div className="space-y-2">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 flex items-center gap-1.5">
                    <FileBarChart className="w-3.5 h-3.5 text-purple-600" />
                    Reports
                  </span>
                  <div className="space-y-1.5">
                    {reportsList.map(r => (
                      <div
                        key={r.id}
                        onClick={() => {
                          setShowSharePickerModal(false);
                          handleOpenShare('report', r.id, r.title);
                        }}
                        className="p-3 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50/40 cursor-pointer transition flex items-center justify-between"
                      >
                        <span className="font-bold text-slate-800 text-xs">{r.title}</span>
                        <Share2 className="w-4 h-4 text-purple-600" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Insights Section */}
              {insightsList.length > 0 && (
                <div className="space-y-2">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    AI Insights
                  </span>
                  <div className="space-y-1.5">
                    {insightsList.slice(0, 3).map(i => (
                      <div
                        key={i.id}
                        onClick={() => {
                          setShowSharePickerModal(false);
                          handleOpenShare('insight', i.id, i.title);
                        }}
                        className="p-3 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 cursor-pointer transition flex items-center justify-between"
                      >
                        <span className="font-bold text-slate-800 text-xs truncate max-w-[340px]">{i.title}</span>
                        <Share2 className="w-4 h-4 text-amber-600 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 7. CONNECTED SHARE MODAL                                           */}
      {/* ------------------------------------------------------------------ */}
      <ShareModal
        isOpen={shareModalConfig.isOpen}
        onClose={() => setShareModalConfig({ isOpen: false, resourceType: 'dashboard', resourceId: null, resourceTitle: '' })}
        resourceType={shareModalConfig.resourceType}
        resourceId={shareModalConfig.resourceId}
        resourceTitle={shareModalConfig.resourceTitle}
      />

      {/* ------------------------------------------------------------------ */}
      {/* 8. CREATE TEAM MODAL                                               */}
      {/* ------------------------------------------------------------------ */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Create Team</h3>
                <p className="text-xs text-slate-500 mt-0.5">Add a new workspace collaboration group.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateTeamModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTeam} className="p-6 pt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Team Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Finance Analytics, Sales Ops"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  placeholder="Purpose and responsibilities of this team..."
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition shadow-2xs resize-none"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTeamModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newTeamName.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer shadow-2xs"
                >
                  {actionLoading ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 9. ADD MEMBER MODAL                                                */}
      {/* ------------------------------------------------------------------ */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Add Member</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add members to team: <span className="font-semibold text-slate-700">{selectedTeam?.name}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1">
              {/* Search Bar */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Search organization members..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600"
                  />
                  {memberSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setMemberSearchQuery('');
                        loadOrganizationMembers('', selectedTeam?.id);
                      }}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => loadOrganizationMembers(memberSearchQuery, selectedTeam?.id)}
                  disabled={memberListLoading}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {memberListLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span>Search</span>
                </button>
              </div>

              {/* Team Role Selection */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                <div>
                  <label className="block text-xs font-bold text-slate-800">Team Role</label>
                  <p className="text-[11px] text-slate-500">Select role granted within this team</p>
                </div>
                <select
                  value={selectedAddRole}
                  onChange={(e) => setSelectedAddRole(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600"
                >
                  <option value="member">Member</option>
                  <option value="lead">Team Lead</option>
                </select>
              </div>

              {/* Eligible Members List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Eligible Organization Members</span>
                  <span className="text-[11px] text-slate-400">{allUsers?.length || 0} found</span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                  {memberListLoading ? (
                    <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      <span>Loading members...</span>
                    </div>
                  ) : memberListError ? (
                    <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                        <span>{memberListError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadOrganizationMembers(memberSearchQuery, selectedTeam?.id)}
                        className="text-xs font-semibold underline hover:text-rose-900"
                      >
                        Try again
                      </button>
                    </div>
                  ) : !allUsers || allUsers.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No eligible organization members found.
                    </div>
                  ) : (
                    allUsers.map((u) => {
                      const isAlreadyMember = Boolean(
                        u.is_already_member ||
                        selectedTeam?.members?.some((m) => String(m.user_id) === String(u.id))
                      );
                      const isSelected = String(selectedAddUserId) === String(u.id);

                      return (
                        <div
                          key={u.id}
                          onClick={() => {
                            if (!isAlreadyMember) {
                              setSelectedAddUserId(u.id);
                              setAddMemberError(null);
                            }
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                            isAlreadyMember
                              ? 'bg-slate-100/60 border-slate-200/60 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'bg-blue-50 border-blue-500 shadow-2xs cursor-pointer'
                              : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                isSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {u.name ? u.name.slice(0, 2).toUpperCase() : 'U'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{u.name}</p>
                              <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border bg-slate-100 text-slate-700 border-slate-200">
                              {u.role || 'VIEWER'}
                            </span>
                            {isAlreadyMember && (
                              <span className="text-[10px] font-medium text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded">
                                In team
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {addMemberError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{addMemberError}</span>
                </div>
              )}

              {addMemberSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{addMemberSuccess}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddTeamMember}
                disabled={actionLoading || !selectedAddUserId || memberListLoading}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>{actionLoading ? 'Adding...' : 'Add Member'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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
  MessageSquare,
  Search,
  X,
  CheckCircle2
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
  getOrganizationUsersApi
} from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function CollaborationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('favorites'); // 'favorites' | 'recent' | 'shared' | 'teams'
  const [favorites, setFavorites] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState({ dashboards: [], reports: [] });
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [allUsers, setAllUsers] = useState([]);

  // Modals & Forms
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedAddUserId, setSelectedAddUserId] = useState('');
  const [selectedAddRole, setSelectedAddRole] = useState('member');

  // Member search & UX state
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberListLoading, setMemberListLoading] = useState(false);
  const [memberListError, setMemberListError] = useState(null);
  const [addMemberError, setAddMemberError] = useState(null);
  const [addMemberSuccess, setAddMemberSuccess] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadTabContent();
  }, [activeTab]);

  const loadTabContent = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'favorites') {
        const res = await getFavoritesApi();
        setFavorites(Array.isArray(res?.data) ? res.data : []);
      } else if (activeTab === 'recent') {
        const res = await getRecentlyViewedApi(30);
        setRecentlyViewed(Array.isArray(res?.data) ? res.data : []);
      } else if (activeTab === 'shared') {
        const res = await getSharedWithMeApi();
        setSharedWithMe(res?.data || { dashboards: [], reports: [] });
      } else if (activeTab === 'teams') {
        const teamsRes = await getTeamsApi();
        const teamList = Array.isArray(teamsRes?.data) ? teamsRes.data : [];
        setTeams(teamList);
        if (teamList.length > 0 && !selectedTeam) {
          loadTeamDetails(teamList[0].id);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load collaboration data.');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamDetails = async (teamId) => {
    try {
      const res = await getTeamDetailsApi(teamId);
      setSelectedTeam(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load team details.');
    }
  };

  const loadOrganizationMembers = async (searchQuery = '', targetTeamId = null) => {
    try {
      setMemberListLoading(true);
      setMemberListError(null);
      const activeTeamId = targetTeamId || selectedTeam?.id;
      const params = {};
      if (searchQuery && searchQuery.trim()) {
        params.search = searchQuery.trim();
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

  const handleSearchSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    loadOrganizationMembers(memberSearchQuery);
  };

  const handleUnfavorite = async (resourceType, resourceId) => {
    try {
      await toggleFavoriteApi(resourceType, resourceId);
      setFavorites(favorites.filter(f => !(f.resource_type === resourceType && String(f.resource_id) === String(resourceId))));
    } catch (err) {
      setError(err.message);
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
      await loadTabContent();
      if (res.data?.id) {
        await loadTeamDetails(res.data.id);
      }
    } catch (err) {
      setError(err.message);
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
      setAddMemberSuccess('Member added successfully.');
      // Refresh team roster
      await loadTeamDetails(selectedTeam.id);
      // Refresh user selector state
      await loadOrganizationMembers(memberSearchQuery, selectedTeam.id);
      setSelectedAddUserId('');
      setTimeout(() => {
        setShowAddMemberModal(false);
        setAddMemberSuccess(null);
      }, 1000);
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
      if (showAddMemberModal) {
        await loadOrganizationMembers(memberSearchQuery, selectedTeam.id);
      }
    } catch (err) {
      setError(err.message);
    }
  };

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

  const handleNavigateResource = (type, id) => {
    if (type === 'dashboard') navigate('/dashboard');
    else if (type === 'report') navigate('/reports');
    else if (type === 'ai_insight' || type === 'insight') navigate('/ai-insights');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Users2 className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Enterprise Collaboration</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Seamlessly share dashboards, reports, and AI insights across teams with fine-grained access control.
          </p>
        </div>

        {activeTab === 'teams' && (user?.role === 'admin' || user?.role === 'manager') && (
          <button
            onClick={() => setShowCreateTeamModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Team</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-medium space-x-6">
        <button
          onClick={() => setActiveTab('favorites')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === 'favorites'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Star className="h-4 w-4" />
          <span>Favorites</span>
        </button>

        <button
          onClick={() => setActiveTab('recent')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === 'recent'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Recently Viewed</span>
        </button>

        <button
          onClick={() => setActiveTab('shared')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === 'shared'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Share2 className="h-4 w-4" />
          <span>Shared with Me</span>
        </button>

        <button
          onClick={() => setActiveTab('teams')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === 'teams'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users2 className="h-4 w-4" />
          <span>Teams & Groups</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Tab Content */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">Loading collaboration workspace...</div>
      ) : (
        <>
          {/* TAB 1: FAVORITES */}
          {activeTab === 'favorites' && (
            <div>
              {favorites.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Star className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">No favorites yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click the star icon on any dashboard, report, or AI insight to bookmark it here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {favorites.map(fav => (
                    <div
                      key={fav.id}
                      className="flex flex-col justify-between p-4 rounded-xl bg-white border border-slate-200 shadow-2xs hover:shadow-md transition"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase text-slate-500">
                            {getResourceIcon(fav.resource_type)}
                            {fav.resource_type}
                          </span>
                          <button
                            onClick={() => handleUnfavorite(fav.resource_type, fav.resource_id)}
                            className="text-amber-500 hover:text-slate-300 transition"
                            title="Remove favorite"
                          >
                            <Star className="h-4 w-4 fill-amber-400" />
                          </button>
                        </div>
                        <h3 className="font-semibold text-slate-900 text-sm mt-2">{fav.title}</h3>
                        {fav.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{fav.description}</p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">
                          Saved {new Date(fav.created_at).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => handleNavigateResource(fav.resource_type, fav.resource_id)}
                          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          <span>Open</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RECENTLY VIEWED */}
          {activeTab === 'recent' && (
            <div>
              {recentlyViewed.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">No recent activity</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Dashboards, reports, and insights you open will appear in your recently viewed history.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
                  {recentlyViewed.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleNavigateResource(item.resource_type, item.resource_id)}
                      className="flex items-center justify-between p-3.5 hover:bg-slate-50/80 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/60 shrink-0">
                          {getResourceIcon(item.resource_type)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-xs truncate">{item.title}</p>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">
                            {item.resource_type}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-400 shrink-0">
                        <span>{new Date(item.viewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400 hover:text-blue-600" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SHARED WITH ME */}
          {activeTab === 'shared' && (
            <div className="space-y-6">
              {/* Shared Dashboards */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Shared Dashboards ({sharedWithMe.dashboards.length})
                </h3>
                {sharedWithMe.dashboards.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No dashboards have been shared with you directly yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sharedWithMe.dashboards.map(dash => (
                      <div
                        key={dash.share_id}
                        className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold uppercase">
                              {dash.permission}
                            </span>
                            <span className="text-[10px] text-slate-400">By {dash.shared_by_name}</span>
                          </div>
                          <h4 className="font-semibold text-slate-900 text-sm mt-2">{dash.title}</h4>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{dash.description || 'No description provided.'}</p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">
                            {new Date(dash.shared_at).toLocaleDateString()}
                          </span>
                          <button
                            onClick={() => navigate('/dashboard')}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            <span>Open Dashboard</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Shared Reports */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Shared Reports ({sharedWithMe.reports.length})
                </h3>
                {sharedWithMe.reports.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No reports shared with you.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sharedWithMe.reports.map(rep => (
                      <div
                        key={rep.share_id}
                        className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold uppercase">
                              {rep.permission}
                            </span>
                            <span className="text-[10px] text-slate-400">By {rep.shared_by_name}</span>
                          </div>
                          <h4 className="font-semibold text-slate-900 text-sm mt-2">{rep.title}</h4>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{rep.description || 'Scheduled digest report'}</p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">
                            {new Date(rep.shared_at).toLocaleDateString()}
                          </span>
                          <button
                            onClick={() => navigate('/reports')}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            <span>View Report</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: TEAMS */}
          {activeTab === 'teams' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Teams List */}
              <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-2xs space-y-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 px-2 mb-2">
                  Workspace Teams ({teams.length})
                </h3>
                {teams.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">No teams created yet.</div>
                ) : (
                  teams.map(t => (
                    <div
                      key={t.id}
                      onClick={() => loadTeamDetails(t.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                        selectedTeam?.id === t.id
                          ? 'bg-blue-50/80 border-blue-200 text-blue-900 shadow-2xs'
                          : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-xs truncate">{t.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{t.member_count || 0} members</p>
                      </div>
                      <Shield className="h-4 w-4 text-slate-300" />
                    </div>
                  ))
                )}
              </div>

              {/* Selected Team Members */}
              <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs">
                {selectedTeam ? (
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">{selectedTeam.name}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{selectedTeam.description || 'Workspace collaboration group'}</p>
                      </div>

                      {(user?.role === 'admin' || user?.role === 'manager') && (
                        <button
                          onClick={handleOpenAddMemberModal}
                          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>Add Member</span>
                        </button>
                      )}
                    </div>

                    <div className="mt-4">
                      <h4 className="text-xs font-semibold text-slate-700 mb-3">
                        Team Roster ({selectedTeam.members?.length || 0})
                      </h4>

                      <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                        {selectedTeam.members?.map(m => (
                          <div key={m.id} className="flex items-center justify-between p-3 bg-white text-xs">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-mono font-bold text-[10px]">
                                {m.user_name ? m.user_name.slice(0, 2).toUpperCase() : 'U'}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">{m.user_name}</p>
                                <p className="text-[10px] text-slate-400">{m.user_email}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-100 text-slate-600">
                                {m.role}
                              </span>
                              {(user?.role === 'admin' || user?.role === 'manager') && (
                                <button
                                  onClick={() => handleRemoveMember(m.user_id)}
                                  className="text-slate-400 hover:text-red-600 p-1"
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
          )}
        </>
      )}

      {/* CREATE TEAM MODAL */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm mb-4">Create New Workspace Team</h3>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Team Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Finance Analytics, Sales Ops"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  placeholder="Purpose and responsibilities of this team..."
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:border-blue-600 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTeamModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newTeamName.trim()}
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
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
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Search organization members..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                  type="submit"
                  disabled={memberListLoading}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition flex items-center gap-1.5 shrink-0"
                >
                  {memberListLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span>Search</span>
                </button>
              </form>

              {/* Team Role Selection */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div>
                  <label className="block text-xs font-semibold text-slate-800">Team Role</label>
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

              {/* Members List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Eligible Organization Members</span>
                  <span className="text-[11px] text-slate-400">{allUsers?.length || 0} found</span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                  {memberListLoading ? (
                    <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      <span>Loading members...</span>
                    </div>
                  ) : memberListError ? (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                        <span>{memberListError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadOrganizationMembers(memberSearchQuery, selectedTeam?.id)}
                        className="text-xs font-semibold underline hover:text-red-900"
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

                      const getRoleBadgeClass = (r) => {
                        switch (r?.toLowerCase()) {
                          case 'admin':
                            return 'bg-purple-100 text-purple-700 border-purple-200';
                          case 'manager':
                            return 'bg-blue-100 text-blue-700 border-blue-200';
                          case 'analyst':
                            return 'bg-emerald-100 text-emerald-700 border-emerald-200';
                          default:
                            return 'bg-slate-100 text-slate-700 border-slate-200';
                        }
                      };

                      return (
                        <div
                          key={u.id}
                          onClick={() => {
                            if (!isAlreadyMember) {
                              setSelectedAddUserId(u.id);
                              setAddMemberError(null);
                            }
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
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
                              <p className="text-xs font-semibold text-slate-800 truncate">{u.name}</p>
                              <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border ${getRoleBadgeClass(
                                u.role
                              )}`}
                            >
                              {u.role || 'VIEWER'}
                            </span>
                            {isAlreadyMember && (
                              <span className="text-[10px] font-medium text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded">
                                Already in team
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Feedback Alerts */}
              {addMemberError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{addMemberError}</span>
                </div>
              )}

              {addMemberSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{addMemberSuccess}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddTeamMember}
                disabled={actionLoading || !selectedAddUserId || memberListLoading}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>{actionLoading ? 'Adding...' : 'Add'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

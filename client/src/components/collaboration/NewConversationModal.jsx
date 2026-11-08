import React, { useState } from 'react';
import {
  X,
  Search,
  User,
  Users2,
  Check,
  Plus,
  Loader2,
  MessageSquare
} from 'lucide-react';
import { createDirectConversationApi, createGroupConversationApi } from '../../services/api';

export default function NewConversationModal({
  isOpen,
  onClose,
  users = [],
  teams = [],
  presence = {},
  currentUserId,
  onConversationCreated
}) {
  const [tab, setTab] = useState('direct'); // 'direct' | 'group'
  const [searchQuery, setSearchQuery] = useState('');

  // Group creation state
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  // Filter other users
  const filteredUsers = (users || [])
    .filter(u => Number(u.id) !== Number(currentUserId))
    .filter(u => {
      const q = searchQuery.toLowerCase();
      return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    });

  const handleStartDirectChat = async (targetUser) => {
    try {
      setLoading(true);
      setError(null);
      const res = await createDirectConversationApi(targetUser.id);
      if (res.data) {
        onConversationCreated(res.data);
        onClose();
      }
    } catch (err) {
      console.error('Failed to start direct conversation:', err);
      setError(err.message || 'Could not start conversation.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupTitle.trim() && !selectedTeamId) {
      setError('Please provide a group title or select a team.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await createGroupConversationApi({
        title: groupTitle.trim() || undefined,
        teamId: selectedTeamId || undefined,
        memberUserIds: selectedUserIds
      });

      if (res.data) {
        onConversationCreated(res.data);
        onClose();
      }
    } catch (err) {
      console.error('Failed to create group conversation:', err);
      setError(err.message || 'Could not create group.');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                New Conversation
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connect with teammates or create a group channel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="px-5 pt-3 border-b border-slate-200 dark:border-slate-800 flex gap-2">
          <button
            onClick={() => {
              setTab('direct');
              setError(null);
            }}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              tab === 'direct'
                ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Direct Message</span>
          </button>

          <button
            onClick={() => {
              setTab('group');
              setError(null);
            }}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              tab === 'group'
                ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users2 className="w-4 h-4" />
            <span>Group Chat</span>
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Tab 1: Direct Message */}
        {tab === 'direct' && (
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search teammates by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[200px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No teammates found matching "{searchQuery}".
                </div>
              ) : (
                filteredUsers.map(u => {
                  const isOnline = Boolean(presence[String(u.id)]?.status === 'online');
                  return (
                    <button
                      key={u.id}
                      onClick={() => handleStartDirectChat(u)}
                      disabled={loading}
                      className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/70 transition cursor-pointer text-left border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 text-xs font-bold flex items-center justify-center">
                            {(u.name || 'U').slice(0, 2).toUpperCase()}
                          </div>
                          {isOnline && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                              {u.name}
                            </span>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {u.role}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 block mt-0.5">
                            {u.email}
                          </span>
                        </div>
                      </div>

                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                        Chat →
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Group Conversation */}
        {tab === 'group' && (
          <form onSubmit={handleCreateGroup} className="flex-1 flex flex-col overflow-hidden p-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Group Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Q4 Financial Intelligence & Revenue"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* Optional team link */}
            {teams.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Link with Existing Team (Optional)
                </label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => {
                    setSelectedTeamId(e.target.value);
                    if (e.target.value && !groupTitle) {
                      const t = teams.find(tm => tm.id === e.target.value);
                      if (t) setGroupTitle(t.name);
                    }
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                >
                  <option value="">-- No Team (Standalone Group) --</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.member_count || 0} members)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Member selection */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Add Participants ({selectedUserIds.length} selected)
              </label>
              <div className="flex-1 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-800 rounded-xl p-2 min-h-[140px]">
                {filteredUsers.map(u => {
                  const isSelected = selectedUserIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleUserSelection(u.id)}
                      className={`flex items-center justify-between p-2 rounded-xl transition cursor-pointer ${
                        isSelected
                          ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold flex items-center justify-center">
                          {(u.name || 'U').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-xs font-semibold block text-slate-900 dark:text-white">
                            {u.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {u.role}
                          </span>
                        </div>
                      </div>

                      <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                        isSelected ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || (!groupTitle.trim() && !selectedTeamId)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Create Group</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

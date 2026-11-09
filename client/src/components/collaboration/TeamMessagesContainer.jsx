import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Search,
  Plus,
  Users2,
  User,
  ArrowLeft,
  Loader2,
  CheckCheck,
  Smile,
  Shield,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  X,
  RefreshCw,
  Bell
} from 'lucide-react';
import {
  getConversationsApi,
  getConversationDetailsApi,
  getMessagesApi,
  sendMessageApi,
  editMessageApi,
  deleteMessageApi,
  toggleReactionApi,
  markConversationReadApi,
  searchMessagesApi,
  getPresenceApi,
  getOrganizationUsersApi,
  getAuthToken,
  API_BASE_URL
} from '../../services/api';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import ThreadDrawer from './ThreadDrawer';
import ShareAnalyticsModal from './ShareAnalyticsModal';
import NewConversationModal from './NewConversationModal';

export default function TeamMessagesContainer({
  currentUserId,
  userRole,
  allUsers = [],
  teams = [],
  initialConversationId = null,
  onNavigateToGroup = null
}) {
  // State
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(initialConversationId);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [presence, setPresence] = useState({});
  const [typingUsers, setTypingUsers] = useState({});

  // Filter & Search
  const [convFilter, setConvFilter] = useState('all'); // 'all' | 'direct' | 'group'
  const [convSearch, setConvSearch] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [showChatSearch, setShowChatSearch] = useState(false);

  // Loading & Error states
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState(null);

  // Modals & Panels
  const [showNewConvModal, setShowNewConvModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeThreadMessage, setActiveThreadMessage] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);

  // Mobile layout state
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const messagesEndRef = useRef(null);
  const sseRef = useRef(null);

  // 1. Initial Load of conversations and presence
  useEffect(() => {
    loadConversations();
    loadPresence();
  }, []);

  // Sync initial conversation id prop
  useEffect(() => {
    if (initialConversationId) {
      setActiveConversationId(initialConversationId);
      setMobileShowChat(true);
    }
  }, [initialConversationId]);

  // 2. Setup Real-time SSE Connection
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const streamUrl = `${API_BASE_URL}/collaboration/messages/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(streamUrl);
    sseRef.current = eventSource;

    eventSource.addEventListener('connected', (e) => {
      // Connected
    });

    eventSource.addEventListener('message:new', (e) => {
      try {
        const payload = JSON.parse(e.data);
        const { conversationId, message } = payload;

        // If message is in currently active conversation, append it
        if (String(conversationId) === String(activeConversationId)) {
          setMessages(prev => {
            if (prev.some(m => m.id === message.id)) return prev;
            return [...prev, message];
          });
          // Mark as read immediately since user is actively viewing it
          markConversationReadApi(conversationId, message.id).catch(() => null);
        }

        // Update conversation in sidebar list
        setConversations(prev => {
          return prev.map(c => {
            if (String(c.id) === String(conversationId)) {
              return {
                ...c,
                last_message_at: message.created_at,
                last_message_preview: message.content,
                unread_count: String(conversationId) === String(activeConversationId) 
                  ? 0 
                  : (Number(c.unread_count) || 0) + 1
              };
            }
            return c;
          }).sort((a, b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at));
        });
      } catch (err) {
        console.warn('Error handling message:new event:', err);
      }
    });

    eventSource.addEventListener('message:edit', (e) => {
      try {
        const { messageId, content, is_edited, edited_at } = JSON.parse(e.data);
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content, is_edited, edited_at } : m));
      } catch (err) {
        console.warn('Error handling message:edit event:', err);
      }
    });

    eventSource.addEventListener('message:delete', (e) => {
      try {
        const { messageId } = JSON.parse(e.data);
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_deleted: true, content: 'This message was deleted.', shared_analytics: null } : m));
      } catch (err) {
        console.warn('Error handling message:delete event:', err);
      }
    });

    eventSource.addEventListener('message:reaction', (e) => {
      try {
        const { messageId, reactions } = JSON.parse(e.data);
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
      } catch (err) {
        console.warn('Error handling message:reaction event:', err);
      }
    });

    eventSource.addEventListener('message:read', (e) => {
      try {
        const { conversationId, userId, userName } = JSON.parse(e.data);
        if (String(conversationId) === String(activeConversationId)) {
          setMessages(prev => prev.map(m => {
            const receipts = m.read_receipts || [];
            if (!receipts.some(r => String(r.user_id) === String(userId))) {
              return {
                ...m,
                read_receipts: [...receipts, { user_id: userId, user_name: userName, read_at: new Date() }]
              };
            }
            return m;
          }));
        }
      } catch (err) {
        console.warn('Error handling message:read event:', err);
      }
    });

    eventSource.addEventListener('presence:update', (e) => {
      try {
        const { userId, status, lastActiveAt } = JSON.parse(e.data);
        setPresence(prev => ({
          ...prev,
          [String(userId)]: { status, lastActiveAt }
        }));
      } catch (err) {
        console.warn('Error handling presence:update event:', err);
      }
    });

    eventSource.addEventListener('typing:update', (e) => {
      try {
        const { conversationId, userId, userName, isTyping } = JSON.parse(e.data);
        if (String(conversationId) === String(activeConversationId) && String(userId) !== String(currentUserId)) {
          setTypingUsers(prev => {
            if (isTyping) {
              return { ...prev, [userId]: userName };
            } else {
              const copy = { ...prev };
              delete copy[userId];
              return copy;
            }
          });
        }
      } catch (err) {
        console.warn('Error handling typing:update event:', err);
      }
    });

    eventSource.onerror = (err) => {
      console.warn('[SSE] EventSource connection notice, browser will auto-reconnect:', err?.message || 'reconnecting');
    };

    return () => {
      eventSource.close();
    };
  }, [activeConversationId, currentUserId]);

  // 3. Load active conversation messages when selected
  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
      markConversationReadApi(activeConversationId).catch(() => null);
    }
  }, [activeConversationId]);

  // 4. Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      setLoadingConvs(true);
      setError(null);
      const res = await getConversationsApi();
      const list = Array.isArray(res.data) ? res.data : [];
      setConversations(list);

      // Default select first conversation if none selected
      if (!activeConversationId && list.length > 0) {
        setActiveConversationId(list[0].id);
        setActiveConversation(list[0]);
      } else if (activeConversationId) {
        const found = list.find(c => c.id === activeConversationId);
        if (found) setActiveConversation(found);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Could not load workspace conversations.');
    } finally {
      setLoadingConvs(false);
    }
  };

  const loadPresence = async () => {
    try {
      const res = await getPresenceApi();
      if (res.data) setPresence(res.data);
    } catch {
      // non-fatal
    }
  };

  const loadMessages = async (convId) => {
    try {
      setLoadingMsgs(true);
      const [detailsRes, msgsRes] = await Promise.all([
        getConversationDetailsApi(convId).catch(() => null),
        getMessagesApi(convId, { limit: 80 })
      ]);

      if (detailsRes?.data) {
        setActiveConversation(detailsRes.data);
      }
      setMessages(Array.isArray(msgsRes.data) ? msgsRes.data : []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMsgs(false);
    }
  };

  // Actions
  const handleSelectConversation = (conv) => {
    setActiveConversationId(conv.id);
    setActiveConversation(conv);
    setMobileShowChat(true);

    // Clear unread count locally
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
  };

  const handleSendMessage = async (payload) => {
    if (!activeConversationId) return;

    // Instant optimistic rendering for 0ms visual latency
    const tempId = `optimistic-${Date.now()}`;
    const cleanContent = payload.content || (payload.sharedAnalytics ? `📊 Shared: ${payload.sharedAnalytics.title || 'Analytics'}` : 'Attachment');
    const optimisticMsg = {
      id: tempId,
      conversation_id: activeConversationId,
      sender_id: currentUserId,
      sender_name: 'You',
      content: cleanContent,
      shared_analytics: payload.sharedAnalytics || null,
      created_at: new Date().toISOString(),
      reply_count: 0,
      attachments: [],
      reactions: [],
      read_receipts: [{ user_id: currentUserId, read_at: new Date() }],
      is_optimistic: true
    };

    setMessages(prev => [...prev, optimisticMsg]);

    // Optimistically update conversation preview in sidebar
    setConversations(prev => prev.map(c => {
      if (String(c.id) === String(activeConversationId)) {
        return {
          ...c,
          last_message_at: optimisticMsg.created_at,
          last_message_preview: optimisticMsg.content
        };
      }
      return c;
    }).sort((a, b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at)));

    try {
      const res = await sendMessageApi(activeConversationId, payload);
      if (res?.data) {
        setMessages(prev => prev.map(m => (m.id === tempId ? res.data : m)));

        // Update real timestamp & preview in sidebar
        setConversations(prev => prev.map(c => {
          if (String(c.id) === String(activeConversationId)) {
            return {
              ...c,
              last_message_at: res.data.created_at,
              last_message_preview: res.data.content
            };
          }
          return c;
        }).sort((a, b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at)));
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      // Mark temporary message as failed so user knows
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, is_failed: true } : m)));
    }
  };

  const handleEditMessage = async (messageId, newContent) => {
    try {
      const res = await editMessageApi(messageId, newContent);
      if (res.data) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent, is_edited: true, edited_at: new Date() } : m));
      }
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await deleteMessageApi(messageId);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_deleted: true, content: 'This message was deleted.', shared_analytics: null } : m));
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleToggleReaction = async (messageId, emoji) => {
    if (!activeConversationId) return;
    try {
      const res = await toggleReactionApi(messageId, { emoji, conversationId: activeConversationId });
      if (res.data?.reactions) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: res.data.reactions } : m));
      }
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  // Filter conversations
  const filteredConversations = conversations
    .filter(c => {
      if (convFilter === 'direct') return c.type === 'direct';
      if (convFilter === 'group') return c.type === 'group';
      return true;
    })
    .filter(c => {
      if (!convSearch.trim()) return true;
      const q = convSearch.toLowerCase();
      const title = (c.type === 'direct' ? c.direct_other_user?.name : c.title) || '';
      const preview = c.last_message_preview || '';
      return title.toLowerCase().includes(q) || preview.toLowerCase().includes(q);
    });

  // Filtered messages in chat
  const displayedMessages = chatSearch.trim()
    ? messages.filter(m => (m.content || '').toLowerCase().includes(chatSearch.toLowerCase()))
    : messages;

  const typingNames = Object.values(typingUsers);

  return (
    <div className="h-[750px] max-h-[82vh] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col md:flex-row">
      {/* ============================================================== */}
      {/* LEFT PANEL: CONVERSATION LIST                                   */}
      {/* ============================================================== */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 ${
        mobileShowChat ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Panel Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Team Messages
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
              {conversations.length}
            </span>
          </div>

          <button
            onClick={() => setShowNewConvModal(true)}
            className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-400 dark:hover:bg-rose-900/50 transition cursor-pointer"
            title="Start New Conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills (All / Direct / Groups) */}
        <div className="px-3 pt-3 flex gap-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'direct', label: 'Direct Messages' },
            { id: 'group', label: 'Groups' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setConvFilter(tab.id)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer text-center ${
                convFilter === tab.id
                  ? 'bg-rose-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="p-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={convSearch}
              onChange={(e) => setConvSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>
        </div>

        {/* Conversation List Scroll Area */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
          {loadingConvs ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
              <span className="text-xs">Loading conversations...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-400 text-xs">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40 text-rose-500" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">No conversations yet</p>
              <p className="mt-1">Click the + button above to start chatting with teammates.</p>
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isSelected = conv.id === activeConversationId;
              const isDirect = conv.type === 'direct';
              const otherUser = conv.direct_other_user;
              const isOnline = isDirect && otherUser && Boolean(presence[String(otherUser.user_id)]?.status === 'online');

              const title = isDirect 
                ? (otherUser?.name || 'Direct Message')
                : (conv.title || conv.team_name || 'Group');

              const unread = Number(conv.unread_count) || 0;

              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`p-3 rounded-2xl transition cursor-pointer flex items-center justify-between gap-3 border ${
                    isSelected
                      ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900/60 shadow-2xs'
                      : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                        isDirect
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'
                      }`}>
                        {isDirect ? (
                          (otherUser?.name || 'U').slice(0, 2).toUpperCase()
                        ) : (
                          <Users2 className="w-5 h-5" />
                        )}
                      </div>
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                      )}
                    </div>

                    {/* Text Preview */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {title}
                        </span>
                        {conv.last_message_at && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {conv.last_message_preview || 'No messages yet'}
                      </p>
                    </div>
                  </div>

                  {/* Unread count badge */}
                  {unread > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold font-mono shrink-0">
                      {unread}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* RIGHT PANEL: ACTIVE CONVERSATION CHAT WINDOW                   */}
      {/* ============================================================== */}
      <div className={`flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-950/40 ${
        mobileShowChat ? 'flex' : 'hidden md:flex'
      }`}>
        {activeConversation ? (
          <>
            {/* Chat Top Header */}
            <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                {/* Mobile Back Button */}
                <button
                  onClick={() => setMobileShowChat(false)}
                  className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="relative">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                    activeConversation.type === 'direct'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                      : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'
                  }`}>
                    {activeConversation.type === 'direct' ? (
                      (activeConversation.direct_other_user?.name || 'U').slice(0, 2).toUpperCase()
                    ) : (
                      <Users2 className="w-5 h-5" />
                    )}
                  </div>
                  {activeConversation.type === 'direct' && activeConversation.direct_other_user?.is_online && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                  )}
                </div>

                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>
                      {activeConversation.type === 'direct'
                        ? activeConversation.direct_other_user?.name || 'Teammate'
                        : activeConversation.title || 'Group Chat'}
                    </span>
                    {activeConversation.team_name && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                        {activeConversation.team_name}
                      </span>
                    )}
                  </h4>

                  <span className="text-[11px] text-slate-400">
                    {activeConversation.type === 'direct' ? (
                      activeConversation.direct_other_user?.is_online ? 'Active now' : 'Offline'
                    ) : (
                      `${activeConversation.participants?.length || 0} participants`
                    )}
                  </span>
                </div>
              </div>

              {/* Chat Actions */}
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => setShowChatSearch(!showChatSearch)}
                  className={`p-2 rounded-xl transition cursor-pointer ${
                    showChatSearch
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title="Search in this conversation"
                >
                  <Search className="w-4 h-4" />
                </button>

                {/* Team link button */}
                {activeConversation.team_id && onNavigateToGroup && (
                  <button
                    onClick={() => onNavigateToGroup(activeConversation.team_id)}
                    className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="View Group details"
                  >
                    <span>View Group</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* In-chat search bar */}
            {showChatSearch && (
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400 ml-2" />
                <input
                  type="text"
                  placeholder="Filter messages in this conversation..."
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
                  autoFocus
                />
                {chatSearch && (
                  <button onClick={() => setChatSearch('')} className="p-1 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {loadingMsgs ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                  <span className="text-xs">Loading message history...</span>
                </div>
              ) : displayedMessages.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-rose-400 opacity-60" />
                  <p className="font-semibold text-slate-700 dark:text-slate-200">
                    {chatSearch ? 'No messages match your search' : 'Start the conversation!'}
                  </p>
                  <p className="mt-1">
                    {chatSearch ? 'Try a different keyword.' : 'Send a message or share live analytics with your team.'}
                  </p>
                </div>
              ) : (
                displayedMessages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    currentUserId={currentUserId}
                    userRole={userRole}
                    onReact={handleToggleReaction}
                    onReply={(m) => setActiveThreadMessage(m)}
                    onEdit={handleEditMessage}
                    onDelete={handleDeleteMessage}
                    onOpenImageModal={(url, name) => setLightboxImage({ url, name })}
                  />
                ))
              )}

              {/* Typing indicator banner */}
              {typingNames.length > 0 && (
                <div className="text-xs text-slate-400 italic flex items-center gap-2 py-1 px-4">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-100" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-200" />
                  </div>
                  <span>{typingNames.join(', ')} is typing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Composer */}
            <MessageComposer
              conversationId={activeConversationId}
              participants={activeConversation.participants}
              onSendMessage={handleSendMessage}
              onOpenShareAnalyticsModal={() => setShowShareModal(true)}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <MessageSquare className="w-12 h-12 text-rose-500 opacity-30 mb-3" />
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">
              No Conversation Selected
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Choose a conversation from the sidebar or click + to start a new chat with your teammates.
            </p>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* THREAD DRAWER                                                  */}
      {/* ============================================================== */}
      <ThreadDrawer
        isOpen={Boolean(activeThreadMessage)}
        onClose={() => setActiveThreadMessage(null)}
        parentMessage={activeThreadMessage}
        currentUserId={currentUserId}
        userRole={userRole}
        conversationId={activeConversationId}
        participants={activeConversation?.participants}
        onReact={handleToggleReaction}
        onEdit={handleEditMessage}
        onDelete={handleDeleteMessage}
      />

      {/* ============================================================== */}
      {/* SHARE ANALYTICS MODAL                                          */}
      {/* ============================================================== */}
      <ShareAnalyticsModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onShare={handleSendMessage}
      />

      {/* ============================================================== */}
      {/* NEW CONVERSATION MODAL                                         */}
      {/* ============================================================== */}
      <NewConversationModal
        isOpen={showNewConvModal}
        onClose={() => setShowNewConvModal(false)}
        users={allUsers}
        teams={teams}
        presence={presence}
        currentUserId={currentUserId}
        onConversationCreated={(newConv) => {
          setConversations(prev => [newConv, ...prev.filter(c => c.id !== newConv.id)]);
          setActiveConversationId(newConv.id);
          setActiveConversation(newConv);
          setMobileShowChat(true);
        }}
      />

      {/* ============================================================== */}
      {/* LIGHTBOX IMAGE PREVIEW MODAL                                   */}
      {/* ============================================================== */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer animate-in fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


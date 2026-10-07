import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, MessageSquare, Share2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  getNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi
} from '../../services/api';

/**
 * Enterprise Notification Bell & Popover Component
 * Strictly uses real backend notification telemetry.
 * Displays NO badge if unreadCount is 0.
 */
export default function Notification({
  isOpen,
  onToggle,
  onClose
}) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const isPopoverOpen = typeof isOpen === 'boolean' ? isOpen : false;

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await getNotificationsApi(20);
      if (res?.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(typeof res.data.unreadCount === 'number' ? res.data.unreadCount : 0);
      }
    } catch (err) {
      console.warn('Failed to fetch notifications:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // When opened, refresh notifications
  useEffect(() => {
    if (isPopoverOpen) {
      loadNotifications();
    }
  }, [isPopoverOpen]);

  // Outside click & Escape listener
  useEffect(() => {
    if (!isPopoverOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        if (onClose) onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (onClose) onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPopoverOpen, onClose]);

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadApi();
      setUnreadCount(0);
      setNotifications((ns) => ns.map((n) => ({ ...n, read_at: new Date().toISOString() })));
    } catch (err) {
      console.warn('Failed to mark notifications read:', err.message);
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.read_at) {
        await markNotificationReadApi(notif.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((ns) =>
          ns.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
        );
      }
      if (onClose) onClose();

      if (notif.resource_type === 'dashboard') navigate('/dashboard');
      else if (notif.resource_type === 'report') navigate('/reports');
      else if (notif.resource_type === 'ai_insight' || notif.resource_type === 'insight') navigate('/ai-insights');
      else if (notif.resource_type === 'alert') navigate('/alerts');
      else navigate('/collaboration');
    } catch (_) {
      if (onClose) onClose();
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef} id="global-notifications-container">
      {/* Notification Bell Button */}
      <button
        type="button"
        id="top-notifications-button"
        onClick={handleToggle}
        className={`relative h-10 w-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer select-none ${
          isPopoverOpen
            ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 ring-2 ring-rose-100 dark:ring-rose-900/50 shadow-xs'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750 hover:text-slate-900 dark:hover:text-white shadow-2xs'
        }`}
        aria-label="View notifications"
        aria-expanded={isPopoverOpen}
        aria-haspopup="true"
      >
        <Bell className="h-4.5 w-4.5" strokeWidth={1.9} />

        {/* Real Data Badge: ONLY shown when unreadCount > 0, NEVER hardcoded */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-rose-500 font-mono text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900 shadow-2xs animate-in zoom-in-75 duration-150">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Card */}
      {isPopoverOpen && (
        <div
          role="region"
          aria-label="Notifications panel"
          className="absolute right-0 mt-2 w-84 sm:w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-850 shadow-xl z-50 text-xs overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-750 bg-slate-50/70 dark:bg-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-bold font-mono">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-semibold hover:text-rose-800 dark:hover:text-rose-300 transition cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-84 overflow-y-auto p-2.5 space-y-1.5 divide-y-0">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-slate-400 dark:text-slate-500 space-y-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 mx-auto">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">All caught up!</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[200px] mx-auto leading-normal">
                  No unread alerts, report broadcasts, or team mentions at this time.
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.read_at;
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition text-left ${
                      isUnread
                        ? 'bg-rose-50/60 dark:bg-rose-950/40 border border-rose-100/80 dark:border-rose-900/60 hover:bg-rose-100/60 dark:hover:bg-rose-900/50'
                        : 'bg-slate-50/40 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shrink-0 mt-0.5 shadow-2xs">
                      {notif.type === 'mention' ? (
                        <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      ) : notif.type === 'share' ? (
                        <Share2 className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                      ) : (
                        <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                          {notif.title || 'Notification'}
                        </p>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-mono">
                          {notif.created_at
                            ? new Date(notif.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : ''}
                        </span>
                      </div>

                      {/* Naturally wrapping message text without overflow */}
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed break-words whitespace-normal line-clamp-3">
                        {notif.message || ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

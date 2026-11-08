import React, { useState } from 'react';
import {
  Check,
  CheckCheck,
  Smile,
  MessageSquare,
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  Download,
  FileText,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  CheckCircle2,
  X
} from 'lucide-react';
import InteractiveAnalyticsCard from './InteractiveAnalyticsCard';

const QUICK_EMOJIS = ['👍', '❤️', '🚀', '👀', '🎉', '🔥'];

export default function MessageBubble({
  message,
  currentUserId,
  userRole,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onOpenImageModal
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');

  const isCurrentUser = Number(message.sender_id) === Number(currentUserId);
  const isAdmin = ['admin', 'manager', 'owner'].includes(String(userRole).toLowerCase());
  const isDeleted = Boolean(message.is_deleted);

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowActionMenu(false);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (editContent.trim() && editContent !== message.content) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditingInline(false);
  };

  // Helper to highlight mentions in text
  const renderMessageContent = (text) => {
    if (!text) return null;
    const parts = text.split(/(@[a-zA-Z0-9_\s]+?(?=\s|$|[.,!?]))/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={index}
            className="inline-block px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 font-semibold text-[13px] mx-0.5"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const getFileIcon = (fileType) => {
    const type = (fileType || '').toLowerCase();
    if (type.includes('image')) return ImageIcon;
    if (type.includes('csv') || type.includes('excel') || type.includes('spreadsheet')) return FileSpreadsheet;
    if (type.includes('json') || type.includes('javascript')) return FileCode;
    return FileText;
  };

  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '';
    const b = Number(bytes);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Read status: check if other participants have read
  const isReadByOthers = Array.isArray(message.read_receipts) && message.read_receipts.some(r => Number(r.user_id) !== Number(currentUserId));

  return (
    <div className={`group relative flex gap-3 my-3 px-2 sm:px-4 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Sender Avatar / Initials */}
      <div className="shrink-0 self-end mb-1">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-2xs ${
          isCurrentUser
            ? 'bg-rose-600 text-white'
            : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
        }`}>
          {message.sender_avatar ? (
            <img src={message.sender_avatar} alt={message.sender_name} className="w-full h-full rounded-full object-cover" />
          ) : (
            (message.sender_name || 'U').slice(0, 2).toUpperCase()
          )}
        </div>
      </div>

      {/* Bubble Container */}
      <div className={`max-w-[85%] sm:max-w-[70%] flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}>
        {/* Name & Time Header */}
        <div className={`flex items-center gap-2 mb-1 text-[11px] text-slate-400 dark:text-slate-500 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {isCurrentUser ? 'You' : message.sender_name}
          </span>
          {message.sender_role && (
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
              {message.sender_role}
            </span>
          )}
          <span>{formatTime(message.created_at)}</span>
        </div>

        {/* Message Bubble Box */}
        <div className={`relative rounded-2xl px-4 py-2.5 text-sm transition shadow-2xs ${
          isDeleted
            ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 italic border border-slate-200 dark:border-slate-800'
            : isCurrentUser
              ? 'bg-rose-600 text-white rounded-br-xs'
              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-bl-xs'
        }`}>
          {/* Inline Edit Form */}
          {isEditingInline ? (
            <form onSubmit={handleSaveEdit} className="space-y-2 min-w-[240px]">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                rows={3}
                autoFocus
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditingInline(false)}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-1 text-xs rounded-md bg-rose-600 text-white hover:bg-rose-700 font-semibold"
                >
                  Save
                </button>
              </div>
            </form>
          ) : (
            <div>
              {/* Content text */}
              <p className="whitespace-pre-wrap break-words leading-relaxed select-text">
                {renderMessageContent(message.content)}
              </p>

              {/* Edited marker */}
              {message.is_edited && !isDeleted && (
                <span className={`text-[10px] font-medium ml-1.5 opacity-75 ${isCurrentUser ? 'text-rose-100' : 'text-slate-400'}`}>
                  (edited)
                </span>
              )}
            </div>
          )}

          {/* Interactive Analytics Card */}
          {message.shared_analytics && !isDeleted && (
            <InteractiveAnalyticsCard data={message.shared_analytics} isSender={isCurrentUser} />
          )}

          {/* Attachments */}
          {Array.isArray(message.attachments) && message.attachments.length > 0 && !isDeleted && (
            <div className="mt-2.5 space-y-2">
              {message.attachments.map((att) => {
                const isImage = (att.file_type || '').includes('image');
                const FileIconComponent = getFileIcon(att.file_type);

                return (
                  <div key={att.id} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black/5 dark:bg-black/20 p-2">
                    {isImage ? (
                      <div>
                        <img
                          src={`/api/collaboration/messages/attachments/${att.id}`}
                          alt={att.file_name}
                          className="max-h-56 max-w-full rounded-lg object-contain cursor-pointer hover:opacity-90 transition"
                          onClick={() => onOpenImageModal && onOpenImageModal(`/api/collaboration/messages/attachments/${att.id}`, att.file_name)}
                        />
                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                          <span className="truncate max-w-[180px]">{att.file_name}</span>
                          <span>{formatFileSize(att.file_size)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3 p-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileIconComponent className="w-5 h-5 text-rose-500 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold truncate block max-w-[200px]">
                              {att.file_name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatFileSize(att.file_size)}
                            </span>
                          </div>
                        </div>
                        <a
                          href={`/api/collaboration/messages/attachments/${att.id}`}
                          download={att.file_name}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                          title="Download attachment"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Delivery & Read checkmark (for current user) */}
          {isCurrentUser && !isDeleted && (
            <div className="mt-1 flex items-center justify-end text-rose-200 text-[10px] gap-0.5">
              {isReadByOthers ? (
                <span title="Read by teammate" className="flex items-center gap-0.5 font-bold text-white">
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Read</span>
                </span>
              ) : (
                <span title="Sent to workspace" className="flex items-center gap-0.5 text-rose-200">
                  <Check className="w-3 h-3" />
                  <span>Sent</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Emoji Reactions Pill Bar */}
        {Array.isArray(message.reactions) && message.reactions.length > 0 && !isDeleted && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(message.id, r.emoji)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition cursor-pointer border ${
                  r.has_reacted
                    ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                }`}
                title={r.users ? r.users.map(u => u.name).join(', ') : ''}
              >
                <span>{r.emoji}</span>
                <span className="text-[11px] font-mono">{r.count}</span>
              </button>
            ))}

            {/* Quick + Add Reaction button */}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition cursor-pointer"
              title="Add reaction"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Thread replies button */}
        {Number(message.reply_count) > 0 && (
          <button
            onClick={() => onReply(message)}
            className="mt-1 text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1.5 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}</span>
          </button>
        )}
      </div>

      {/* Hover Action Toolbar (Quick Emojis, Reply, Copy, Edit, Delete) */}
      {!isDeleted && (
        <div className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md rounded-xl p-1 z-10 ${
          isCurrentUser ? 'right-12' : 'left-12'
        }`}>
          {/* Quick reactions */}
          {QUICK_EMOJIS.slice(0, 3).map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReact(message.id, emoji)}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition cursor-pointer"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}

          <div className="w-[1px] h-3 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Reply in thread */}
          <button
            onClick={() => onReply(message)}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
            title="Reply in thread"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>

          {/* Copy message */}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
            title="Copy message"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Edit (Author only) */}
          {isCurrentUser && (
            <button
              onClick={() => {
                setEditContent(message.content);
                setIsEditingInline(true);
              }}
              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
              title="Edit message"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete (Author or Admin) */}
          {(isCurrentUser || isAdmin) && (
            <button
              onClick={() => onDelete(message.id)}
              className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
              title="Delete message"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Popover Emoji Picker */}
      {showEmojiPicker && (
        <div className="absolute z-20 mt-8 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl flex gap-1.5 flex-wrap max-w-[200px]">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReact(message.id, emoji);
                setShowEmojiPicker(false);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-sm cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

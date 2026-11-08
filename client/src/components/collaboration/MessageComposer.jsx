import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  BarChart3,
  X,
  Loader2,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import { uploadMessageAttachmentApi, sendTypingIndicatorApi } from '../../services/api';

const QUICK_EMOJIS = ['😀', '😂', '🔥', '👍', '❤️', '🚀', '🎉', '👏', '👀', '💡', '✅', '📈'];

export default function MessageComposer({
  conversationId,
  participants = [],
  onSendMessage,
  onOpenShareAnalyticsModal,
  parentMessage = null, // If replying in a thread
  disabled = false
}) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionsList, setMentionsList] = useState([]);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [content]);

  // Handle input changes, typing events, and @mentions trigger
  const handleChange = (e) => {
    const val = e.target.value;
    setContent(val);

    // Typing indicator
    if (conversationId) {
      sendTypingIndicatorApi(conversationId, true).catch(() => null);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingIndicatorApi(conversationId, false).catch(() => null);
      }, 3000);
    }

    // Check for @mention trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([a-zA-Z0-9_\s]*)$/);

    if (atMatch) {
      setMentionFilter(atMatch[1].toLowerCase());
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const handleSelectMention = (user) => {
    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = content.slice(0, cursorPos);
    const textAfterCursor = content.slice(cursorPos);
    const newBefore = textBeforeCursor.replace(/@([a-zA-Z0-9_\s]*)$/, `@${user.name} `);

    setContent(newBefore + textAfterCursor);
    setShowMentions(false);

    if (!mentionsList.includes(user.user_id || user.id)) {
      setMentionsList([...mentionsList, user.user_id || user.id]);
    }

    textareaRef.current?.focus();
  };

  const handleInsertEmoji = (emoji) => {
    setContent(prev => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setUploadError('File exceeds maximum size of 25 MB.');
      return;
    }

    setUploadError(null);
    setUploadingFile(true);

    try {
      const res = await uploadMessageAttachmentApi(file);
      if (res.data) {
        setAttachments(prev => [...prev, res.data]);
      }
    } catch (err) {
      console.error('Attachment upload failed:', err);
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (attId) => {
    setAttachments(prev => prev.filter(a => a.id !== attId));
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    const trimmed = content.trim();

    if (!trimmed && attachments.length === 0) {
      return;
    }

    onSendMessage({
      content: trimmed,
      attachmentIds: attachments.map(a => a.id),
      mentions: mentionsList,
      parentMessageId: parentMessage?.id || null
    });

    setContent('');
    setAttachments([]);
    setMentionsList([]);
    setShowEmojiPicker(false);
    setShowMentions(false);

    if (conversationId) {
      sendTypingIndicatorApi(conversationId, false).catch(() => null);
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Filter participants for @mentions
  const filteredParticipants = (participants || []).filter(p => {
    const name = (p.name || '').toLowerCase();
    return name.includes(mentionFilter);
  });

  return (
    <div className="relative border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-b-2xl">
      {/* Uploaded attachments preview chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
            >
              <FileText className="w-4 h-4 text-rose-500" />
              <span className="truncate max-w-[150px] font-medium">{att.file_name}</span>
              <button
                type="button"
                onClick={() => handleRemoveAttachment(att.id)}
                className="text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload error banner */}
      {uploadError && (
        <div className="mb-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="text-rose-400 hover:text-rose-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Composer Box */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 focus-within:border-rose-500 dark:focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20 transition p-2.5">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={parentMessage ? `Reply to ${parentMessage.sender_name}...` : 'Type a message... (Shift + Enter for newline, @ to mention)'}
          disabled={disabled}
          rows={1}
          className="w-full bg-transparent resize-none text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none max-h-36 leading-relaxed"
        />

        {/* Toolbar footer */}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-200/60 dark:border-slate-700/50">
          <div className="flex items-center gap-1 sm:gap-2">
            {/* File upload button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.csv,.xlsx,.xls,.json,.txt,.doc,.docx"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile || disabled}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition cursor-pointer"
              title="Attach document or image (up to 25MB)"
            >
              {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin text-rose-500" /> : <Paperclip className="w-4 h-4" />}
            </button>

            {/* Emoji picker trigger */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              disabled={disabled}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition cursor-pointer"
              title="Add emoji"
            >
              <Smile className="w-4 h-4" />
            </button>

            {/* Share live analytics button */}
            <button
              type="button"
              onClick={onOpenShareAnalyticsModal}
              disabled={disabled}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
              title="Share interactive KPI, Chart, AI Insight, or Dashboard"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Share Analytics</span>
            </button>
          </div>

          {/* Send button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={(!content.trim() && attachments.length === 0) || disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-xs shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Popover Emojis */}
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-4 z-30 p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl grid grid-cols-6 gap-2 w-56 animate-in fade-in zoom-in-95">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleInsertEmoji(emoji)}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-base cursor-pointer transition"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* @Mentions Popover Autocomplete */}
      {showMentions && filteredParticipants.length > 0 && (
        <div className="absolute bottom-20 left-4 z-30 max-h-48 w-64 overflow-y-auto rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-1.5 space-y-1 animate-in fade-in">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Mention Member
          </div>
          {filteredParticipants.map((user) => (
            <button
              key={user.user_id || user.id}
              onClick={() => handleSelectMention(user)}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left hover:bg-rose-50 dark:hover:bg-rose-950/60 transition cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                {(user.name || 'U').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate block">
                  {user.name}
                </span>
                <span className="text-[10px] text-slate-400 truncate block">
                  {user.email || user.role}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


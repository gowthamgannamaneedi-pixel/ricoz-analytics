import React, { useState, useEffect } from 'react';
import {
  X,
  MessageSquare,
  Send,
  CornerDownRight,
  Edit2,
  Trash2,
  AtSign,
  Clock,
  Loader2,
  AlertCircle
} from 'lucide-react';
import {
  getCommentsApi,
  postCommentApi,
  updateCommentApi,
  deleteCommentApi
} from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Threaded Collaboration Comments & Annotations Panel
 */
export default function CommentsPanel({
  isOpen,
  onClose,
  resourceType, // 'dashboard' | 'report' | 'insight'
  resourceId,
  resourceTitle = 'Resource'
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [replyingTo, setReplyingTo] = useState(null); // comment object
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && resourceId) {
      loadComments();
    }
  }, [isOpen, resourceId, resourceType]);

  const loadComments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getCommentsApi(resourceType, resourceId);
      setComments(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load comments.');
    } finally {
      setLoading(false);
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      await postCommentApi({
        resourceType,
        resourceId,
        parentCommentId: replyingTo ? replyingTo.id : null,
        content: newContent
      });

      setNewContent('');
      setReplyingTo(null);
      await loadComments();
    } catch (err) {
      setError(err.message || 'Failed to post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (commentId) => {
    if (!editContent.trim()) return;
    try {
      await updateCommentApi(commentId, editContent);
      setEditingCommentId(null);
      setEditContent('');
      await loadComments();
    } catch (err) {
      setError(err.message || 'Failed to update comment.');
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await deleteCommentApi(commentId);
      await loadComments();
    } catch (err) {
      setError(err.message || 'Failed to delete comment.');
    }
  };

  const renderCommentThread = (comment, isReply = false) => {
    const isEditing = editingCommentId === comment.id;
    const isAuthor = Number(comment.user_id) === Number(user?.id);
    const canDelete = isAuthor || user?.role === 'admin' || user?.role === 'manager';

    return (
      <div
        key={comment.id}
        className={`rounded-xl border p-3 transition ${
          isReply
            ? 'ml-6 mt-2 bg-slate-50/70 dark:bg-[#0F172A]/70 border-slate-200/60 dark:border-[#334155]'
            : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-[#334155] shadow-2xs'
        }`}
      >
        {/* Author Header */}
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100/80 dark:border-[#334155]/60">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 dark:bg-[#2A1422] font-mono text-[10px] font-bold text-[#D91542] dark:text-[#FB7185]">
              {comment.author_name ? comment.author_name.slice(0, 2).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs text-slate-800 dark:text-[#F8FAFC]">{comment.author_name}</span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-[#1E293B] text-slate-500 dark:text-[#94A3B8] uppercase">
                  {comment.author_role}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-[#94A3B8]">
            <Clock className="h-3 w-3" />
            <span>{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] p-2 text-xs text-slate-800 dark:text-[#F8FAFC] focus:outline-none focus:border-rose-500"
              rows={2}
            />
            <div className="flex justify-end gap-1.5">
              <button
                onClick={() => setEditingCommentId(null)}
                className="px-2 py-1 text-[11px] text-slate-500 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#1E293B] rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveEdit(comment.id)}
                className="px-2.5 py-1 text-[11px] font-semibold bg-[#D91542] dark:bg-[#D91542] text-white rounded hover:bg-[#B91238] dark:hover:bg-[#B91238]"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 text-xs text-slate-700 dark:text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">
            {comment.content}
          </div>
        )}

        {/* Action Toolbar */}
        {!isEditing && (
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 dark:text-[#94A3B8] pt-1.5 border-t border-slate-50 dark:border-[#334155]/60">
            {!isReply && (
              <button
                onClick={() => {
                  setReplyingTo(comment);
                  setNewContent(`@${comment.author_name?.split(' ')[0]} `);
                }}
                className="flex items-center gap-1 text-rose-600 dark:text-[#FB7185] hover:text-rose-700 dark:hover:text-[#FB7185] font-medium"
              >
                <CornerDownRight className="h-3 w-3" />
                <span>Reply</span>
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {isAuthor && (
                <button
                  onClick={() => {
                    setEditingCommentId(comment.id);
                    setEditContent(comment.content);
                  }}
                  className="hover:text-slate-600 dark:hover:text-[#F8FAFC]"
                  title="Edit comment"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="hover:text-red-600 dark:hover:text-red-400"
                  title="Delete comment"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Nested Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-2 mt-2">
            {comment.replies.map(reply => renderCommentThread(reply, true))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white dark:bg-[#111827] shadow-2xl border-l border-slate-200 dark:border-[#334155]">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-[#334155] bg-slate-50/50 dark:bg-[#0F172A]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#FFF1F3] dark:bg-[#2A1422] text-[#D91542] dark:text-[#FB7185] border border-rose-200/80 dark:border-[#FB7185]/30">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-[#F8FAFC] text-xs">Discussion & Annotations</h3>
            <p className="text-[10px] text-slate-500 dark:text-[#94A3B8] truncate max-w-[240px]">{resourceTitle}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:bg-slate-200/60 dark:hover:bg-[#1E293B] hover:text-slate-700 dark:hover:text-[#F8FAFC] transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="m-3 flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 dark:bg-[#2A1422] border border-rose-200 dark:border-[#FB7185]/40 text-xs text-rose-700 dark:text-[#FB7185]">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Comment List Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400 dark:text-[#94A3B8]">Loading discussion...</div>
        ) : comments.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 dark:text-[#94A3B8]">
            <MessageSquare className="h-8 w-8 text-slate-200 dark:text-[#334155] mx-auto mb-2" />
            <p className="font-medium text-slate-600 dark:text-[#CBD5E1]">No comments yet</p>
            <p className="text-[11px] text-slate-400 dark:text-[#94A3B8] mt-0.5">
              Start the discussion or tag teammates with @username.
            </p>
          </div>
        ) : (
          comments.map(c => renderCommentThread(c))
        )}
      </div>

      {/* Reply Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-rose-50/80 dark:bg-[#2A1422] border-t border-rose-100 dark:border-[#FB7185]/30 text-xs text-rose-700 dark:text-[#FB7185]">
          <span className="truncate">Replying to <strong>{replyingTo.author_name}</strong></span>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-0.5 hover:text-rose-900 dark:hover:text-rose-300 text-[11px]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Input Box */}
      <form onSubmit={handlePostComment} className="p-3 border-t border-slate-100 dark:border-[#334155] bg-white dark:bg-[#111827]">
        <div className="relative">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Type comment or mention @teammate..."
            className="w-full rounded-xl border border-slate-200 dark:border-[#334155] bg-slate-50/50 dark:bg-[#0F172A] p-2.5 pr-10 text-xs text-slate-800 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder:text-[#94A3B8] focus:border-rose-500 focus:bg-white dark:focus:bg-[#0F172A] focus:outline-none resize-none"
            rows={3}
          />
          <button
            type="submit"
            disabled={submitting || !newContent.trim()}
            className="absolute right-2 bottom-2.5 p-1.5 rounded-lg bg-[#D91542] dark:bg-[#D91542] text-white hover:bg-[#B91238] dark:hover:bg-[#B91238] disabled:opacity-40 transition cursor-pointer"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
      </form>
    </div>
  );
}

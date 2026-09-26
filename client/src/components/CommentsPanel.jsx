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
            ? 'ml-6 mt-2 bg-slate-50/70 border-slate-200/60'
            : 'bg-white border-slate-200 shadow-2xs'
        }`}
      >
        {/* Author Header */}
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100/80">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 font-mono text-[10px] font-bold text-blue-700">
              {comment.author_name ? comment.author_name.slice(0, 2).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs text-slate-800">{comment.author_name}</span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-500 uppercase">
                  {comment.author_role}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-slate-400">
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
              className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:border-blue-600"
              rows={2}
            />
            <div className="flex justify-end gap-1.5">
              <button
                onClick={() => setEditingCommentId(null)}
                className="px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveEdit(comment.id)}
                className="px-2.5 py-1 text-[11px] font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
            {comment.content}
          </div>
        )}

        {/* Action Toolbar */}
        {!isEditing && (
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-50">
            {!isReply && (
              <button
                onClick={() => {
                  setReplyingTo(comment);
                  setNewContent(`@${comment.author_name?.split(' ')[0]} `);
                }}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
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
                  className="hover:text-slate-600"
                  title="Edit comment"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="hover:text-red-600"
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
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl border-l border-slate-200">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-xs">Discussion & Annotations</h3>
            <p className="text-[10px] text-slate-500 truncate max-w-[240px]">{resourceTitle}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="m-3 flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Comment List Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading discussion...</div>
        ) : comments.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <MessageSquare className="h-8 w-8 text-slate-200 mx-auto mb-2" />
            <p className="font-medium text-slate-600">No comments yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Start the discussion or tag teammates with @username.
            </p>
          </div>
        ) : (
          comments.map(c => renderCommentThread(c))
        )}
      </div>

      {/* Reply Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-blue-50 border-t border-blue-100 text-xs text-blue-700">
          <span className="truncate">Replying to <strong>{replyingTo.author_name}</strong></span>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-0.5 hover:text-blue-900 text-[11px]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Input Box */}
      <form onSubmit={handlePostComment} className="p-3 border-t border-slate-100 bg-white">
        <div className="relative">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Type comment or mention @teammate..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 pr-10 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none resize-none"
            rows={3}
          />
          <button
            type="submit"
            disabled={submitting || !newContent.trim()}
            className="absolute right-2 bottom-2.5 p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition cursor-pointer"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
      </form>
    </div>
  );
}

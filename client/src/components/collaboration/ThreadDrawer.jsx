import React, { useState, useEffect } from 'react';
import {
  X,
  MessageSquare,
  Loader2,
  AlertCircle
} from 'lucide-react';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import { getMessagesApi, sendMessageApi } from '../../services/api';

export default function ThreadDrawer({
  isOpen,
  onClose,
  parentMessage,
  currentUserId,
  userRole,
  conversationId,
  participants = [],
  onReact,
  onEdit,
  onDelete
}) {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && parentMessage && conversationId) {
      loadReplies();
    }
  }, [isOpen, parentMessage?.id, conversationId]);

  const loadReplies = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMessagesApi(conversationId, {
        parentMessageId: parentMessage.id,
        limit: 100
      });
      setReplies(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load thread replies:', err);
      setError('Could not load thread replies.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async ({ content, attachmentIds, mentions }) => {
    try {
      const res = await sendMessageApi(conversationId, {
        content,
        parentMessageId: parentMessage.id,
        attachmentIds,
        mentions
      });
      if (res.data) {
        setReplies(prev => [...prev, res.data]);
      }
    } catch (err) {
      console.error('Failed to send thread reply:', err);
    }
  };

  if (!isOpen || !parentMessage) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] md:w-[480px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Thread
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            ({replies.length} {replies.length === 1 ? 'reply' : 'replies'})
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Thread Content Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Parent Message (Pinned at top) */}
        <div className="pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
            Original Message
          </div>
          <MessageBubble
            message={parentMessage}
            currentUserId={currentUserId}
            userRole={userRole}
            onReact={onReact}
            onReply={() => {}}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>

        {/* Replies List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
            <span className="text-xs">Loading replies...</span>
          </div>
        ) : error ? (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        ) : replies.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            No replies yet. Be the first to start the thread discussion!
          </div>
        ) : (
          <div className="space-y-3">
            {replies.map(reply => (
              <MessageBubble
                key={reply.id}
                message={reply}
                currentUserId={currentUserId}
                userRole={userRole}
                onReact={onReact}
                onReply={() => {}}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reply Composer */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90">
        <MessageComposer
          conversationId={conversationId}
          participants={participants}
          parentMessage={parentMessage}
          onSendMessage={handleSendReply}
          onOpenShareAnalyticsModal={() => {}}
        />
      </div>
    </div>
  );
}


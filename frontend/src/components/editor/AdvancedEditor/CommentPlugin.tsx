/**
 * Comment Plugin for Advanced Editor
 * Standalone commenting system - Google Docs-like sidebar
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Check, Trash2, MoreVertical, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';

// Comment data structure
export interface Comment {
  id: string;
  text: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: Date;
  resolved: boolean;
  replies: CommentReply[];
  anchorText: string;
  anchorOffset: number;
}

export interface CommentReply {
  id: string;
  text: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: Date;
}

interface CommentPluginProps {
  onAddComment?: (comment: Omit<Comment, 'id' | 'createdAt' | 'replies' | 'resolved'>) => void;
  onResolveComment?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onAddReply?: (commentId: string, text: string) => void;
  currentUser: {
    id: string;
    name: string;
    avatar?: string;
  };
}

// Generate unique IDs
function generateId(): string {
  return `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function CommentPlugin({
  onAddComment,
  onResolveComment,
  onDeleteComment,
  onAddReply,
  currentUser,
}: CommentPluginProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showAddComment, setShowAddComment] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Add a new comment
  const handleAddComment = useCallback(() => {
    if (!newCommentText.trim()) return;

    const newComment: Comment = {
      id: generateId(),
      text: newCommentText.trim(),
      author: currentUser,
      createdAt: new Date(),
      resolved: false,
      replies: [],
      anchorText: 'Selected text',
      anchorOffset: 0,
    };

    setComments(prev => [...prev, newComment]);
    onAddComment?.(newComment);

    setNewCommentText('');
    setShowAddComment(false);
  }, [newCommentText, currentUser, onAddComment]);

  // Resolve a comment
  const handleResolveComment = useCallback((commentId: string) => {
    setComments(prev =>
      prev.map(c =>
        c.id === commentId ? { ...c, resolved: true } : c
      )
    );
    onResolveComment?.(commentId);
    setActiveCommentId(null);
  }, [onResolveComment]);

  // Delete a comment
  const handleDeleteComment = useCallback((commentId: string) => {
    setComments(prev => prev.filter(c => c.id !== commentId));
    onDeleteComment?.(commentId);
    setActiveCommentId(null);
  }, [onDeleteComment]);

  // Add reply
  const handleAddReply = useCallback((commentId: string) => {
    if (!replyText.trim()) return;

    const reply: CommentReply = {
      id: generateId(),
      text: replyText.trim(),
      author: currentUser,
      createdAt: new Date(),
    };

    setComments(prev =>
      prev.map(c =>
        c.id === commentId
          ? { ...c, replies: [...c.replies, reply] }
          : c
      )
    );
    onAddReply?.(commentId, replyText.trim());

    setReplyText('');
    setReplyingTo(null);
  }, [replyText, currentUser, onAddReply]);

  // Focus input when showing add comment
  useEffect(() => {
    if (showAddComment && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showAddComment]);

  const activeComments = comments.filter(c => !c.resolved);
  const resolvedComments = comments.filter(c => c.resolved);

  return (
    <div className="w-72 border-l border-gray-200 bg-white overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Comments
          {activeComments.length > 0 && (
            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
              {activeComments.length}
            </span>
          )}
        </h3>
        <button
          onClick={() => setShowAddComment(true)}
          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
        >
          + Add
        </button>
      </div>

      {/* Add comment form */}
      {showAddComment && (
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-start gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium text-xs shrink-0">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{currentUser.name}</p>
            </div>
            <button
              onClick={() => {
                setShowAddComment(false);
                setNewCommentText('');
              }}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <X className="h-3 w-3 text-gray-400" />
            </button>
          </div>
          <textarea
            ref={inputRef}
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Add a comment..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                handleAddComment();
              }
            }}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => {
                setShowAddComment(false);
                setNewCommentText('');
              }}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddComment}
              disabled={!newCommentText.trim()}
              className="px-3 py-1.5 text-xs text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Send className="h-3 w-3" />
              Add
            </button>
          </div>
        </div>
      )}

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {activeComments.length === 0 && resolvedComments.length === 0 && !showAddComment ? (
          <div className="p-6 text-center">
            <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No comments yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Click "+ Add" to add a comment
            </p>
          </div>
        ) : (
          <>
            {/* Active comments */}
            {activeComments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                isActive={activeCommentId === comment.id}
                onActivate={() => setActiveCommentId(comment.id)}
                onResolve={() => handleResolveComment(comment.id)}
                onDelete={() => handleDeleteComment(comment.id)}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                replyText={replyText}
                setReplyText={setReplyText}
                onAddReply={() => handleAddReply(comment.id)}
                currentUser={currentUser}
              />
            ))}

            {/* Resolved comments */}
            {resolvedComments.length > 0 && (
              <div className="p-3 bg-gray-50">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resolved ({resolvedComments.length})
                </p>
              </div>
            )}
            {resolvedComments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                isActive={activeCommentId === comment.id}
                onActivate={() => setActiveCommentId(comment.id)}
                onResolve={() => {}}
                onDelete={() => handleDeleteComment(comment.id)}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                replyText={replyText}
                setReplyText={setReplyText}
                onAddReply={() => handleAddReply(comment.id)}
                currentUser={currentUser}
                isResolved
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// Comment Thread Component
interface CommentThreadProps {
  comment: Comment;
  isActive: boolean;
  onActivate: () => void;
  onResolve: () => void;
  onDelete: () => void;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
  replyText: string;
  setReplyText: (text: string) => void;
  onAddReply: () => void;
  currentUser: { id: string; name: string };
  isResolved?: boolean;
}

function CommentThread({
  comment,
  isActive,
  onActivate,
  onResolve,
  onDelete,
  replyingTo,
  setReplyingTo,
  replyText,
  setReplyText,
  onAddReply,
  currentUser,
  isResolved = false,
}: CommentThreadProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={cn(
        'p-3 cursor-pointer transition-colors',
        isActive ? 'bg-primary-50' : 'hover:bg-gray-50',
        isResolved && 'opacity-60'
      )}
      onClick={onActivate}
    >
      {/* Main comment */}
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium text-xs shrink-0">
          {comment.author.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">{comment.author.name}</p>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">
                {formatTime(comment.createdAt)}
              </span>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <MoreVertical className="h-3 w-3 text-gray-400" />
                </button>
                {showMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                      }}
                    />
                    <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      {!isResolved && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onResolve();
                            setShowMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Check className="h-3 w-3" />
                          Resolve
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete();
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-700 mt-1">{comment.text}</p>
        </div>
      </div>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="mt-3 ml-9 space-y-2 border-l border-gray-200 pl-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium text-xs shrink-0">
                {reply.author.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-gray-900">{reply.author.name}</p>
                  <span className="text-xs text-gray-400">{formatTime(reply.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-600">{reply.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {!isResolved && (
        <>
          {replyingTo === comment.id ? (
            <div className="mt-3 ml-9">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Reply..."
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded resize-none focus:outline-none focus:ring-1 focus:ring-primary-500"
                rows={2}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    onAddReply();
                  }
                }}
              />
              <div className="flex justify-end gap-2 mt-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setReplyingTo(null);
                    setReplyText('');
                  }}
                  className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddReply();
                  }}
                  disabled={!replyText.trim()}
                  className="px-2 py-1 text-xs text-white bg-primary-600 hover:bg-primary-700 rounded disabled:opacity-50"
                >
                  Reply
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setReplyingTo(comment.id);
              }}
              className="mt-2 ml-9 text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <Reply className="h-3 w-3" />
              Reply
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Format time helper
function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default CommentPlugin;

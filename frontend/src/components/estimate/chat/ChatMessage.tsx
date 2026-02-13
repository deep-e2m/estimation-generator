/**
 * ChatMessage Component
 * Modern message bubble with avatar and timestamp
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChatAvatar } from './ChatAvatar';
import { ChangesSummary } from './ChangesSummary';
import type { ChangeDescription } from '@/types/quote.types';

interface ChatMessageProps {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string | Date;
  changes?: ChangeDescription[];
  isLatest?: boolean;
}

export function ChatMessage({
  id,
  role,
  content,
  timestamp,
  changes,
  isLatest = false,
}: ChatMessageProps) {
  const time = new Date(timestamp);
  const formattedTime = time.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.div
      className={cn('chat-message', `chat-message-${role}`)}
      initial={isLatest ? { opacity: 0, y: 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      layout
    >
      {/* Avatar */}
      <div className="chat-message-avatar">
        <ChatAvatar type={role} />
      </div>

      {/* Content */}
      <div className="chat-message-content">
        <div className="chat-message-bubble">
          <p className="chat-message-text">{content}</p>
          
          {/* Changes Summary (for AI responses) */}
          {role === 'assistant' && changes && changes.length > 0 && (
            <ChangesSummary changes={changes} />
          )}
        </div>

        {/* Timestamp */}
        <span className="chat-message-time">{formattedTime}</span>
      </div>
    </motion.div>
  );
}

export default ChatMessage;

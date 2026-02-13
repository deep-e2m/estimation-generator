/**
 * ChatAvatar Component
 * Avatar for user and AI messages in the chat
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatAvatarProps {
  type: 'user' | 'assistant' | 'system';
  isProcessing?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'chat-avatar-sm',
  md: 'chat-avatar-md',
  lg: 'chat-avatar-lg',
};

export function ChatAvatar({ type, isProcessing = false, size = 'md' }: ChatAvatarProps) {
  if (type === 'user') {
    return (
      <div className={cn('chat-avatar chat-avatar-user', sizeClasses[size])}>
        <User className="chat-avatar-icon" />
      </div>
    );
  }

  if (type === 'system') {
    return (
      <div className={cn('chat-avatar chat-avatar-system', sizeClasses[size])}>
        <Sparkles className="chat-avatar-icon" />
      </div>
    );
  }

  // AI/Assistant avatar
  return (
    <div className={cn('chat-avatar chat-avatar-ai', sizeClasses[size])}>
      <motion.div
        className="chat-avatar-ai-inner"
        animate={isProcessing ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Sparkles className="chat-avatar-icon" />
      </motion.div>
      {isProcessing && (
        <motion.div
          className="chat-avatar-ai-ring"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  );
}

export default ChatAvatar;

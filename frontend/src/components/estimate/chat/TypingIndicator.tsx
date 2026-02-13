/**
 * TypingIndicator Component
 * Animated three-dot indicator showing AI is processing
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ChatAvatar } from './ChatAvatar';

interface TypingIndicatorProps {
  message?: string;
}

export function TypingIndicator({ message = 'AI is thinking...' }: TypingIndicatorProps) {
  return (
    <motion.div
      className="chat-typing-indicator"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="chat-typing-avatar">
        <ChatAvatar type="assistant" isProcessing />
      </div>
      
      <div className="chat-typing-content">
        <div className="chat-typing-bubble">
          <div className="chat-typing-dots">
            <motion.span
              className="chat-typing-dot"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
            />
            <motion.span
              className="chat-typing-dot"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
            />
            <motion.span
              className="chat-typing-dot"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
            />
          </div>
        </div>
        <span className="chat-typing-message">{message}</span>
      </div>
    </motion.div>
  );
}

export default TypingIndicator;

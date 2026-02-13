/**
 * ChatEmptyState Component
 * Interactive empty state with suggestion cards for the chat panel
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Plus,
  HelpCircle,
  Trash2,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { SuggestionCard } from './SuggestionCard';

interface ChatEmptyStateProps {
  onSuggestionClick: (message: string) => void;
  projectName?: string;
}

const suggestions = [
  {
    icon: Clock,
    title: 'Modify Hours',
    example: 'Increase the login feature hours to 20',
    color: 'primary' as const,
  },
  {
    icon: Plus,
    title: 'Add Deliverable',
    example: 'Add a QA testing phase with 16 hours',
    color: 'success' as const,
  },
  {
    icon: HelpCircle,
    title: 'Ask Question',
    example: 'What are the assumptions for the timeline?',
    color: 'info' as const,
  },
  {
    icon: Trash2,
    title: 'Remove Item',
    example: 'Remove the blog infrastructure section',
    color: 'warning' as const,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function ChatEmptyState({ onSuggestionClick, projectName }: ChatEmptyStateProps) {
  return (
    <motion.div
      className="chat-empty-state"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div className="chat-empty-header" variants={itemVariants}>
        <div className="chat-empty-icon">
          <div className="chat-empty-icon-inner">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="chat-empty-icon-pulse" />
        </div>
        <h3 className="chat-empty-title">Refine Your Estimate</h3>
        <p className="chat-empty-subtitle">
          Make changes to your estimate using natural language. Ask questions or request modifications.
        </p>
      </motion.div>

      {/* Quick Actions Label */}
      <motion.div className="chat-empty-actions-label" variants={itemVariants}>
        <MessageSquare className="h-4 w-4" />
        <span>Quick Actions</span>
      </motion.div>

      {/* Suggestion Cards Grid */}
      <motion.div className="chat-empty-suggestions" variants={itemVariants}>
        {suggestions.map((suggestion, index) => (
          <SuggestionCard
            key={suggestion.title}
            icon={suggestion.icon}
            title={suggestion.title}
            example={suggestion.example}
            color={suggestion.color}
            onClick={onSuggestionClick}
            delay={index * 0.1}
          />
        ))}
      </motion.div>

      {/* Tips */}
      <motion.div className="chat-empty-tips" variants={itemVariants}>
        <p className="chat-empty-tips-title">Pro Tips</p>
        <ul className="chat-empty-tips-list">
          <li>Be specific about which deliverable you want to change</li>
          <li>You can ask to add, update, or remove any section</li>
          <li>Request explanations about any part of the estimate</li>
        </ul>
      </motion.div>
    </motion.div>
  );
}

export default ChatEmptyState;

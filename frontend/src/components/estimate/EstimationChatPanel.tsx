/**
 * EstimationChatPanel Component
 * Left panel of the split view - conversational interface
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';
import { useQuoteRefinement } from '@/hooks/useQuoteRefinement';
import { ChatEmptyState } from './chat/ChatEmptyState';
import { ChatMessage } from './chat/ChatMessage';
import { TypingIndicator } from './chat/TypingIndicator';
import type { Project, Quote } from '@/types';
import type { ChangeDescription } from '@/types/quote.types';

interface EstimationChatPanelProps {
  project: Project;
  quote: Quote;
  onQuoteUpdated: (quote: Quote, changes: ChangeDescription[]) => void;
  /** When provided, used as the source for refinement so latest editor content (including unsaved) is sent. */
  getCurrentContent?: () => string | undefined;
  /** When true, disable refinement chat (read-only access) */
  readOnly?: boolean;
}

export function EstimationChatPanel({
  project,
  quote,
  onQuoteUpdated,
  getCurrentContent: getCurrentContentProp,
  readOnly = false,
}: EstimationChatPanelProps) {
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getCurrentContentFromQuote = useCallback(() => {
    const summary = quote?.content?.executive_summary;
    return typeof summary === 'string' ? summary : undefined;
  }, [quote?.content?.executive_summary]);

  const getCurrentContent = useCallback(
    () => getCurrentContentProp?.() ?? getCurrentContentFromQuote(),
    [getCurrentContentProp, getCurrentContentFromQuote]
  );

  const { messages, isProcessing, sendMessage } = useQuoteRefinement(
    project.id,
    quote.id,
    getCurrentContent,
    onQuoteUpdated
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [messageInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || isProcessing || readOnly) return;

    const text = messageInput.trim();
    setMessageInput('');

    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Handle suggestion card click - populate input and optionally submit
  const handleSuggestionClick = useCallback((example: string) => {
    setMessageInput(example);
    // Focus the textarea
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="estimation-chat-panel">
      {/* Header */}
      <div className="estimation-chat-header">
        <div className="estimation-chat-header-content">
          <div className="estimation-chat-header-icon">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3>Refine Estimate</h3>
            <p>Ask questions or request changes in natural language</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="estimation-chat-messages">
        <AnimatePresence mode="wait">
          {messages.length === 0 ? (
            <ChatEmptyState 
              key="empty-state"
              onSuggestionClick={handleSuggestionClick}
              projectName={project.name}
            />
          ) : (
            <motion.div
              key="messages"
              className="chat-messages-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  id={message.id}
                  role={message.role}
                  content={message.content}
                  timestamp={message.created_at}
                  changes={(message as { changes?: ChangeDescription[] }).changes}
                  isLatest={index === messages.length - 1}
                />
              ))}
              
              <AnimatePresence>
                {isProcessing && (
                  <TypingIndicator key="typing" message="Processing your request..." />
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-container">
        {readOnly ? (
          <div className="chat-input-readonly text-sm text-gray-500 py-3">
            You have read-only access. Ask the project owner for edit permissions to refine estimates.
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="chat-input-form">
          <div className="chat-input-wrapper">
            <textarea
              ref={textareaRef}
              className="chat-input"
              placeholder="Type your message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isProcessing}
              rows={1}
              maxLength={2000}
            />
            <motion.button
              type="submit"
              className="chat-send-button"
              disabled={!messageInput.trim() || isProcessing}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Send className="h-4 w-4" />
            </motion.button>
          </div>
          <span className="chat-input-hint">
            Shift+Enter for new line
          </span>
        </form>
        )}
      </div>
    </div>
  );
}

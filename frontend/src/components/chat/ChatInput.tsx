/**
 * ChatInput Component
 * Message input area for the chat interface
 *
 * Features:
 * - Auto-resizing textarea
 * - Send button with loading state
 * - Keyboard shortcuts (Enter to send, Shift+Enter for newline)
 * - Disabled state while waiting for response
 * - Character limit indicator
 */

import React, { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_MESSAGE_LENGTH = 10000;
const MIN_TEXTAREA_HEIGHT = 48;
const MAX_TEXTAREA_HEIGHT = 200;

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  isLoading = false,
  placeholder = 'Type your message...',
  className,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDisabled = disabled || isLoading;

  // Auto-resize textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';

      // Calculate new height within bounds
      const newHeight = Math.min(
        Math.max(textarea.scrollHeight, MIN_TEXTAREA_HEIGHT),
        MAX_TEXTAREA_HEIGHT
      );

      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  // Adjust height whenever message changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);

  // Handle message submission
  const handleSubmit = useCallback(() => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !isDisabled) {
      onSend(trimmedMessage);
      setMessage('');

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
      }
    }
  }, [message, isDisabled, onSend]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Enter without Shift
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Handle input change with character limit
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      if (value.length <= MAX_MESSAGE_LENGTH) {
        setMessage(value);
      }
    },
    []
  );

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current && !isDisabled) {
      textareaRef.current.focus();
    }
  }, [isDisabled]);

  const characterCount = message.length;
  const showCharacterCount = characterCount > MAX_MESSAGE_LENGTH * 0.8;
  const isNearLimit = characterCount > MAX_MESSAGE_LENGTH * 0.9;
  const canSend = message.trim().length > 0 && !isDisabled;

  return (
    <div className={cn('chat-input-container', className)}>
      <div className="chat-input-wrapper">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          rows={1}
          className="chat-input-textarea"
          aria-label="Message input"
          aria-describedby={showCharacterCount ? 'chat-char-count' : undefined}
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          className={cn(
            'chat-send-btn',
            canSend && 'chat-send-btn-active'
          )}
          aria-label={isLoading ? 'Sending message...' : 'Send message'}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Character count indicator */}
      {showCharacterCount && (
        <div
          id="chat-char-count"
          className={cn(
            'chat-char-count',
            isNearLimit && 'chat-char-count-warning'
          )}
        >
          {characterCount.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()}
        </div>
      )}

      {/* Keyboard hint */}
      <div className="chat-input-hint">
        Press <kbd>Enter</kbd> to send, <kbd>Shift + Enter</kbd> for new line
      </div>
    </div>
  );
}

export default ChatInput;

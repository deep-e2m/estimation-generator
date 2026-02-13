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
    <div className={cn('space-y-2', className)}>
      <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-white p-2 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          rows={1}
          className="flex-1 resize-none border-none bg-transparent px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
          aria-label="Message input"
          aria-describedby={showCharacterCount ? 'chat-char-count' : undefined}
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          className={cn(
            'flex items-center justify-center h-10 w-10 rounded-xl shrink-0 transition-all',
            canSend
              ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
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
            'text-right text-xs',
            isNearLimit ? 'text-error-600 font-medium' : 'text-slate-400'
          )}
        >
          {characterCount.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()}
        </div>
      )}

      {/* Keyboard hint */}
      <div className="text-center text-xs text-slate-400">
        Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[10px]">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[10px]">Shift + Enter</kbd> for new line
      </div>
    </div>
  );
}

export default ChatInput;

/**
 * ChatInterface Component
 * Main chat component for the AI conversation interface
 *
 * Features:
 * - Message list with scrollable container
 * - Input area at bottom
 * - Streaming response support
 * - Loading states
 * - Auto-scroll to new messages
 * - Empty state for new conversations
 * - AI thinking indicator while waiting for response
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Loader2, AlertCircle, RefreshCw, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateId } from '@/lib/utils';
import { chatService } from '@/services';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import type { ChatMessage as ChatMessageType } from '@/types';

/**
 * ThinkingIndicator Component
 * Displays an animated "AI is thinking..." message while waiting for AI response
 */
function ThinkingIndicator() {
  return (
    <div className="chat-thinking-indicator" role="status" aria-live="polite">
      <div className="chat-thinking-avatar">
        <Bot className="h-4 w-4" />
      </div>
      <div className="chat-thinking-content">
        <div className="chat-thinking-bubble">
          <span className="chat-thinking-text">AI is thinking</span>
          <span className="chat-thinking-dots" aria-hidden="true">
            <span className="chat-thinking-dot" />
            <span className="chat-thinking-dot" />
            <span className="chat-thinking-dot" />
          </span>
        </div>
      </div>
    </div>
  );
}

interface ChatInterfaceProps {
  projectId: string;
  className?: string;
}

export function ChatInterface({ projectId, className }: ChatInterfaceProps) {
  // Message state
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false); // True while waiting for AI response to begin
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortStreamRef = useRef<(() => void) | null>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await chatService.getHistory(projectId);
        setMessages(response.messages);
      } catch (err) {
        setError('Failed to load chat history. Please try again.');
        console.error('Failed to load chat history:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();

    // Cleanup streaming on unmount
    return () => {
      if (abortStreamRef.current) {
        abortStreamRef.current();
      }
    };
  }, [projectId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (!isLoading) {
      scrollToBottom('instant');
    }
  }, [messages.length, isLoading, scrollToBottom]);

  // Scroll during streaming
  useEffect(() => {
    if (isStreaming) {
      scrollToBottom();
    }
  }, [streamingContent, isStreaming, scrollToBottom]);

  // Scroll when thinking indicator appears
  useEffect(() => {
    if (isThinking) {
      scrollToBottom();
    }
  }, [isThinking, scrollToBottom]);

  // Handle sending a message
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (isSending || isStreaming) return;

      // Create optimistic user message
      const userMessage: ChatMessageType = {
        id: generateId(),
        role: 'user',
        content,
        created_at: new Date().toISOString(),
        status: 'sending',
      };

      // Add user message to list
      setMessages((prev) => [...prev, { ...userMessage, status: 'sent' }]);
      setIsSending(true);
      setIsStreaming(true);
      setIsThinking(true); // Show thinking indicator while waiting for AI
      setStreamingContent('');
      setError(null);

      // Create placeholder for assistant message
      const assistantMessageId = generateId();

      // Start streaming
      const cleanup = chatService.streamMessage(
        projectId,
        content,
        {
          onStart: () => {
            // AI has started responding, hide thinking indicator
            setIsThinking(false);
            // Add streaming assistant message placeholder
            const assistantMessage: ChatMessageType = {
              id: assistantMessageId,
              role: 'assistant',
              content: '',
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
          },
          onToken: (token) => {
            setStreamingContent((prev) => prev + token);
            // Update the assistant message content in real-time
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + token }
                  : msg
              )
            );
          },
          onComplete: (fullContent, messageId) => {
            // Update with final content and real message ID
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, id: messageId || msg.id, content: fullContent }
                  : msg
              )
            );
            setIsStreaming(false);
            setIsSending(false);
            setIsThinking(false);
            setStreamingContent('');
            abortStreamRef.current = null;
          },
          onError: (errorMessage) => {
            // Remove the placeholder assistant message on error
            setMessages((prev) =>
              prev.filter((msg) => msg.id !== assistantMessageId)
            );
            setError(errorMessage);
            setIsStreaming(false);
            setIsSending(false);
            setIsThinking(false);
            setStreamingContent('');
            abortStreamRef.current = null;
          },
        }
      );

      abortStreamRef.current = cleanup;
    },
    [projectId, isSending, isStreaming]
  );

  // Handle retry on error
  const handleRetry = useCallback(() => {
    // Find the last user message and resend
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      // Remove the last user message (will be re-added optimistically)
      setMessages((prev) => prev.slice(0, -1));
      setError(null);
      handleSendMessage(lastUserMessage.content);
    }
  }, [messages, handleSendMessage]);

  // Render loading state
  if (isLoading) {
    return (
      <div className={cn('chat-interface', 'chat-loading', className)}>
        <div className="chat-loading-indicator">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          <span className="chat-loading-text">Loading conversation...</span>
        </div>
      </div>
    );
  }

  // Find the streaming message
  const streamingMessageId = isStreaming
    ? messages.find((m) => m.role === 'assistant' && messages.indexOf(m) === messages.length - 1)?.id
    : null;

  return (
    <div className={cn('chat-interface', className)}>
      {/* Messages container */}
      <div ref={messagesContainerRef} className="chat-messages-container">
        {messages.length === 0 ? (
          // Empty state
          <div className="chat-empty-state">
            <div className="chat-empty-icon">
              <MessageSquare className="h-8 w-8" />
            </div>
            <h3 className="chat-empty-title">Start a conversation</h3>
            <p className="chat-empty-description">
              Ask questions about your project requirements, get clarification on scope,
              or discuss the estimate details.
            </p>
            <div className="chat-empty-suggestions">
              <p className="chat-suggestions-label">Try asking:</p>
              <div className="chat-suggestions-list">
                <button
                  onClick={() => handleSendMessage('What details do you need to provide an accurate estimate?')}
                  className="chat-suggestion-btn"
                >
                  What details do you need?
                </button>
                <button
                  onClick={() => handleSendMessage('Can you explain the scope of work?')}
                  className="chat-suggestion-btn"
                >
                  Explain the scope
                </button>
                <button
                  onClick={() => handleSendMessage('What are the main risks for this project?')}
                  className="chat-suggestion-btn"
                >
                  What are the risks?
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Message list
          <div className="chat-messages" role="list" aria-label="Chat messages">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isStreaming={message.id === streamingMessageId}
              />
            ))}
            {/* AI Thinking Indicator - shown while waiting for response */}
            {isThinking && <ThinkingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="chat-error">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
          <button onClick={handleRetry} className="chat-error-retry-btn">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="chat-input-area">
        <ChatInput
          onSend={handleSendMessage}
          disabled={isSending}
          isLoading={isSending}
          placeholder={
            isStreaming
              ? 'Waiting for response...'
              : 'Ask about your project or requirements...'
          }
        />
      </div>
    </div>
  );
}

export default ChatInterface;

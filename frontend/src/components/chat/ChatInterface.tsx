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
    <div className="flex items-start gap-3 px-4 py-3" role="status" aria-live="polite">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-600 shrink-0">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex-1 pt-1">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 text-sm text-slate-600">
          <span>AI is thinking</span>
          <span className="flex items-center gap-0.5" aria-hidden="true">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
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
      <div className={cn('flex flex-col h-full', className)}>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            <span className="text-sm text-slate-500">Loading conversation...</span>
          </div>
        </div>
      </div>
    );
  }

  // Find the streaming message
  const streamingMessageId = isStreaming
    ? messages.find((m) => m.role === 'assistant' && messages.indexOf(m) === messages.length - 1)?.id
    : null;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages container */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-4">
              <MessageSquare className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Start a conversation</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-md">
              Ask questions about your project requirements, get clarification on scope,
              or discuss the estimate details.
            </p>
            <div className="mt-6 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Try asking:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => handleSendMessage('What details do you need to provide an accurate estimate?')}
                  className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  What details do you need?
                </button>
                <button
                  onClick={() => handleSendMessage('Can you explain the scope of work?')}
                  className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  Explain the scope
                </button>
                <button
                  onClick={() => handleSendMessage('What are the main risks for this project?')}
                  className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  What are the risks?
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Message list
          <div className="space-y-1 py-4" role="list" aria-label="Chat messages">
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
        <div className="flex items-center gap-2 px-4 py-3 bg-error-50 text-error-700 text-sm border-t border-error-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={handleRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-error-700 bg-white border border-error-200 rounded-lg hover:bg-error-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-slate-200 bg-white p-4">
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

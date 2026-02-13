/**
 * useQuoteRefinement hook
 * Manages quote refinement state and operations
 */

import { useState, useCallback } from 'react';
import { quoteRefinementService } from '../services/quote-refinement.service';
import type { ChatMessage } from '../types/chat';
import type { Quote, ChangeDescription } from '../types/quote.types';

interface UseQuoteRefinementReturn {
  messages: ChatMessage[];
  isProcessing: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
}

/**
 * Hook for managing quote refinement through conversational interface
 */
export function useQuoteRefinement(
  projectId: string,
  quoteId: string,
  onQuoteUpdated: (quote: Quote, changes: ChangeDescription[]) => void
): UseQuoteRefinementReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isProcessing) return;

      setError(null);
      setIsProcessing(true);

      // Add user message
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
        status: 'sent',
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        // Call refinement API
        const response = await quoteRefinementService.refineQuote(
          projectId,
          quoteId,
          text
        );

        // Add AI response message
        const aiMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.ai_message,
          created_at: new Date().toISOString(),
          status: 'sent',
        };

        setMessages((prev) => [...prev, aiMessage]);

        // Notify parent of quote update
        onQuoteUpdated(response.updated_quote, response.changes_applied);
      } catch (err: any) {
        const errorMessage = err.response?.data?.error?.message || 'Failed to process request';
        setError(errorMessage);

        // Add error message
        const errorMsg: ChatMessage = {
          id: `system-${Date.now()}`,
          role: 'system',
          content: `Error: ${errorMessage}`,
          created_at: new Date().toISOString(),
          status: 'error',
        };

        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsProcessing(false);
      }
    },
    [projectId, quoteId, isProcessing, onQuoteUpdated]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isProcessing,
    error,
    sendMessage,
    clearMessages,
  };
}

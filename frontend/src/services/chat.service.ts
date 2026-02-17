/**
 * Chat API Service
 * Handles all chat-related API calls including streaming support
 */

import { apiClient, LONG_REQUEST_TIMEOUT_MS } from './api';
import type {
  ApiResponse,
  ChatResponse,
  ChatHistoryResponse,
  SendMessageRequest,
  StreamEvent,
} from '@/types';

// Token for auth in SSE requests
function getAuthToken(): string | null {
  return localStorage.getItem('access_token');
}

// Build API base URL for SSE
function getApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    // In development, use the current origin (Vite proxy handles /api routes)
    return window.location.origin;
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:8000';
}

export const chatService = {
  /**
   * Get chat history for a project
   */
  getHistory: async (
    projectId: string,
    cursor?: string,
    limit: number = 50
  ): Promise<ChatHistoryResponse> => {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    params.append('limit', limit.toString());

    const response = await apiClient.get<ApiResponse<ChatHistoryResponse>>(
      `/api/v1/projects/${projectId}/chat?${params.toString()}`
    );
    return response.data.data;
  },

  /**
   * Send a message to the chat (non-streaming)
   */
  sendMessage: async (
    projectId: string,
    content: string,
    context?: SendMessageRequest['context']
  ): Promise<ChatResponse> => {
    const response = await apiClient.post<ApiResponse<ChatResponse>>(
      `/api/v1/projects/${projectId}/chat`,
      { content, context },
      { timeout: LONG_REQUEST_TIMEOUT_MS }
    );
    return response.data.data;
  },

  /**
   * Stream a message response using Server-Sent Events
   * Returns a cleanup function to close the connection
   */
  streamMessage: (
    projectId: string,
    content: string,
    callbacks: {
      onStart?: (messageId: string) => void;
      onToken?: (token: string) => void;
      onComplete?: (fullContent: string, messageId: string) => void;
      onError?: (error: string) => void;
    },
    context?: SendMessageRequest['context']
  ): (() => void) => {
    const token = getAuthToken();
    const baseUrl = getApiBaseUrl();

    // Build URL with query params for SSE
    const url = new URL(`${baseUrl}/api/v1/projects/${projectId}/chat/stream`);

    // Create request body
    const body = JSON.stringify({ content, context });

    // Use fetch with streaming for POST SSE
    const abortController = new AbortController();

    const streamRequest = async () => {
      try {
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body,
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let messageId = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                callbacks.onComplete?.(fullContent, messageId);
                return;
              }

              try {
                const event: StreamEvent = JSON.parse(data);

                switch (event.type) {
                  case 'start':
                    messageId = event.data?.message_id || '';
                    callbacks.onStart?.(messageId);
                    break;
                  case 'token':
                    if (event.data?.token) {
                      fullContent += event.data.token;
                      callbacks.onToken?.(event.data.token);
                    }
                    break;
                  case 'done':
                    fullContent = event.data?.full_content || fullContent;
                    callbacks.onComplete?.(fullContent, messageId);
                    return;
                  case 'error':
                    callbacks.onError?.(event.data?.error || 'Unknown error');
                    return;
                }
              } catch {
                // Skip invalid JSON lines
                console.warn('Invalid SSE data:', data);
              }
            }
          }
        }

        // If we exit the loop without a done event, call complete
        if (fullContent) {
          callbacks.onComplete?.(fullContent, messageId);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Request was cancelled, don't report as error
          return;
        }
        callbacks.onError?.(
          error instanceof Error ? error.message : 'Failed to stream message'
        );
      }
    };

    // Start the streaming request
    streamRequest();

    // Return cleanup function
    return () => {
      abortController.abort();
    };
  },

  /**
   * Clear chat history for a project
   */
  clearHistory: async (projectId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/projects/${projectId}/chat`);
  },
};

export default chatService;

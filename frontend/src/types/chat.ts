/**
 * Chat Type Definitions
 * Types for the AI chat interface in the Estimate AI system
 */

// Message roles
export type MessageRole = 'user' | 'assistant' | 'system';

// Message status for optimistic updates and delivery tracking
export type MessageStatus = 'sending' | 'sent' | 'error';

// Individual chat message
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  status?: MessageStatus;
  metadata?: {
    model_used?: string;
    tokens_used?: number;
    processing_time_ms?: number;
  };
}

// Chat response from API
export interface ChatResponse {
  message: ChatMessage;
  suggestions?: string[];
  context_updated?: boolean;
}

// Streaming chat event types
export type StreamEventType = 'start' | 'token' | 'done' | 'error';

// Streaming event data
export interface StreamEvent {
  type: StreamEventType;
  data?: {
    token?: string;
    message_id?: string;
    full_content?: string;
    error?: string;
  };
}

// Chat history response with pagination
export interface ChatHistoryResponse {
  messages: ChatMessage[];
  pagination: {
    cursor: string | null;
    has_more: boolean;
    total_count: number;
  };
}

// Send message request
export interface SendMessageRequest {
  content: string;
  context?: {
    include_project_context?: boolean;
    include_quotes_context?: boolean;
  };
}

// Chat session state
export interface ChatSession {
  project_id: string;
  messages: ChatMessage[];
  is_streaming: boolean;
  current_streaming_content: string;
  typing_indicator: boolean;
  error?: string;
}

// Typing indicator state
export interface TypingIndicator {
  is_typing: boolean;
  started_at?: string;
}

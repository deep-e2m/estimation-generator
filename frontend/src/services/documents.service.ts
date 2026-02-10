/**
 * Documents API Service
 * Handles document CRUD operations and WebSocket connections for real-time collaboration
 */

import { apiClient } from './api';
import type { ApiResponse } from '@/types';

export interface Document {
  id: string;
  project_id: string;
  title: string;
  content: Record<string, unknown> | null;
  plain_text: string | null;
  document_type: 'quote' | 'proposal' | 'requirements' | 'notes';
  version: number;
  created_by: string;
  last_edited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentCreate {
  title: string;
  document_type?: 'quote' | 'proposal' | 'requirements' | 'notes';
  content?: Record<string, unknown>;
}

export interface DocumentUpdate {
  title?: string;
  content?: Record<string, unknown>;
  plain_text?: string;
}

export interface DocumentListResponse {
  success: boolean;
  data: Document[];
}

export interface DocumentDataResponse {
  success: boolean;
  data: Document;
}

// WebSocket message types
export interface WSMessage {
  type: 'content_update' | 'cursor_update' | 'selection_update' | 'presence' | 'sync';
  content?: Record<string, unknown>;
  version?: number;
  user_id?: string;
  user_name?: string;
  position?: { line: number; column: number };
  selection?: { start: number; end: number };
  action?: 'joined' | 'left';
  active_users?: Array<{ id: string; name: string }>;
}

function getAuthToken(): string | null {
  return localStorage.getItem('access_token');
}

function getWsBaseUrl(): string {
  // For WebSocket, convert http(s) to ws(s)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

export const documentsService = {
  /**
   * List documents for a project
   */
  list: async (
    projectId: string,
    documentType?: string
  ): Promise<Document[]> => {
    const params = new URLSearchParams();
    if (documentType) params.append('document_type', documentType);

    const response = await apiClient.get<DocumentListResponse>(
      `/api/v1/projects/${projectId}/documents?${params.toString()}`
    );
    return response.data.data;
  },

  /**
   * Get a specific document
   */
  get: async (projectId: string, documentId: string): Promise<Document> => {
    const response = await apiClient.get<DocumentDataResponse>(
      `/api/v1/projects/${projectId}/documents/${documentId}`
    );
    return response.data.data;
  },

  /**
   * Create a new document
   */
  create: async (
    projectId: string,
    data: DocumentCreate
  ): Promise<Document> => {
    const response = await apiClient.post<DocumentDataResponse>(
      `/api/v1/projects/${projectId}/documents`,
      data
    );
    return response.data.data;
  },

  /**
   * Update a document
   */
  update: async (
    projectId: string,
    documentId: string,
    data: DocumentUpdate
  ): Promise<Document> => {
    const response = await apiClient.put<DocumentDataResponse>(
      `/api/v1/projects/${projectId}/documents/${documentId}`,
      data
    );
    return response.data.data;
  },

  /**
   * Delete a document
   */
  delete: async (projectId: string, documentId: string): Promise<void> => {
    await apiClient.delete(
      `/api/v1/projects/${projectId}/documents/${documentId}`
    );
  },

  /**
   * Create WebSocket connection for real-time collaboration
   */
  connectWebSocket: (
    documentId: string,
    callbacks: {
      onSync?: (content: Record<string, unknown> | null, version: number, users: Array<{ id: string; name: string }>) => void;
      onContentUpdate?: (content: Record<string, unknown>, version: number, userId: string, userName: string) => void;
      onCursorUpdate?: (userId: string, userName: string, position: { line: number; column: number }) => void;
      onSelectionUpdate?: (userId: string, userName: string, selection: { start: number; end: number }) => void;
      onPresence?: (userId: string, userName: string, action: 'joined' | 'left', activeUsers: Array<{ id: string; name: string }>) => void;
      onError?: (error: string) => void;
      onClose?: () => void;
    }
  ): WebSocket | null => {
    const token = getAuthToken();
    if (!token) {
      callbacks.onError?.('Not authenticated');
      return null;
    }

    const wsUrl = `${getWsBaseUrl()}/api/v1/ws/documents/${documentId}?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected to document:', documentId);
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'sync':
            callbacks.onSync?.(
              message.content || null,
              message.version || 1,
              message.active_users || []
            );
            break;

          case 'content_update':
            if (message.content && message.version && message.user_id && message.user_name) {
              callbacks.onContentUpdate?.(
                message.content,
                message.version,
                message.user_id,
                message.user_name
              );
            }
            break;

          case 'cursor_update':
            if (message.user_id && message.user_name && message.position) {
              callbacks.onCursorUpdate?.(
                message.user_id,
                message.user_name,
                message.position
              );
            }
            break;

          case 'selection_update':
            if (message.user_id && message.user_name && message.selection) {
              callbacks.onSelectionUpdate?.(
                message.user_id,
                message.user_name,
                message.selection
              );
            }
            break;

          case 'presence':
            if (message.user_id && message.user_name && message.action) {
              callbacks.onPresence?.(
                message.user_id,
                message.user_name,
                message.action,
                message.active_users || []
              );
            }
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      callbacks.onError?.('WebSocket connection error');
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      callbacks.onClose?.();
    };

    return ws;
  },

  /**
   * Send content update through WebSocket
   */
  sendContentUpdate: (
    ws: WebSocket,
    content: Record<string, unknown>,
    plainText?: string
  ) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'content_update',
          content,
          plain_text: plainText,
        })
      );
    }
  },

  /**
   * Send cursor position update through WebSocket
   */
  sendCursorUpdate: (
    ws: WebSocket,
    position: { line: number; column: number }
  ) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'cursor_update',
          position,
        })
      );
    }
  },

  /**
   * Send selection update through WebSocket
   */
  sendSelectionUpdate: (
    ws: WebSocket,
    selection: { start: number; end: number }
  ) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'selection_update',
          selection,
        })
      );
    }
  },
};

export default documentsService;

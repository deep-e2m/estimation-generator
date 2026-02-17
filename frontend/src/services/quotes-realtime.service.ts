/**
 * Quotes Realtime Service
 * Lightweight WebSocket client for per-quote realtime updates.
 *
 * This mirrors the documents WebSocket client but is server-push only:
 * the backend sends full quote snapshots whenever a quote changes.
 */

import type { Quote } from '@/types';
import { normalizeQuoteFromApi, type ApiQuote } from '@/lib/quote-normalizer';
import { getAccessToken } from '@/store/authStore';

export type QuoteRealtimeEventType =
  | 'quote.sync'
  | 'quote.updated'
  | 'quote.status_changed'
  | 'quote.deleted';

export interface QuoteRealtimeCallbacks {
  onSync?: (quote: Quote) => void;
  onQuoteUpdated?: (quote: Quote) => void;
  onStatusChanged?: (quote: Quote) => void;
  onDeleted?: (quoteId: string, projectId: string) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
}

interface QuoteRealtimeMessage {
  type: QuoteRealtimeEventType;
  quote_id: string;
  project_id: string;
  payload?: ApiQuote;
}

function getWsBaseUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

export const quotesRealtimeService = {
  /**
   * Open a WebSocket connection for a specific quote.
   *
   * Returns the underlying WebSocket instance or null if not authenticated.
   */
  connect(
    quoteId: string,
    callbacks: QuoteRealtimeCallbacks
  ): WebSocket | null {
    const token = getAccessToken();
    if (!token) {
      callbacks.onError?.('Not authenticated');
      return null;
    }

    const wsUrl = `${getWsBaseUrl()}/api/v1/ws/quotes/${quoteId}?token=${encodeURIComponent(
      token
    )}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Connection established; server will send a quote.sync shortly.
    };

    ws.onmessage = (event) => {
      try {
        const message: QuoteRealtimeMessage = JSON.parse(event.data);

        const { type, quote_id, project_id, payload } = message;

        if (type === 'quote.deleted') {
          callbacks.onDeleted?.(quote_id, project_id);
          return;
        }

        if (!payload) {
          return;
        }

        const quote = normalizeQuoteFromApi(payload);

        switch (type) {
          case 'quote.sync':
            callbacks.onSync?.(quote);
            break;
          case 'quote.updated':
            callbacks.onQuoteUpdated?.(quote);
            break;
          case 'quote.status_changed':
            callbacks.onStatusChanged?.(quote);
            break;
        }
      } catch (error) {
        console.error('Error parsing quote realtime message:', error);
        callbacks.onError?.('Failed to parse realtime update');
      }
    };

    ws.onerror = (event) => {
      console.error('Quote realtime WebSocket error:', event);
      callbacks.onError?.('WebSocket connection error');
    };

    ws.onclose = () => {
      callbacks.onClose?.();
    };

    return ws;
  },
};


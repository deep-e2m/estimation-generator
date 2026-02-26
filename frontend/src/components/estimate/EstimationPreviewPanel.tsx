/**
 * EstimationPreviewPanel Component
 * Right panel of the split view - direct editing of the estimation with
 * auto-save and export capabilities.
 *
 * Features:
 * - Direct editing in the estimation (no preview/edit toggle)
 * - Auto-save with 3-second debounce
 * - Manual save via Ctrl+S
 * - Unsaved changes indicator and beforeunload warning
 * - Export to PDF/DOCX using existing quoteService
 * - Error handling with toast notifications
 * - Document header shown above editor
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { BlockNoteQuoteEditor } from './editor/BlockNoteQuoteEditor';
import { quoteService } from '@/services/quote-generation.service';
import { quotesService } from '@/services/quotes.service';
import type { Quote, Project } from '@/types';
import type { ChangeDescription } from '@/types/quote.types';

interface EstimationPreviewPanelProps {
  quote: Quote;
  project: Project;
  recentChanges?: ChangeDescription[];
  onQuoteSaved?: (updatedQuote: Quote) => void;
  /** Notify parent when the editor is saving or has saved */
  onSaveStatusChange?: (status: 'idle' | 'saving' | 'saved') => void;
  /** Called on every editor change so parent can pass latest content to refinement (avoids stale content when user chats without saving). */
  onEditorContentSnapshot?: (serialized: string) => void;
}

/** Debounce delay for auto-save in milliseconds */
const AUTO_SAVE_DELAY = 3000;

/**
 * Format a date string for display in the document header.
 * Matches the formatting logic in QuoteDocument.
 */
function formatDate(dateString?: string | null): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  if (!dateString) {
    return new Date().toLocaleDateString('en-US', options);
  }

  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    return new Date().toLocaleDateString('en-US', options);
  }

  return date.toLocaleDateString('en-US', options);
}

export function EstimationPreviewPanel({
  quote,
  project,
  recentChanges,
  onQuoteSaved,
  onSaveStatusChange,
  onEditorContentSnapshot,
}: EstimationPreviewPanelProps) {
  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  const [editorContent, setEditorContent] = useState<string>('');

  // Auto-save timer ref
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Abort controller for cancelling in-flight save requests
  const saveAbortRef = useRef<AbortController | null>(null);

  // Determine if the quote is editable (only draft status)
  const isQuoteEditable = quote.status === 'draft';

  // ------- Save Logic -------

  const handleSave = useCallback(
    async (html?: string) => {
      const contentToSave = html || editorContent;
      if (!contentToSave || !quote.id) return;

      // Cancel any previous in-flight save
      if (saveAbortRef.current) {
        saveAbortRef.current.abort();
      }
      saveAbortRef.current = new AbortController();

      setIsSaving(true);
      try {
        const updatedQuote = await quotesService.update(quote.id, {
          content: contentToSave as unknown as Partial<Quote['content']>,
        });
        setLastSavedAt(new Date());
        setHasUnsavedChanges(false);

        // Notify parent so it can update the quote in state
        if (onQuoteSaved) {
          onQuoteSaved(updatedQuote);
        }
        if (onSaveStatusChange) {
          onSaveStatusChange('saved');
        }
      } catch (error) {
        // Only show error if the request was not intentionally cancelled
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to save quote:', error);
          toast.error('Failed to save changes', {
            description: 'Your changes could not be saved. Please try again.',
            action: {
              label: 'Retry',
              onClick: () => handleSave(contentToSave),
            },
          });
          if (onSaveStatusChange) {
            onSaveStatusChange('idle');
          }
        }
      } finally {
        setIsSaving(false);
      }
    },
    [editorContent, quote.id, onQuoteSaved, onSaveStatusChange]
  );

  // ------- Auto-save with Debounce -------

  const handleContentChange = useCallback(
    (serialized: string) => {
      setEditorContent(serialized);
      setHasUnsavedChanges(true);

      if (onSaveStatusChange) {
        onSaveStatusChange('saving');
      }

      // Snapshot for refinement so chat uses latest editor content (avoids reverting manual edits)
      onEditorContentSnapshot?.(serialized);

      // Optimistically update quote content in parent so Export preview
      // reflects formatting changes (e.g. bold bullets) immediately,
      // even before the debounced save completes. Do NOT change updated_at
      // here—otherwise the editor key (quote.id + quote.updated_at) would
      // change on every keystroke and the editor would remount, losing focus.
      if (onQuoteSaved) {
        const optimisticQuote: Quote = {
          ...quote,
          content: {
            ...quote.content,
            executive_summary: serialized,
          },
        };
        onQuoteSaved(optimisticQuote);
      }

      // Clear any existing auto-save timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Set new auto-save timer
      autoSaveTimerRef.current = setTimeout(() => {
        handleSave(serialized);
      }, AUTO_SAVE_DELAY);
    },
    [handleSave, onQuoteSaved, onEditorContentSnapshot, onSaveStatusChange, quote]
  );

  // Clean up auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // ------- Unsaved Changes Warning -------

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // ------- Export Logic -------

  const handleExport = useCallback(
    async (format: 'pdf' | 'docx') => {
      if (!project.id || !quote.id) return;

      setIsExporting(true);
      try {
        // If there are unsaved changes, save first before exporting
        if (hasUnsavedChanges) {
          await handleSave();
        }

        const blob = await quoteService.exportQuote(
          project.id,
          quote.id,
          format
        );

        // Trigger file download
        const quoteNumber =
          quote.quote_number || `EST-${quote.id.slice(0, 8).toUpperCase()}`;
        quoteService.triggerDownload(blob, `${quoteNumber}.${format}`);

        toast.success(`${format.toUpperCase()} export downloaded`);
      } catch (error) {
        console.error('Export failed:', error);
        toast.error(`Failed to export as ${format.toUpperCase()}`, {
          description:
            error instanceof Error
              ? error.message
              : 'Export failed. Please try again.',
        });
      } finally {
        setIsExporting(false);
      }
    },
    [project.id, quote.id, quote.quote_number, hasUnsavedChanges, handleSave]
  );

  // ------- Editor Save Handler (for Ctrl+S) -------

  const handleEditorSave = useCallback(
    async (html: string) => {
      // Cancel any pending auto-save
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
       if (onSaveStatusChange) {
         onSaveStatusChange('saving');
       }
      await handleSave(html);
    },
    [handleSave, onSaveStatusChange]
  );

  return (
    <div className="estimation-preview-panel flex flex-col h-full">
      {/* Content area: direct editing, no top bar */}
      <div className="estimation-preview-content flex-1 min-h-0 overflow-auto overflow-y-auto px-4">
        <div className="doc-container">
          {/* Document header */}
          <div className="doc-header">
            <h1 className="doc-title">
              Proposal for {quote.project?.name || quote.project_name || project.name || 'Project'}
            </h1>
            <div className="doc-metadata">
              <div className="doc-metadata-item doc-metadata-col-1">
                <span className="doc-metadata-label">Prepared for</span>
                <span className="doc-metadata-value">
                  {quote.project?.name || quote.project_name || project.name || '—'}
                </span>
              </div>
              <div className="doc-metadata-item doc-metadata-col-2">
                <span className="doc-metadata-label">Date</span>
                <span className="doc-metadata-value">
                  {formatDate(quote.created_at)}
                </span>
              </div>
              <div className="doc-metadata-item doc-metadata-col-3">
                <span className="doc-metadata-label">Prepared by</span>
                <span className="doc-metadata-value">E2M Solutions</span>
              </div>
            </div>
          </div>

          {/* Editable content: BlockNote editor. Key on quote.id only so the editor does not
              remount on save (updated_at change), preserving scroll and cursor. External updates
              (refine, WebSocket, other tab) are synced in-place by BlockNoteQuoteEditor. */}
          <BlockNoteQuoteEditor
            key={quote.id}
            quote={quote}
            onContentChange={handleContentChange}
            onSave={handleEditorSave}
            readOnly={!isQuoteEditable}
          />
        </div>
      </div>
    </div>
  );
}

export default EstimationPreviewPanel;

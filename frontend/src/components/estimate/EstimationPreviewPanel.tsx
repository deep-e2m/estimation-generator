/**
 * EstimationPreviewPanel Component
 * Right panel of the split view - supports both read-only preview and
 * inline Tiptap editing with auto-save and export capabilities.
 *
 * Modes:
 * - Preview: renders the existing QuoteDocument (read-only)
 * - Edit: renders the InlineQuoteEditor with formatting toolbar
 *
 * Features:
 * - Toggle between preview and edit modes
 * - Auto-save with 3-second debounce
 * - Manual save via Ctrl+S
 * - Unsaved changes indicator and beforeunload warning
 * - Export to PDF/DOCX using existing quoteService
 * - Error handling with toast notifications
 * - Document header shown above editor in edit mode to match preview
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { QuoteDocument } from './preview/QuoteDocument';
import { InlineQuoteEditor } from './editor/InlineQuoteEditor';
import { EditorToolbar } from './editor/EditorToolbar';
import type { EditorMode } from './editor/EditorToolbar';
import { quoteService } from '@/services/quote-generation.service';
import { quotesService } from '@/services/quotes.service';
import type { Quote, Project } from '@/types';
import type { ChangeDescription } from '@/types/quote.types';
import type { Editor } from '@tiptap/react';

interface EstimationPreviewPanelProps {
  quote: Quote;
  project: Project;
  recentChanges?: ChangeDescription[];
  onQuoteSaved?: (updatedQuote: Quote) => void;
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
}: EstimationPreviewPanelProps) {
  // Mode state: preview (read-only) or edit (Tiptap editor)
  const [mode, setMode] = useState<EditorMode>('preview');

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Editor state -- using React state (not ref) so the parent re-renders
  // when the editor instance becomes available. This is critical: refs do
  // not trigger re-renders, so the toolbar would never see the editor.
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');

  // Auto-save timer ref
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Abort controller for cancelling in-flight save requests
  const saveAbortRef = useRef<AbortController | null>(null);

  // Determine if the quote is editable (only draft status)
  const isQuoteEditable = quote.status === 'draft';

  // ------- Editor Ready Callback -------

  const handleEditorReady = useCallback((editor: Editor | null) => {
    setEditorInstance(editor);
  }, []);

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
        }
      } finally {
        setIsSaving(false);
      }
    },
    [editorContent, quote.id, onQuoteSaved]
  );

  // ------- Auto-save with Debounce -------

  const handleContentChange = useCallback(
    (html: string) => {
      setEditorContent(html);
      setHasUnsavedChanges(true);

      // Clear any existing auto-save timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Set new auto-save timer
      autoSaveTimerRef.current = setTimeout(() => {
        handleSave(html);
      }, AUTO_SAVE_DELAY);
    },
    [handleSave]
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

  // ------- Mode Toggle -------

  const handleModeChange = useCallback(
    (newMode: EditorMode) => {
      if (newMode === mode) return;

      // Switching from edit to preview with unsaved changes
      if (mode === 'edit' && newMode === 'preview' && hasUnsavedChanges) {
        const shouldSave = window.confirm(
          'You have unsaved changes. Save before switching to preview?'
        );
        if (shouldSave) {
          // Save first, then switch mode
          handleSave().then(() => {
            setMode(newMode);
          });
          return;
        }
        // User chose to discard changes
        setHasUnsavedChanges(false);
      }

      setMode(newMode);
    },
    [mode, hasUnsavedChanges, handleSave]
  );

  // ------- Export Logic -------

  const handleExport = useCallback(
    async (format: 'pdf' | 'docx') => {
      if (!project.id || !quote.id) return;

      setIsExporting(true);
      try {
        // If there are unsaved changes, save first before exporting
        if (hasUnsavedChanges && mode === 'edit') {
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
    [project.id, quote.id, quote.quote_number, hasUnsavedChanges, mode, handleSave]
  );

  // ------- Editor Save Handler (for Ctrl+S) -------

  const handleEditorSave = useCallback(
    async (html: string) => {
      // Cancel any pending auto-save
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      await handleSave(html);
    },
    [handleSave]
  );

  return (
    <div className="estimation-preview-panel flex flex-col h-full">
      {/* Toolbar */}
      <EditorToolbar
        mode={mode}
        onModeChange={handleModeChange}
        isQuoteEditable={isQuoteEditable}
        editor={editorInstance}
      />

      {/* Content area */}
      <div className="estimation-preview-content flex-1 overflow-auto px-4">
        {mode === 'preview' ? (
          <QuoteDocument quote={quote} />
        ) : (
          <div className="doc-container">
            {/* Non-editable document header -- matches QuoteDocument exactly */}
            <div className="doc-header">
              <h1 className="doc-title">
                {(quote.project?.name || project.name)
                  ? `Proposal for ${quote.project?.name || project.name}`
                  : 'Project Proposal'}
              </h1>
              <div className="doc-metadata">
                <div className="doc-metadata-item">
                  <span className="doc-metadata-label">Date</span>
                  <span className="doc-metadata-value">
                    {formatDate(quote.created_at)}
                  </span>
                </div>
                {(quote as Quote & { client_name?: string }).client_name ||
                  project.client_name ||
                  quote.project?.name ||
                  project.name ? (
                  <div className="doc-metadata-item">
                    <span className="doc-metadata-label">Prepared for</span>
                    <span className="doc-metadata-value">
                      {(quote as Quote & { client_name?: string }).client_name ||
                        project.client_name ||
                        quote.project?.name ||
                        project.name}
                    </span>
                  </div>
                ) : null}
                {quote.created_by?.full_name && (
                  <div className="doc-metadata-item">
                    <span className="doc-metadata-label">Prepared by</span>
                    <span className="doc-metadata-value">
                      {quote.created_by.full_name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Editable content */}
            <InlineQuoteEditor
              quote={quote}
              onContentChange={handleContentChange}
              onSave={handleEditorSave}
              onEditorReady={handleEditorReady}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default EstimationPreviewPanel;

/**
 * InlineQuoteEditor Component
 *
 * A Tiptap rich-text editor for inline editing within the EstimationPreviewPanel.
 * Styled to visually match the QuoteDocument preview so switching between
 * preview and edit modes feels seamless.
 *
 * Key responsibilities:
 * - Initialize Tiptap with HTML converted from quote content
 * - Notify parent of the editor instance via onEditorReady callback (triggers re-render)
 * - Notify parent of content changes via onContentChange
 * - Handle external content updates (from AI refinement) by watching quote prop
 * - Support Ctrl+S keyboard shortcut for manual save
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Link from '@tiptap/extension-link';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { quoteContentToHtml } from '@/lib/quote-to-html';
import type { Quote } from '@/types';
import type { Editor } from '@tiptap/react';

// Import document-matching editor styles
import './inline-editor.css';

export interface InlineQuoteEditorProps {
  /** The quote whose content should be displayed in the editor */
  quote: Quote;
  /** Called on every content change with the current HTML string */
  onContentChange: (html: string) => void;
  /** Called when the user triggers a manual save (Ctrl+S) */
  onSave: (html: string) => Promise<void>;
  /**
   * Called when the Tiptap editor instance is ready (or destroyed).
   * This is used instead of a ref so the parent can re-render when
   * the editor becomes available (refs do not trigger re-renders).
   */
  onEditorReady?: (editor: Editor | null) => void;
  /** Additional CSS class names */
  className?: string;
}

export function InlineQuoteEditor({
  quote,
  onContentChange,
  onSave,
  onEditorReady,
  className,
}: InlineQuoteEditorProps) {
  // Track whether a content update is externally driven (AI refinement)
  // to avoid triggering save loops
  const isExternalUpdate = useRef(false);
  // Track the quote ID + updated_at to detect external changes
  const lastQuoteRef = useRef<string>('');

  // Convert quote content to HTML on mount. Memoize to avoid re-computation
  // on every render when the quote object reference changes but content is the same.
  const initialHtml = useMemo(() => {
    return quoteContentToHtml(quote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only compute once on mount

  // Configure Tiptap extensions
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Start editing your estimate...',
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: false,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({
        openOnClick: false,
      }),
      Subscript,
      Superscript,
      TextStyle,
      Color,
    ],
    []
  );

  // Store onEditorReady in a ref so we always call the latest version
  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;

  // Initialize the Tiptap editor
  const editor = useEditor({
    extensions,
    content: initialHtml,
    editable: true,
    immediatelyRender: true,
    onUpdate: ({ editor: ed }) => {
      // Skip notifying parent when the update came from an external source
      if (isExternalUpdate.current) {
        isExternalUpdate.current = false;
        return;
      }
      onContentChange(ed.getHTML());
    },
  });

  // Notify parent whenever the editor instance changes.
  // Using useEffect ensures the parent re-renders AFTER this component mounts.
  useEffect(() => {
    if (editor) {
      onEditorReadyRef.current?.(editor);
    }
    return () => {
      onEditorReadyRef.current?.(null);
    };
  }, [editor]);

  // Handle external content updates (from AI refinement via chat panel).
  // When the quote prop changes (different updated_at), update editor content.
  useEffect(() => {
    if (!editor || !quote) return;

    const quoteKey = `${quote.id}-${quote.updated_at}`;
    if (lastQuoteRef.current === quoteKey) return;

    // Skip the first assignment (initial mount handled by useEditor)
    if (lastQuoteRef.current === '') {
      lastQuoteRef.current = quoteKey;
      return;
    }

    lastQuoteRef.current = quoteKey;

    // The quote was updated externally -- update editor content
    const newHtml = quoteContentToHtml(quote);
    const currentHtml = editor.getHTML();

    if (newHtml !== currentHtml) {
      isExternalUpdate.current = true;
      editor.commands.setContent(newHtml);
    }
  }, [quote, editor]);

  // Keyboard shortcut: Ctrl+S / Cmd+S for manual save
  const handleSave = useCallback(async () => {
    if (!editor) return;
    await onSave(editor.getHTML());
  }, [editor, onSave]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Loading state while Tiptap initializes
  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        <span className="ml-2 text-sm text-gray-500">Loading editor...</span>
      </div>
    );
  }

  return (
    <div className={cn('inline-quote-editor', className)}>
      <div className="inline-quote-editor-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default InlineQuoteEditor;

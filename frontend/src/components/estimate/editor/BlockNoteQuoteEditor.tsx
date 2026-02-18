import React, { useCallback, useEffect, useMemo } from 'react';
import '@blocknote/core/style.css';
import '@blocknote/mantine/style.css';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteEditor, filterSuggestionItems } from '@blocknote/core';
import {
  DefaultReactSuggestionItem,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from '@blocknote/react';
import './inline-editor.css';
import { cn } from '@/lib/utils';
import type { Quote } from '@/types';

export interface BlockNoteQuoteEditorProps {
  /** The quote whose content should be displayed in the editor */
  quote: Quote;
  /**
   * Called on every content change with a serialized representation
   * of the BlockNote document. For Phase 1, we use JSON.stringify(doc)
   * so we can plug into the existing HTML-based save pipeline with
   * minimal changes.
   */
  onContentChange: (serialized: string) => void;
  /** Called when the user triggers a manual save (Ctrl+S) */
  onSave: (serialized: string) => Promise<void>;
  /**
   * Called when the BlockNote editor instance is ready (or destroyed).
   */
  onEditorReady?: (editor: BlockNoteEditor | null) => void;
  /** Additional CSS class names */
  className?: string;
  /** When true, renders in read-only mode (for preview) */
  readOnly?: boolean;
}

export function BlockNoteQuoteEditor({
  quote,
  onContentChange,
  onSave,
  onEditorReady,
  className,
  readOnly = false,
}: BlockNoteQuoteEditorProps) {
  // Hydrate BlockNote from quote content: executive_summary is BlockNote JSON
  // (array of blocks) or legacy line-by-line text.
  const initialContent = useMemo(() => {
    const summary = quote.content?.executive_summary;
    if (!summary) return undefined;
    try {
      const parsed = JSON.parse(summary) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return JSON.parse(JSON.stringify(parsed)) as unknown[];
      }
    } catch {
      const trimmed = summary.trim();
      if (trimmed.length > 0) {
        const blocks: Array<{ type: 'paragraph'; content: Array<{ type: 'text'; text: string; styles: object }> }> = [];
        for (const line of trimmed.split(/\n/)) {
          const t = line.trimEnd();
          blocks.push({
            type: 'paragraph',
            content: [{ type: 'text', text: t.length > 0 ? t : ' ', styles: {} }],
          });
        }
        if (blocks.length > 0) return blocks as unknown[];
      }
    }
    return undefined;
  }, [quote]);

  const editor = useCreateBlockNote({
    initialContent,
  });

  // Notify parent when editor is ready.
  useEffect(() => {
    if (onEditorReady) {
      onEditorReady(editor ?? null);
      return () => {
        onEditorReady(null);
      };
    }
  }, [editor, onEditorReady]);

  // Wire BlockNote changes into the existing autosave pipeline by
  // serializing the full document to a string.
  useEffect(() => {
    if (!editor) return;

    return editor.onChange(() => {
      try {
        const serialized = JSON.stringify(editor.document);
        onContentChange(serialized);
      } catch (error) {
        // In Phase 1 we deliberately keep error handling minimal and
        // rely on the outer panel's save logic for user feedback.
        console.error('Failed to serialize BlockNote document', error);
      }
    });
  }, [editor, onContentChange]);

  // Manual save shortcut: Ctrl+S / Cmd+S
  const handleSave = useCallback(async () => {
    if (!editor) return;
    try {
      const serialized = JSON.stringify(editor.document);
      await onSave(serialized);
    } catch (error) {
      console.error('Failed to save BlockNote document', error);
    }
  }, [editor, onSave]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // ------- Slash ("/") suggestion menu helpers -------

  const getSlashMenuItems = useCallback(
    (editorInstance: BlockNoteEditor): DefaultReactSuggestionItem[] => {
      // Start with BlockNote's default slash menu items and keep Phase 1
      // customizations minimal. Additional AI/estimation-specific items
      // can be added here later.
      return [...getDefaultReactSlashMenuItems(editorInstance)];
    },
    []
  );

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="ml-2 text-sm text-gray-500">Loading BlockNote editor...</span>
      </div>
    );
  }

  return (
    <div className={cn('inline-quote-editor', className)}>
      <div className="inline-quote-editor-content">
        <BlockNoteView
          editor={editor}
          editable={!readOnly}
          theme="light"
          slashMenu={false}
        >
          {/* Slash ("/") menu for block types (headings, lists, etc.); formatting toolbar shows on text selection (bold, italic, etc.) */}
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) =>
              filterSuggestionItems(getSlashMenuItems(editor), query)
            }
          />
        </BlockNoteView>
      </div>
    </div>
  );
}

export default BlockNoteQuoteEditor;


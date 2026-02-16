/**
 * EditorToolbar Component
 *
 * Professional toolbar for the inline quote editor, styled after Notion and
 * Google Docs. Uses dedicated CSS classes from inline-editor.css for a clean,
 * spacious layout with clear visual grouping.
 *
 * Controls provided:
 * - Edit/Preview mode toggle (prominent, clearly separated)
 * - Undo / Redo
 * - Heading buttons (H1, H2, H3)
 * - Bold, Italic, Strikethrough
 * - Bullet list / Numbered list
 * - Underline, Highlight
 * - Text alignment (Left, Center, Right)
 * - Horizontal Rule, Link, Table insert
 */

import React from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  Highlighter,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Minus,
  Table as TableIcon,
  Undo,
  Redo,
  Eye,
  Pencil,
  Save,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Editor } from '@tiptap/react';

export type EditorMode = 'preview' | 'edit';

export interface EditorToolbarProps {
  /** Current view mode */
  mode: EditorMode;
  /** Callback when the user toggles between preview and edit mode */
  onModeChange: (mode: EditorMode) => void;
  /** Whether the quote is editable (only draft status quotes) */
  isQuoteEditable: boolean;
  /** Tiptap editor instance for formatting commands (null in preview mode) */
  editor: Editor | null;
  /** Whether there are unsaved changes */
  hasUnsavedChanges?: boolean;
  /** Whether a save operation is in progress */
  isSaving?: boolean;
  /** Callback to manually save changes */
  onSave?: () => void;
}

/** Icon toolbar button for formatting actions */
function ToolbarBtn({
  icon: Icon,
  onClick,
  isActive,
  disabled,
  title,
}: {
  icon: React.ElementType;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'editor-toolbar__btn',
        isActive && 'editor-toolbar__btn--active'
      )}
      title={title}
    >
      <Icon />
    </button>
  );
}

/** Heading button with text label (H1, H2, H3) */
function HeadingBtn({
  level,
  editor,
}: {
  level: 1 | 2 | 3;
  editor: Editor;
}) {
  const isActive = editor.isActive('heading', { level });
  const label = `H${level}`;

  return (
    <button
      type="button"
      onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
      className={cn(
        'editor-toolbar__heading-btn',
        isActive && 'editor-toolbar__heading-btn--active'
      )}
      title={`Heading ${level}`}
    >
      {label}
    </button>
  );
}

/** Vertical divider between toolbar groups */
function Divider({ tall }: { tall?: boolean }) {
  return (
    <div
      className={cn(
        'editor-toolbar__separator',
        tall && 'editor-toolbar__separator--tall'
      )}
    />
  );
}

export function EditorToolbar({
  mode,
  onModeChange,
  isQuoteEditable,
  editor,
  hasUnsavedChanges = false,
  isSaving = false,
  onSave,
}: EditorToolbarProps) {
  return (
    <div className="editor-toolbar">
      {/* Mode toggle: Preview / Edit */}
      <div className="editor-toolbar__mode-toggle">
        <button
          type="button"
          onClick={() => onModeChange('preview')}
          className={cn(
            'editor-toolbar__mode-btn',
            mode === 'preview' && 'editor-toolbar__mode-btn--active'
          )}
        >
          <Eye />
          Preview
        </button>
        <button
          type="button"
          onClick={() => onModeChange('edit')}
          disabled={!isQuoteEditable}
          title={
            !isQuoteEditable
              ? 'Only draft quotes can be edited'
              : 'Switch to edit mode'
          }
          className={cn(
            'editor-toolbar__mode-btn',
            mode === 'edit' && 'editor-toolbar__mode-btn--active'
          )}
        >
          <Pencil />
          Edit
        </button>
      </div>

      {/* Save button: visible only in edit mode with unsaved changes */}
      {mode === 'edit' && hasUnsavedChanges && onSave && (
        <div className="editor-toolbar__save-group">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="editor-toolbar__save-btn"
            title="Save changes (Ctrl+S)"
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save />
                Save Changes
              </>
            )}
          </button>
        </div>
      )}

      {/* Formatting controls: visible only in edit mode with an active editor */}
      {mode === 'edit' && editor && (
        <div className="editor-toolbar__controls">
          {/* Undo / Redo */}
          <div className="editor-toolbar__group">
            <ToolbarBtn
              icon={Undo}
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Undo (Ctrl+Z)"
            />
            <ToolbarBtn
              icon={Redo}
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Redo (Ctrl+Y)"
            />
          </div>

          <Divider />

          {/* Headings */}
          <div className="editor-toolbar__group">
            <HeadingBtn level={1} editor={editor} />
            <HeadingBtn level={2} editor={editor} />
            <HeadingBtn level={3} editor={editor} />
          </div>

          <Divider />

          {/* Text formatting */}
          <div className="editor-toolbar__group">
            <ToolbarBtn
              icon={Bold}
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
              title="Bold (Ctrl+B)"
            />
            <ToolbarBtn
              icon={Italic}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
              title="Italic (Ctrl+I)"
            />
            <ToolbarBtn
              icon={Strikethrough}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive('strike')}
              title="Strikethrough"
            />
          </div>

          <Divider />

          {/* Lists */}
          <div className="editor-toolbar__group">
            <ToolbarBtn
              icon={List}
              onClick={() =>
                editor.chain().focus().toggleBulletList().run()
              }
              isActive={editor.isActive('bulletList')}
              title="Bullet List"
            />
            <ToolbarBtn
              icon={ListOrdered}
              onClick={() =>
                editor.chain().focus().toggleOrderedList().run()
              }
              isActive={editor.isActive('orderedList')}
              title="Numbered List"
            />
          </div>

          <Divider />

          {/* Underline + Highlight */}
          <div className="editor-toolbar__group">
            <ToolbarBtn
              icon={UnderlineIcon}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive('underline')}
              title="Underline (Ctrl+U)"
            />
            <ToolbarBtn
              icon={Highlighter}
              onClick={() => (editor.chain().focus() as unknown as { toggleHighlight: () => { run: () => boolean } }).toggleHighlight().run()}
              isActive={editor.isActive('highlight')}
              title="Highlight"
            />
          </div>

          <Divider />

          {/* Text Alignment */}
          <div className="editor-toolbar__group">
            <ToolbarBtn
              icon={AlignLeft}
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              isActive={editor.isActive({ textAlign: 'left' })}
              title="Align Left"
            />
            <ToolbarBtn
              icon={AlignCenter}
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              isActive={editor.isActive({ textAlign: 'center' })}
              title="Align Center"
            />
            <ToolbarBtn
              icon={AlignRight}
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              isActive={editor.isActive({ textAlign: 'right' })}
              title="Align Right"
            />
          </div>

          <Divider />

          {/* Insert controls */}
          <div className="editor-toolbar__group">
            <ToolbarBtn
              icon={Minus}
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Horizontal Rule"
            />
            <ToolbarBtn
              icon={LinkIcon}
              onClick={() => {
                const url = window.prompt('Enter URL:');
                if (url) {
                  (editor.chain().focus() as unknown as { setLink: (a: { href: string }) => { run: () => boolean } }).setLink({ href: url }).run();
                }
              }}
              isActive={editor.isActive('link')}
              title="Insert Link"
            />
            <ToolbarBtn
              icon={TableIcon}
              onClick={() => (editor.chain().focus() as unknown as { insertTable: (o: { rows: number; cols: number; withHeaderRow: boolean }) => { run: () => boolean } }).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              title="Insert Table"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default EditorToolbar;

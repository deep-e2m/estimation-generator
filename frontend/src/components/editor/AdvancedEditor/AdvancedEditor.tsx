/**
 * Advanced Editor Component
 * TipTap-based rich text editor with Google Docs-like features:
 * - Rich text formatting
 * - Commenting sidebar
 * - Auto-save functionality
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Save,
  Loader2,
  Check,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  Wifi,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CommentPlugin, type Comment } from './CommentPlugin';
import './editor.css';

// Main editor props
interface AdvancedEditorProps {
  documentId?: string;
  projectId?: string;
  initialContent?: string;
  onSave?: (content: string, plainText: string) => Promise<void>;
  onChange?: (content: string) => void;
  placeholder?: string;
  title?: string;
  onTitleChange?: (title: string) => void;
  readOnly?: boolean;
  showComments?: boolean;
  currentUser?: {
    id: string;
    name: string;
    avatar?: string;
  };
  className?: string;
}

// Toolbar button
function ToolbarButton({
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
        'p-2 rounded transition-colors',
        isActive ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100 text-gray-600',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      title={title}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

// Toolbar divider
function ToolbarDivider() {
  return <div className="w-px h-6 bg-gray-300 mx-2" />;
}

// Main editor component
export function AdvancedEditor({
  documentId,
  projectId,
  initialContent = '',
  onSave,
  onChange,
  placeholder = 'Start writing...',
  title,
  onTitleChange,
  readOnly = false,
  showComments = true,
  currentUser = { id: 'user-1', name: 'Current User' },
  className,
}: AdvancedEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [editorTitle, setEditorTitle] = useState(title || 'Untitled Document');

  // Initialize TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialContent,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'editor-content-editable',
      },
    },
  });

  // Update content when initialContent changes
  useEffect(() => {
    if (editor && initialContent && editor.getHTML() !== initialContent) {
      editor.commands.setContent(initialContent);
    }
  }, [initialContent, editor]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!onSave || !editor) return;

    setIsSaving(true);
    try {
      const htmlContent = editor.getHTML();
      const plainText = editor.getText();
      await onSave(htmlContent, plainText);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, editor]);

  // Handle title change
  const handleTitleChange = (newTitle: string) => {
    setEditorTitle(newTitle);
    onTitleChange?.(newTitle);
  };

  // Keyboard shortcuts
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

  // Handle comment actions
  const handleAddComment = (comment: Omit<Comment, 'id' | 'createdAt' | 'replies' | 'resolved'>) => {
    console.log('Adding comment:', comment);
  };

  const handleResolveComment = (commentId: string) => {
    console.log('Resolving comment:', commentId);
  };

  const handleDeleteComment = (commentId: string) => {
    console.log('Deleting comment:', commentId);
  };

  const handleAddReply = (commentId: string, text: string) => {
    console.log('Adding reply to comment:', commentId, text);
  };

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className={cn('flex h-full bg-white', className)}>
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={editorTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="text-lg font-semibold border-none outline-none focus:ring-0 bg-transparent"
              placeholder="Untitled Document"
              readOnly={readOnly}
            />
            {isSaving && (
              <span className="text-sm text-gray-400 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </span>
            )}
            {lastSaved && !isSaving && (
              <span className="text-sm text-gray-400 flex items-center gap-1">
                <Check className="h-3 w-3 text-green-500" />
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-500" />
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-gray-50 flex-wrap">
          {/* Undo/Redo */}
          <ToolbarButton
            icon={Undo}
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo (Ctrl+Z)"
          />
          <ToolbarButton
            icon={Redo}
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo (Ctrl+Y)"
          />

          <ToolbarDivider />

          {/* Block type selector */}
          <select
            value={
              editor.isActive('heading', { level: 1 }) ? 'h1' :
              editor.isActive('heading', { level: 2 }) ? 'h2' :
              editor.isActive('heading', { level: 3 }) ? 'h3' :
              editor.isActive('blockquote') ? 'blockquote' :
              editor.isActive('codeBlock') ? 'code' : 'p'
            }
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'p') {
                editor.chain().focus().setParagraph().run();
              } else if (value === 'h1') {
                editor.chain().focus().toggleHeading({ level: 1 }).run();
              } else if (value === 'h2') {
                editor.chain().focus().toggleHeading({ level: 2 }).run();
              } else if (value === 'h3') {
                editor.chain().focus().toggleHeading({ level: 3 }).run();
              } else if (value === 'blockquote') {
                editor.chain().focus().toggleBlockquote().run();
              } else if (value === 'code') {
                editor.chain().focus().toggleCodeBlock().run();
              }
            }}
            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
          >
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="blockquote">Quote</option>
            <option value="code">Code Block</option>
          </select>

          <ToolbarDivider />

          {/* Text formatting */}
          <ToolbarButton
            icon={Bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Bold (Ctrl+B)"
          />
          <ToolbarButton
            icon={Italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Italic (Ctrl+I)"
          />
          <ToolbarButton
            icon={UnderlineIcon}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            title="Underline (Ctrl+U)"
          />
          <ToolbarButton
            icon={Strikethrough}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            title="Strikethrough"
          />

          <ToolbarDivider />

          {/* Lists */}
          <ToolbarButton
            icon={List}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Bullet List"
          />
          <ToolbarButton
            icon={ListOrdered}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Numbered List"
          />

          <ToolbarDivider />

          {/* Alignment */}
          <ToolbarButton
            icon={AlignLeft}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            isActive={editor.isActive({ textAlign: 'left' })}
            title="Align Left"
          />
          <ToolbarButton
            icon={AlignCenter}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            isActive={editor.isActive({ textAlign: 'center' })}
            title="Align Center"
          />
          <ToolbarButton
            icon={AlignRight}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            isActive={editor.isActive({ textAlign: 'right' })}
            title="Align Right"
          />
        </div>

        {/* Editor content area */}
        <div className="flex-1 overflow-auto p-8 bg-gray-100">
          <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg min-h-[calc(100vh-250px)]">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Comments sidebar */}
      {showComments && (
        <CommentPlugin
          currentUser={currentUser}
          onAddComment={handleAddComment}
          onResolveComment={handleResolveComment}
          onDeleteComment={handleDeleteComment}
          onAddReply={handleAddReply}
        />
      )}
    </div>
  );
}

export default AdvancedEditor;

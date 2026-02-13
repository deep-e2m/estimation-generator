/**
 * Document Editor Component
 * A TipTap-based rich text editor with WebSocket real-time collaboration
 * Similar to Google Docs experience
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Save,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { documentsService, type Document } from '@/services/documents.service';
import { Button } from '@/components/ui/button';

interface ActiveUser {
  id: string;
  name: string;
  color?: string;
}

interface DocumentEditorProps {
  projectId: string;
  documentId: string;
  onClose?: () => void;
}

// Generate consistent color from user ID
function getUserColor(userId: string): string {
  const colors = [
    '#f87171', '#fb923c', '#fbbf24', '#a3e635',
    '#34d399', '#22d3d8', '#60a5fa', '#a78bfa',
    '#f472b6', '#fb7185',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function DocumentEditor({ projectId, documentId, onClose }: DocumentEditorProps) {
  const [_document, setDocument] = useState<Document | null>(null);
  const [title, setTitle] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRemoteUpdate = useRef(false);

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
        placeholder: 'Start writing your document...',
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[calc(100vh-280px)] p-12',
        style: "font-family: 'Georgia', serif; font-size: 11pt; line-height: 1.6;",
      },
    },
    onUpdate: ({ editor }) => {
      // Don't trigger save for remote updates
      if (isRemoteUpdate.current) {
        isRemoteUpdate.current = false;
        return;
      }
      handleContentChange(editor.getHTML());
    },
  });

  // Load document
  useEffect(() => {
    const loadDocument = async () => {
      try {
        setIsLoadingDoc(true);
        const doc = await documentsService.get(projectId, documentId);
        setDocument(doc);
        setTitle(doc.title);

        // Set editor content
        if (editor) {
          let htmlContent = '';
          if (doc.content && typeof doc.content === 'object') {
            htmlContent = (doc.content as { html?: string }).html || doc.plain_text || '';
          } else {
            htmlContent = doc.plain_text || '';
          }

          isRemoteUpdate.current = true;
          editor.commands.setContent(htmlContent || '<p></p>');
        }
      } catch (error) {
        console.error('Failed to load document:', error);
      } finally {
        setIsLoadingDoc(false);
      }
    };

    if (editor) {
      loadDocument();
    }
  }, [projectId, documentId, editor]);

  // Connect WebSocket for real-time collaboration
  useEffect(() => {
    const ws = documentsService.connectWebSocket(documentId, {
      onSync: (syncContent, version, users) => {
        setIsConnected(true);
        setActiveUsers(users.map(u => ({ ...u, color: getUserColor(u.id) })));

        if (syncContent && typeof syncContent === 'object' && editor) {
          const html = (syncContent as { html?: string }).html;
          if (html) {
            isRemoteUpdate.current = true;
            editor.commands.setContent(html);
          }
        }
      },
      onContentUpdate: (updatedContent, _version, _userId, _userName) => {
        // Update content from other users
        if (updatedContent && typeof updatedContent === 'object' && editor) {
          const html = (updatedContent as { html?: string }).html;
          if (html) {
            // Save current selection
            const { from, to } = editor.state.selection;

            isRemoteUpdate.current = true;
            editor.commands.setContent(html);

            // Try to restore selection
            try {
              const docLength = editor.state.doc.content.size;
              const newFrom = Math.min(from, docLength - 1);
              const newTo = Math.min(to, docLength - 1);
              editor.commands.setTextSelection({ from: newFrom, to: newTo });
            } catch (_e) {
              // Ignore selection restoration errors
            }
          }
        }
      },
      onPresence: (userId, userName, action, users) => {
        setActiveUsers(users.map(u => ({ ...u, color: getUserColor(u.id) })));
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      },
      onClose: () => {
        setIsConnected(false);
      },
    });

    wsRef.current = ws;

    return () => {
      ws?.close();
    };
  }, [documentId, editor]);

  // Auto-save with debounce
  const saveContent = useCallback(async (html: string) => {
    const plainText = editor?.getText() || '';

    // Send through WebSocket for real-time sync
    if (wsRef.current && isConnected) {
      documentsService.sendContentUpdate(wsRef.current, { html }, plainText);
    }

    // Also save to database
    try {
      setIsSaving(true);
      await documentsService.update(projectId, documentId, {
        content: { html },
        plain_text: plainText,
      });
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save document:', error);
    } finally {
      setIsSaving(false);
    }
  }, [projectId, documentId, isConnected, editor]);

  // Handle content changes with debounce
  const handleContentChange = useCallback((html: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => saveContent(html), 1000);
  }, [saveContent]);

  // Manual save
  const handleManualSave = useCallback(() => {
    if (editor) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveContent(editor.getHTML());
    }
  }, [editor, saveContent]);

  // Save title
  const handleTitleChange = async (newTitle: string) => {
    setTitle(newTitle);
    try {
      await documentsService.update(projectId, documentId, { title: newTitle });
    } catch (error) {
      console.error('Failed to update title:', error);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleManualSave]);

  if (!editor || isLoadingDoc) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="text-lg font-semibold border-none outline-none focus:ring-0 bg-transparent"
            placeholder="Untitled Document"
          />
          {isSaving && (
            <span className="text-sm text-gray-400">Saving...</span>
          )}
          {lastSaved && !isSaving && (
            <span className="text-sm text-gray-400">
              Last saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
          </div>

          {/* Active users */}
          {activeUsers.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <div className="flex -space-x-2">
                {activeUsers.slice(0, 3).map((user) => (
                  <div
                    key={user.id}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white border-2 border-white"
                    style={{ backgroundColor: user.color }}
                    title={user.name}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {activeUsers.length > 3 && (
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 border-2 border-white">
                    +{activeUsers.length - 3}
                  </div>
                )}
              </div>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={handleManualSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>

          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
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

        {/* Text formatting dropdown */}
        <select
          value={
            editor.isActive('heading', { level: 1 }) ? 'h1' :
            editor.isActive('heading', { level: 2 }) ? 'h2' :
            editor.isActive('heading', { level: 3 }) ? 'h3' :
            editor.isActive('blockquote') ? 'blockquote' : 'p'
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
            }
          }}
          className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="blockquote">Quote</option>
        </select>

        <ToolbarDivider />

        {/* Text styles */}
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

      {/* Editor Content */}
      <div className="flex-1 overflow-auto p-8 bg-gray-100">
        <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg min-h-[calc(100vh-200px)]">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

// Toolbar Button Component
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

// Toolbar Divider Component
function ToolbarDivider() {
  return <div className="w-px h-6 bg-gray-300 mx-2" />;
}

export default DocumentEditor;

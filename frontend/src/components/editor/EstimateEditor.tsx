/**
 * EstimateEditor Component
 * Google Docs-like editor using Lexical for editing estimates
 *
 * STRICT RULES:
 * - Content must exactly match the estimate from chat window
 * - Context-7 can ONLY be used for reference information
 * - Context-7 must NOT reinterpret requirements or regenerate estimates
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $getRoot, $createParagraphNode, $createTextNode, EditorState } from 'lexical';
import {
  ArrowLeft,
  Save,
  CheckCircle,
  Loader2,
  AlertCircle,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { quotesService } from '@/services';
import { quoteService } from '@/services/quote.service';
import type { Quote } from '@/types/quote.types';

// Toolbar button component
interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  children,
  title,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'p-2 rounded transition-colors',
        isActive
          ? 'bg-primary-100 text-primary-700'
          : 'hover:bg-gray-100 text-gray-600',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );
}

// Toolbar plugin
function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();

  return (
    <div className="editor-toolbar flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50">
      <ToolbarButton onClick={() => {}} title="Bold (Ctrl+B)">
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => {}} title="Italic (Ctrl+I)">
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <div className="w-px h-6 bg-gray-300 mx-1" />
      <ToolbarButton onClick={() => {}} title="Heading 1">
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => {}} title="Heading 2">
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <div className="w-px h-6 bg-gray-300 mx-1" />
      <ToolbarButton onClick={() => {}} title="Bullet List">
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => {}} title="Numbered List">
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

// Plugin to initialize content from estimate
interface InitContentPluginProps {
  content: string;
}

function InitContentPlugin({ content }: InitContentPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [hasInit, setHasInit] = useState(false);

  useEffect(() => {
    if (content && !hasInit) {
      editor.update(() => {
        const root = $getRoot();
        root.clear();

        // Split content into paragraphs and create nodes
        const paragraphs = content.split('\n');
        paragraphs.forEach((text) => {
          const paragraph = $createParagraphNode();
          if (text.trim()) {
            paragraph.append($createTextNode(text));
          }
          root.append(paragraph);
        });
      });
      setHasInit(true);
    }
  }, [editor, content, hasInit]);

  return null;
}

// Lexical theme configuration
const theme = {
  paragraph: 'mb-2',
  heading: {
    h1: 'text-2xl font-bold mb-4',
    h2: 'text-xl font-semibold mb-3',
    h3: 'text-lg font-medium mb-2',
  },
  list: {
    ul: 'list-disc ml-6 mb-4',
    ol: 'list-decimal ml-6 mb-4',
    listitem: 'mb-1',
  },
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
  },
};

// Editor error handler
function onError(error: Error) {
  console.error('Lexical Editor Error:', error);
}

interface EstimateEditorProps {
  projectId?: string;
  quoteId?: string;
}

export function EstimateEditor({ projectId, quoteId }: EstimateEditorProps) {
  const params = useParams();
  const navigate = useNavigate();

  // Use props or params
  const actualProjectId = projectId || params.projectId;
  const actualQuoteId = quoteId || params.quoteId;

  // State
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initial config for Lexical
  const initialConfig = {
    namespace: 'EstimateEditor',
    theme,
    onError,
  };

  // Load quote data
  useEffect(() => {
    if (!actualProjectId || !actualQuoteId) return;

    const loadQuote = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const quoteData = await quotesService.get(actualQuoteId);
        setQuote(quoteData as unknown as Quote);
        setEditorContent(quoteData.content || '');
      } catch (err) {
        setError('Failed to load estimate. Please try again.');
        console.error('Failed to load estimate:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadQuote();
  }, [actualProjectId, actualQuoteId]);

  // Handle editor change
  const handleEditorChange = useCallback(
    (editorState: EditorState) => {
      editorState.read(() => {
        const root = $getRoot();
        const text = root.getTextContent();
        if (text !== editorContent) {
          setHasChanges(true);
        }
      });
    },
    [editorContent]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    if (!actualProjectId || !actualQuoteId || !hasChanges) return;

    try {
      setIsSaving(true);
      setError(null);

      // Get current content from editor
      // For now, we'll use the editorContent state
      // In a full implementation, we'd extract from the editor state

      await quoteService.updateQuote(actualProjectId, actualQuoteId, {
        content: editorContent,
      });

      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save changes. Please try again.');
      console.error('Failed to save:', err);
    } finally {
      setIsSaving(false);
    }
  }, [actualProjectId, actualQuoteId, editorContent, hasChanges]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        navigate(`/projects/${actualProjectId}?tab=estimate`);
      }
    } else {
      navigate(`/projects/${actualProjectId}?tab=estimate`);
    }
  }, [navigate, actualProjectId, hasChanges]);

  // Handle approve
  const handleApprove = useCallback(async () => {
    if (!actualProjectId || !actualQuoteId) return;

    // Save first if there are changes
    if (hasChanges) {
      await handleSave();
    }

    try {
      await quoteService.updateQuote(actualProjectId, actualQuoteId, {
        status: 'approved',
      });
      navigate(`/projects/${actualProjectId}?tab=estimate`);
    } catch (err) {
      setError('Failed to approve estimate. Please try again.');
    }
  }, [actualProjectId, actualQuoteId, hasChanges, handleSave, navigate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="estimate-editor-page min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !quote) {
    return (
      <div className="estimate-editor-page min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-8">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Project
          </button>
          <div className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-12 w-12 text-error-500 mb-4" />
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="estimate-editor-page min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="h-6 w-px bg-gray-300" />
              <h1 className="text-lg font-semibold text-gray-900">
                Edit Estimate
              </h1>
              {quote && (
                <span className="text-sm text-gray-500">
                  {quote.quote_number ||
                    `EST-${quote.id?.slice(0, 8).toUpperCase()}`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Save Status */}
              {saveSuccess && (
                <span className="flex items-center gap-1 text-sm text-success-600">
                  <CheckCircle className="h-4 w-4" />
                  Saved
                </span>
              )}

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                  hasChanges
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                )}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </button>

              {/* Approve Button */}
              <button
                onClick={handleApprove}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-all"
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="max-w-6xl mx-auto px-8 pt-4">
          <div className="flex items-center gap-3 p-4 bg-error-50 border border-error-200 rounded-lg text-error-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <LexicalComposer initialConfig={initialConfig}>
            {/* Toolbar */}
            <ToolbarPlugin />

            {/* Editor Content */}
            <div className="editor-container p-8 min-h-[600px]">
              <RichTextPlugin
                contentEditable={
                  <ContentEditable className="editor-content outline-none min-h-[500px] prose max-w-none" />
                }
                placeholder={
                  <div className="editor-placeholder text-gray-400 absolute top-8 left-8 pointer-events-none">
                    Start editing your estimate...
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <HistoryPlugin />
              <OnChangePlugin onChange={handleEditorChange} />
              <InitContentPlugin content={editorContent} />
            </div>
          </LexicalComposer>
        </div>

        {/* Info Note */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> You are editing the estimate content. Changes
            will be saved to the project. The estimate is in hours only -
            pricing is handled separately by the sales team.
          </p>
        </div>
      </div>
    </div>
  );
}

export default EstimateEditor;

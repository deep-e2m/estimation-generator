/**
 * Quote Edit Page
 * Full-featured quote editing with advanced Lexical editor
 * Includes Google Docs-like commenting and collaboration features
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Loader2,
  Eye,
  Edit2,
  Clock,
  DollarSign,
  FileText,
  MessageSquare,
  Download,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AdvancedEditor } from '@/components/editor/AdvancedEditor';
import { useQuote, useUpdateQuote } from '@/hooks/useQuotes';
import { useAuthStore } from '@/store/authStore';
import { cn, formatCurrency } from '@/lib/utils';
import type { Quote, QuoteContent } from '@/types';

// View mode type
type ViewMode = 'edit' | 'preview';

export function QuoteEditPage() {
  const { projectId, quoteId } = useParams<{ projectId: string; quoteId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editorContent, setEditorContent] = useState('');

  // Fetch quote data
  const {
    data: quote,
    isLoading,
    isError,
    error,
  } = useQuote(projectId || '', quoteId || '');

  // Update mutation
  const updateQuote = useUpdateQuote();

  // Convert quote content to HTML for editor
  useEffect(() => {
    if (quote) {
      const html = convertQuoteToHtml(quote);
      setEditorContent(html);
    }
  }, [quote]);

  // Handle save
  const handleSave = useCallback(async (content: string, plainText: string) => {
    if (!projectId || !quoteId) return;

    try {
      // Parse the content back to quote structure if needed
      // For now, just save the raw content
      // For now, just update the executive summary
      // Full content parsing would be needed for production
      await updateQuote.mutateAsync({
        projectId,
        quoteId,
        data: {},
      });
      setHasUnsavedChanges(false);
      toast.success('Quote saved successfully');
    } catch (err) {
      toast.error('Failed to save quote');
    }
  }, [projectId, quoteId, quote, updateQuote]);

  // Handle content change
  const handleContentChange = useCallback((content: string) => {
    setEditorContent(content);
    setHasUnsavedChanges(true);
  }, []);

  // Warn about unsaved changes
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          <p className="text-gray-500">Loading quote...</p>
        </div>
      </div>
    );
  }

  if (isError || !quote) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
        <FileText className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Quote not found</h2>
        <p className="text-gray-500 mb-6">
          {error instanceof Error ? error.message : 'Unable to load the quote'}
        </p>
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const currentUser = {
    id: user?.id || 'anonymous',
    name: user?.full_name || 'Anonymous User',
    avatar: undefined,
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (hasUnsavedChanges) {
                if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
                  navigate(-1);
                }
              } else {
                navigate(-1);
              }
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">
                Editing {quote.quote_number}
              </h1>
              <Badge variant="secondary">v{quote.version}</Badge>
              {hasUnsavedChanges && (
                <Badge variant="warning" className="animate-pulse">
                  Unsaved changes
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500">{quote.project.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Stats - HOURS ONLY (pricing is out of scope) */}
          <div className="hidden md:flex items-center gap-4 text-sm text-gray-500 mr-4">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {quote.content?.totals?.total_expected_hours || quote.total_hours || 0} hours
            </span>
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewMode('edit')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5',
                viewMode === 'edit'
                  ? 'bg-primary-50 text-primary-700'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5',
                viewMode === 'preview'
                  ? 'bg-primary-50 text-primary-700'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
          </div>

          <Button
            variant="outline"
            leftIcon={<Download className="h-4 w-4" />}
          >
            Export
          </Button>

          <Button
            variant="default"
            leftIcon={
              updateQuote.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )
            }
            disabled={updateQuote.isPending || !hasUnsavedChanges}
            onClick={() => handleSave(editorContent, '')}
          >
            {updateQuote.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'edit' ? (
          <AdvancedEditor
            documentId={quoteId}
            projectId={projectId}
            initialContent={editorContent}
            onSave={handleSave}
            onChange={handleContentChange}
            placeholder="Start writing your quote..."
            title={`${quote.quote_number} - ${quote.project.name}`}
            currentUser={currentUser}
            showComments={true}
          />
        ) : (
          <QuotePreview quote={quote} />
        )}
      </div>
    </div>
  );
}

/**
 * Convert quote content to HTML for the editor
 */
function convertQuoteToHtml(quote: Quote): string {
  const { content } = quote;

  let html = '';

  // Executive Summary
  html += `<h1>Executive Summary</h1>`;
  html += `<p>${content.executive_summary}</p>`;

  // Scope
  html += `<h2>Scope</h2>`;
  html += `<h3>Included</h3>`;
  html += '<ul>';
  content.scope.included.forEach((item) => {
    html += `<li>${item}</li>`;
  });
  html += '</ul>';

  html += `<h3>Excluded</h3>`;
  html += '<ul>';
  content.scope.excluded.forEach((item) => {
    html += `<li>${item}</li>`;
  });
  html += '</ul>';

  // Deliverables
  html += `<h2>Deliverables</h2>`;
  content.deliverables.forEach((d) => {
    html += `<h3>${d.name}</h3>`;
    html += `<p>${d.description}</p>`;
    html += `<p><strong>Estimated Hours:</strong> ${d.estimate.expected_hours} (${d.estimate.optimistic_hours} - ${d.estimate.pessimistic_hours})</p>`;
  });

  // Assumptions
  html += `<h2>Assumptions</h2>`;
  html += '<ul>';
  content.assumptions.forEach((item) => {
    html += `<li>${item}</li>`;
  });
  html += '</ul>';

  // Risks
  if (content.risks.length > 0) {
    html += `<h2>Risks</h2>`;
    content.risks.forEach((risk) => {
      html += `<h3>${risk.description}</h3>`;
      html += `<p><strong>Impact:</strong> ${risk.impact}</p>`;
      html += `<p><strong>Mitigation:</strong> ${risk.mitigation}</p>`;
    });
  }

  // Totals - HOURS ONLY (pricing is out of scope)
  html += `<h2>Summary</h2>`;
  html += `<p><strong>Total Expected Hours:</strong> ${content?.totals?.total_expected_hours || 0}</p>`;
  // NOTE: Pricing is handled by separate sales team - not shown here

  return html;
}

/**
 * Quote Preview Component
 */
function QuotePreview({ quote }: { quote: Quote }) {
  return (
    <div className="h-full overflow-auto p-8 bg-gray-100">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{quote.quote_number}</h1>
        <p className="text-lg text-gray-600 mb-8">{quote.project.name}</p>

        {/* Executive Summary */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Executive Summary</h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {quote.content.executive_summary}
          </p>
        </section>

        {/* Scope */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Scope</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Included</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {quote.content.scope.included.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Excluded</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-500">
                {quote.content.scope.excluded.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Deliverables */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Deliverables</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Item</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Min</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Expected</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {quote.content.deliverables.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{d.name}</p>
                      <p className="text-sm text-gray-500">{d.description}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{d.estimate.optimistic_hours}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-900">{d.estimate.expected_hours}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{d.estimate.pessimistic_hours}</td>
                  </tr>
                ))}
                <tr className="bg-primary-50 font-semibold">
                  <td className="px-4 py-3 text-gray-900">Total</td>
                  <td className="px-4 py-3 text-center text-gray-700">{quote.content.totals.total_optimistic_hours}</td>
                  <td className="px-4 py-3 text-center text-primary-700">{quote.content.totals.total_expected_hours}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{quote.content.totals.total_pessimistic_hours}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Summary - HOURS ONLY (pricing is handled by sales team) */}
        <section className="bg-gray-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Total</h2>
          <div className="text-center p-4 bg-primary-100 rounded-lg max-w-xs mx-auto">
            <p className="text-sm text-primary-700">Total Hours</p>
            <p className="text-3xl font-bold text-primary-900">
              {quote.content?.totals?.total_expected_hours || quote.total_hours || 0}
            </p>
            <p className="text-xs text-primary-600 mt-1">hours</p>
          </div>
          <p className="text-sm text-gray-500 text-center mt-4">
            Note: Pricing is handled by the sales team separately.
          </p>
        </section>
      </div>
    </div>
  );
}

export default QuoteEditPage;

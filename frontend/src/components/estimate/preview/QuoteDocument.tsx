/**
 * QuoteDocument Component
 *
 * Single-source-of-truth document preview. Renders a professional header
 * plus a single body region derived from the canonical content string:
 * - If the body is HTML (from the Tiptap editor), render it as HTML.
 * - Otherwise, render it as markdown via MarkdownBody.
 *
 * This keeps the preview layout stable before and after edits, since both
 * the editor and the preview work from the same underlying document body.
 */

import React from 'react';
import { MarkdownBody } from '@/components/common/MarkdownBody';
import { ensureEstimatedEffortSection } from '@/lib/quote-document-utils';
import { isHtmlContent } from '@/lib/quote-to-html';
import type { Quote } from '@/types';

interface QuoteDocumentProps {
  quote: Quote;
}

export function QuoteDocument({ quote }: QuoteDocumentProps) {
  const content = quote.content;

  // Derive key header fields from project name (no separate client; project name is used for "Prepared for").
  const projectNameFromRef = quote.project?.name || (quote as Quote & { project_name?: string }).project_name || '';
  const headerProjectName = projectNameFromRef || quote.title || '';
  const preparedFor = headerProjectName || 'Client';
  // Default "Prepared by" is E2M Solutions; user can override via API prepared_by or metadata
  const DEFAULT_PREPARED_BY = 'E2M Solutions';
  const preparedBy =
    quote.prepared_by ?? quote.metadata?.prepared_by ?? DEFAULT_PREPARED_BY;

  // Format date with proper validation
  const formatDate = (dateString?: string | null) => {
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
  };

  // No content yet
  if (!content || !content.executive_summary?.trim()) {
    return (
      <div className="doc-container">
        <div className="doc-header">
          <h1 className="doc-title">
            {headerProjectName ? `Proposal for ${headerProjectName}` : 'Project Proposal'}
          </h1>
          <p
            className="doc-body-text"
            style={{ textAlign: 'center', color: 'var(--color-gray-500)' }}
          >
            The estimate content is still being generated. Please wait...
          </p>
        </div>
      </div>
    );
  }

  let body = content.executive_summary.trim();
  const bodyIsHtml = isHtmlContent(body);

  // Prefer canonical total hours from content.totals, fall back to root total_hours
  const totalHours =
    Number(content.totals?.total_expected_hours ?? 0) ||
    Number(quote.total_hours ?? 0) ||
    0;

  // For markdown bodies, inject fallback "Estimated Effort & Timeline" copy
  // when that section is present but empty. For HTML bodies we now respect the
  // original layout entirely and do NOT auto-inject any extra sections, to
  // avoid disturbing carefully formatted estimate documents.
  if (!bodyIsHtml) {
    body = ensureEstimatedEffortSection(body, totalHours);
  }

  return (
    <div className="doc-container">
      {/* Professional Document Header */}
      <div className="doc-header">
        <h1 className="doc-title">
          {headerProjectName ? `Proposal for ${headerProjectName}` : 'Project Proposal'}
        </h1>
        <div className="doc-metadata">
          <div className="doc-metadata-item">
            <span className="doc-metadata-label">Date</span>
            <span className="doc-metadata-value">
              {formatDate(quote.created_at)}
            </span>
          </div>
          {preparedFor && (
            <div className="doc-metadata-item">
              <span className="doc-metadata-label">Prepared for</span>
              <span className="doc-metadata-value">{preparedFor}</span>
            </div>
          )}
          {preparedBy && (
            <div className="doc-metadata-item">
              <span className="doc-metadata-label">Prepared by</span>
              <span className="doc-metadata-value">{preparedBy}</span>
            </div>
          )}
        </div>
      </div>

      {/* Canonical document body */}
      <div className="doc-content-body">
        {bodyIsHtml ? (
          // HTML produced/edited by the Tiptap editor.
          // Use the same typography/layout classes as the inline editor
          // so Preview and Edit modes look identical.
          <div className="doc-editor-preview" dangerouslySetInnerHTML={{ __html: body }} />
        ) : (
          <MarkdownBody content={body} />
        )}
      </div>
    </div>
  );
}

export default QuoteDocument;


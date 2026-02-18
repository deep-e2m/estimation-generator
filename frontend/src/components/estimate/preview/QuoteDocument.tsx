/**
 * QuoteDocument Component
 *
 * Single-source-of-truth document preview. Renders a professional header
 * plus a body derived from quote content:
 * - BlockNote JSON (array of blocks) → converted to HTML and rendered.
 * - HTML (from editor) → rendered as HTML.
 * - Otherwise → markdown via MarkdownBody.
 */

import React from 'react';
import { MarkdownBody } from '@/components/common/MarkdownBody';
import { ensureEstimatedEffortSection } from '@/lib/quote-document-utils';
import { isBlockNoteJson, blocknoteJsonToHtml } from '@/lib/blocknote-to-html';
import { isHtmlContent } from '@/lib/quote-to-html';
import type { Quote } from '@/types';

interface QuoteDocumentProps {
  quote: Quote;
}

export function QuoteDocument({ quote }: QuoteDocumentProps) {
  const content = quote.content;

  const projectName = quote.project?.name || (quote as Quote & { project_name?: string }).project_name || 'Project';
  const preparedBy = quote.prepared_by ?? quote.metadata?.prepared_by ?? 'E2M Solutions';

  const formatDate = (dateString?: string | null) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    if (!dateString) return new Date().toLocaleDateString('en-US', options);
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return new Date().toLocaleDateString('en-US', options);
    return date.toLocaleDateString('en-US', options);
  };

  if (!content) {
    return (
      <div className="doc-container">
        <div className="doc-header">
          <h1 className="doc-title">Proposal for {projectName}</h1>
          <p className="doc-body-text" style={{ textAlign: 'center', color: 'var(--color-gray-500)' }}>
            The estimate content is still being generated. Please wait...
          </p>
        </div>
      </div>
    );
  }

  const body = (content.executive_summary || '').trim();
  const isBlockNote = body ? isBlockNoteJson(body) : false;
  const bodyIsHtml = body && !isBlockNote ? isHtmlContent(body) : false;

  const totalHours =
    Number(content.totals?.total_expected_hours ?? 0) ||
    Number(quote.total_hours ?? 0) ||
    0;
  const bodyWithEffort = !bodyIsHtml && !isBlockNote && body ? ensureEstimatedEffortSection(body, totalHours) : body;

  const bodyContent = (() => {
    if (isBlockNote && body) {
      const html = blocknoteJsonToHtml(body);
      return <div className="doc-editor-preview" dangerouslySetInnerHTML={{ __html: html }} />;
    }
    if (bodyIsHtml) {
      return <div className="doc-editor-preview" dangerouslySetInnerHTML={{ __html: body }} />;
    }
    return <MarkdownBody content={bodyWithEffort ?? ''} />;
  })();

  return (
    <div className="doc-container">
      <div className="doc-header">
        <h1 className="doc-title">Proposal for {projectName}</h1>
        <div className="doc-metadata">
          <div className="doc-metadata-item doc-metadata-col-1">
            <span className="doc-metadata-label">Prepared for</span>
            <span className="doc-metadata-value">{projectName}</span>
          </div>
          <div className="doc-metadata-item doc-metadata-col-2">
            <span className="doc-metadata-label">Date</span>
            <span className="doc-metadata-value">
              {formatDate(quote.created_at)}
            </span>
          </div>
          <div className="doc-metadata-item doc-metadata-col-3">
            <span className="doc-metadata-label">Prepared by</span>
            <span className="doc-metadata-value">{preparedBy}</span>
          </div>
        </div>
      </div>

      <div className="doc-content-body">
        {bodyContent}
      </div>
    </div>
  );
}

export default QuoteDocument;

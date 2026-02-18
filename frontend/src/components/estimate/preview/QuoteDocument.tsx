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
import { ESTIMATION_OUTCOMES_KEYS, ESTIMATION_OUTCOMES_LABELS } from '@/constants/estimation-outcomes';
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

  const hasEstimationOutcomes = content.estimation_outcomes && Object.keys(content.estimation_outcomes).length > 0;
  const body = (content.executive_summary || '').trim();
  const bodyIsHtml = body ? isHtmlContent(body) : false;

  const totalHours =
    Number(content.totals?.total_expected_hours ?? 0) ||
    Number(quote.total_hours ?? 0) ||
    0;
  const bodyWithEffort = !bodyIsHtml && body ? ensureEstimatedEffortSection(body, totalHours) : body;

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

      {hasEstimationOutcomes ? (
        <div className="doc-content-body">
          {ESTIMATION_OUTCOMES_KEYS.map((key) => {
            const value = content.estimation_outcomes![key];
            if (value == null || value === '') return null;
            return (
              <div key={key} className="doc-section">
                <h2 className="doc-section-title">
                  {ESTIMATION_OUTCOMES_LABELS[key] ?? key}
                </h2>
                <div className="doc-body-text whitespace-pre-wrap">{value}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="doc-content-body">
          {bodyIsHtml ? (
            <div className="doc-editor-preview" dangerouslySetInnerHTML={{ __html: body }} />
          ) : (
            <MarkdownBody content={bodyWithEffort} />
          )}
        </div>
      )}
    </div>
  );
}

export default QuoteDocument;


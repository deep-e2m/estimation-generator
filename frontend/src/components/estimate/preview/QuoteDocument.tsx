/**
 * QuoteDocument Component
 * Main document container with all sections following the reference format
 */

import React from 'react';
import { motion } from 'framer-motion';
import { MarkdownBody } from '@/components/common/MarkdownBody';
import { isMarkdownOnlyContent } from '@/lib/quote-normalizer';
import type { Quote } from '@/types';
import type { Risk } from '@/types/quote.types';

interface QuoteDocumentProps {
  quote: Quote;
}

function RiskItem({ risk, index }: { risk: Risk; index: number }) {
  const impactColors = {
    high: 'risk-high',
    medium: 'risk-medium',
    low: 'risk-low',
  };

  return (
    <motion.div
      className={`risk-item ${impactColors[risk.impact]}`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      style={{ marginBottom: '16px' }}
    >
      <div className="risk-item-header">
        <span className={`risk-badge ${impactColors[risk.impact]}`}>
          {risk.impact.toUpperCase()} IMPACT
        </span>
      </div>
      <p className="risk-description" style={{ fontWeight: 600, fontSize: '15px', lineHeight: '1.7', marginTop: '8px' }}>
        {risk.description}
      </p>
      {risk.mitigation && (
        <p className="risk-mitigation" style={{ fontSize: '14px', lineHeight: '1.7', marginTop: '8px' }}>
          <strong style={{ color: 'var(--color-gray-900)' }}>Mitigation Strategy:</strong>{' '}
          {risk.mitigation}
        </p>
      )}
    </motion.div>
  );
}

export function QuoteDocument({ quote }: QuoteDocumentProps) {
  const content = quote.content;

  if (!content) {
    return (
      <div className="doc-container">
        <div className="doc-header">
          <h1 className="doc-title">Project Estimate Document</h1>
          <p className="doc-body-text" style={{ textAlign: 'center', color: 'var(--color-gray-500)' }}>
            The estimate content is still being generated. Please wait...
          </p>
        </div>
      </div>
    );
  }

  const isMarkdownOnly = isMarkdownOnlyContent(content);

  // Format date with proper validation
  const formatDate = (dateString?: string | null) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    
    // Handle missing or empty date
    if (!dateString) {
      return new Date().toLocaleDateString('en-US', options);
    }
    
    // Try to parse the date
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return new Date().toLocaleDateString('en-US', options);
    }
    
    return date.toLocaleDateString('en-US', options);
  };

  return (
    <div className="doc-container">
      {/* Professional Document Header */}
      <div className="doc-header">
        <h1 className="doc-title">Project Estimate Document</h1>
        <div className="doc-metadata">
          <div className="doc-metadata-item">
            <span className="doc-metadata-label">Quote Number</span>
            <span className="doc-metadata-value">
              {quote.quote_number || `EST-${quote.id?.slice(0, 8).toUpperCase()}`}
            </span>
          </div>
          <div className="doc-metadata-item">
            <span className="doc-metadata-label">Date</span>
            <span className="doc-metadata-value">
              {formatDate(quote.created_at)}
            </span>
          </div>
          {(quote.project?.name || quote.project_name) && (
            <div className="doc-metadata-item">
              <span className="doc-metadata-label">Project</span>
              <span className="doc-metadata-value">{quote.project?.name || quote.project_name}</span>
            </div>
          )}
        </div>
      </div>

      {/* For markdown-only content, render directly without extra wrapper */}
      {isMarkdownOnly && content.executive_summary && (
        <div className="doc-content-body">
          <MarkdownBody content={content.executive_summary} />
        </div>
      )}

      {/* Section 1: Executive Summary (only for structured content) */}
      {!isMarkdownOnly && content.executive_summary && (
        <div className="doc-section">
          <div className="doc-section-number">1</div>
          <h2 className="doc-section-title">Executive Summary</h2>
          <p className="doc-body-text">{content.executive_summary}</p>
        </div>
      )}

      {/* Section 2: Deliverables & Scope (skip when markdown-only) */}
      {!isMarkdownOnly && content.deliverables && content.deliverables.length > 0 && (
        <div className="doc-section">
          <div className="doc-section-number">2</div>
          <h2 className="doc-section-title">Deliverables & Scope</h2>
          {(() => {
            // Group deliverables by category
            const grouped = content.deliverables.reduce((acc, d) => {
              const cat = d.category || 'General';
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(d);
              return acc;
            }, {} as Record<string, typeof content.deliverables>);

            return Object.entries(grouped).map(([category, items]) => {
              const categoryTotal = items.reduce((sum, item) =>
                sum + (item.estimated_hours?.expected ?? 0), 0
              );

              return (
                <div key={category} style={{ marginBottom: '32px' }}>
                  <div className="doc-category-header">
                    <h3 className="doc-category-title">{category}</h3>
                    <span className="doc-category-hours">{categoryTotal}h</span>
                  </div>
                  {items.map((item, idx) => (
                    <div key={idx} className="doc-deliverable-item">
                      <div className="doc-deliverable-header">
                        <span className="doc-deliverable-name">{item.name}</span>
                        <span className="doc-deliverable-hours">
                          {item.estimated_hours?.expected ?? 0}h
                        </span>
                      </div>
                      {item.description && (
                        <p className="doc-deliverable-desc">{item.description}</p>
                      )}
                      {item.estimated_hours && (
                        <div className="doc-deliverable-estimates">
                          <span>Min: {item.estimated_hours.optimistic}h</span>
                          <span>Expected: {item.estimated_hours.expected}h</span>
                          <span>Max: {item.estimated_hours.pessimistic}h</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Section 3: Scope (Included/Excluded) */}
      {!isMarkdownOnly && content.scope && (
        <div className="doc-section">
          <div className="doc-section-number">3</div>
          <h2 className="doc-section-title">Scope Definition</h2>

          {content.scope.included && content.scope.included.length > 0 && (
            <>
              <h3 className="doc-subsection-title">Included in Scope</h3>
              <ul className="doc-list">
                {content.scope.included.map((item, idx) => (
                  <li key={idx} className="doc-scope-item included">{item}</li>
                ))}
              </ul>
            </>
          )}

          {content.scope.excluded && content.scope.excluded.length > 0 && (
            <>
              <h3 className="doc-subsection-title">Excluded from Scope</h3>
              <ul className="doc-list">
                {content.scope.excluded.map((item, idx) => (
                  <li key={idx} className="doc-scope-item excluded">{item}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Section 4: Assumptions */}
      {!isMarkdownOnly && content.assumptions && content.assumptions.length > 0 && (
        <div className="doc-section">
          <div className="doc-section-number">4</div>
          <h2 className="doc-section-title">Assumptions</h2>
          <ol className="doc-list-ordered">
            {content.assumptions.map((assumption, idx) => (
              <li key={idx} className="doc-list-ordered-item">{assumption}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Section 5: Risks */}
      {!isMarkdownOnly && content.risks && content.risks.length > 0 && (
        <div className="doc-section">
          <div className="doc-section-number">5</div>
          <h2 className="doc-section-title">Risks & Mitigation</h2>
          <div className="risks-list">
            {content.risks.map((risk, index) => (
              <RiskItem key={index} risk={risk} index={index} />
            ))}
          </div>
        </div>
      )}

      {/* Section 6: Timeline */}
      {!isMarkdownOnly && content.timeline && (
        <div className="doc-section">
          <div className="doc-section-number">6</div>
          <h2 className="doc-section-title">Project Timeline</h2>

          {content.timeline.start_date && content.timeline.end_date && (
            <p className="doc-body-text">
              <span className="doc-emphasis">Duration:</span>{' '}
              {new Date(content.timeline.start_date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}{' '}
              to{' '}
              {new Date(content.timeline.end_date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </p>
          )}

          {content.timeline.milestones && content.timeline.milestones.length > 0 && (
            <>
              <h3 className="doc-subsection-title">Key Milestones</h3>
              <div style={{ marginLeft: '16px' }}>
                {content.timeline.milestones.map((milestone, idx) => (
                  <div key={idx} className="doc-timeline-item">
                    <span className="doc-timeline-date">
                      {new Date(milestone.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                    <span className="doc-timeline-milestone">{milestone.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Section 7: Project Totals - Removed from preview as per user request */}
      {/* Estimate Summary section commented out - not shown in preview */}
    </div>
  );
}

export default QuoteDocument;

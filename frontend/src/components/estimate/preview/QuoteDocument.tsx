/**
 * QuoteDocument Component
 * Main document container with all sections following the reference format
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Package,
  Target,
  AlertTriangle,
  Calendar,
  ListChecks,
  XCircle,
} from 'lucide-react';
import { MarkdownBody } from '@/components/common/MarkdownBody';
import { isMarkdownOnlyContent } from '@/lib/quote-normalizer';
import { DocumentSection } from './DocumentSection';
import { DeliverablesList } from './DeliverablesList';
import { ScopeSection } from './ScopeSection';
import { TimelineSection } from './TimelineSection';
import { TotalsSummary } from './TotalsSummary';
import type { Quote } from '@/types';
import type { ChangeDescription, Risk } from '@/types/quote.types';

interface QuoteDocumentProps {
  quote: Quote;
  recentChanges?: ChangeDescription[];
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
    >
      <div className="risk-item-header">
        <span className={`risk-badge ${impactColors[risk.impact]}`}>
          {risk.impact.toUpperCase()}
        </span>
      </div>
      <p className="risk-description">{risk.description}</p>
      {risk.mitigation && (
        <p className="risk-mitigation">
          <strong>Mitigation:</strong> {risk.mitigation}
        </p>
      )}
    </motion.div>
  );
}

function AssumptionsList({ assumptions }: { assumptions: string[] }) {
  return (
    <ul className="assumptions-list">
      {assumptions.map((assumption, index) => (
        <motion.li
          key={index}
          className="assumption-item"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: index * 0.03 }}
        >
          <span className="assumption-bullet" />
          <span>{assumption}</span>
        </motion.li>
      ))}
    </ul>
  );
}

export function QuoteDocument({ quote, recentChanges = [] }: QuoteDocumentProps) {
  const content = quote.content;
  
  // Calculate total hours
  const totalHours = useMemo(() => {
    return (
      quote.total_hours ??
      content?.totals?.total_expected_hours ??
      0
    );
  }, [quote, content]);

  // Check if a section was recently changed
  const isSectionHighlighted = (sectionName: string) => {
    return recentChanges.some(
      (change) => change.section.toLowerCase() === sectionName.toLowerCase()
    );
  };

  if (!content) {
    return (
      <div className="quote-document-empty">
        <FileText className="h-12 w-12 text-gray-300" />
        <h3>No Content Available</h3>
        <p>The estimate content is still being generated.</p>
      </div>
    );
  }

  const isMarkdownOnly = isMarkdownOnlyContent(content);

  return (
    <div className="quote-document">
      {/* When content is markdown-only (from API string), render single document section */}
      {content.executive_summary && (
        <DocumentSection
          number="1"
          title={isMarkdownOnly ? 'Estimate' : 'Project Overview'}
          icon={<FileText className="h-4 w-4" />}
          isHighlighted={isSectionHighlighted('executive_summary')}
        >
          {isMarkdownOnly ? (
            <MarkdownBody content={content.executive_summary} />
          ) : (
            <p className="executive-summary">{content.executive_summary}</p>
          )}
        </DocumentSection>
      )}

      {/* Section 2: Deliverables & Scope (skip when markdown-only) */}
      {!isMarkdownOnly && content.deliverables && content.deliverables.length > 0 && (
        <DocumentSection
          number="2"
          title="Deliverables & Scope"
          icon={<Package className="h-4 w-4" />}
          badge={content.deliverables.length}
          isHighlighted={isSectionHighlighted('deliverables')}
        >
          <DeliverablesList
            deliverables={content.deliverables}
            totalHours={totalHours}
            recentChanges={recentChanges}
          />
        </DocumentSection>
      )}

      {/* Section 3: Scope (Included/Excluded) */}
      {!isMarkdownOnly && content.scope && (
        <DocumentSection
          number="3"
          title="Scope Definition"
          icon={<Target className="h-4 w-4" />}
          isHighlighted={isSectionHighlighted('scope')}
          defaultExpanded={false}
        >
          <ScopeSection scope={content.scope} />
        </DocumentSection>
      )}

      {/* Section 4: Assumptions */}
      {!isMarkdownOnly && content.assumptions && content.assumptions.length > 0 && (
        <DocumentSection
          number="4"
          title="Assumptions"
          icon={<ListChecks className="h-4 w-4" />}
          badge={content.assumptions.length}
          isHighlighted={isSectionHighlighted('assumptions')}
          defaultExpanded={false}
        >
          <AssumptionsList assumptions={content.assumptions} />
        </DocumentSection>
      )}

      {/* Section 5: Risks */}
      {!isMarkdownOnly && content.risks && content.risks.length > 0 && (
        <DocumentSection
          number="5"
          title="Risks"
          icon={<AlertTriangle className="h-4 w-4" />}
          badge={content.risks.length}
          isHighlighted={isSectionHighlighted('risks')}
          defaultExpanded={false}
        >
          <div className="risks-list">
            {content.risks.map((risk, index) => (
              <RiskItem key={index} risk={risk} index={index} />
            ))}
          </div>
        </DocumentSection>
      )}

      {/* Section 6: Timeline */}
      {!isMarkdownOnly && content.timeline && (
        <DocumentSection
          number="6"
          title="Timeline"
          icon={<Calendar className="h-4 w-4" />}
          isHighlighted={isSectionHighlighted('timeline')}
        >
          <TimelineSection timeline={content.timeline} />
        </DocumentSection>
      )}

      {/* Section 7: Exclusions */}
      {!isMarkdownOnly && content.scope?.excluded && content.scope.excluded.length > 0 && (
        <DocumentSection
          number="7"
          title="Exclusions"
          icon={<XCircle className="h-4 w-4" />}
          badge={content.scope.excluded.length}
          defaultExpanded={false}
        >
          <ul className="exclusions-list">
            {content.scope.excluded.map((item, index) => (
              <motion.li
                key={index}
                className="exclusion-item"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
              >
                <XCircle className="h-4 w-4" />
                <span>{item}</span>
              </motion.li>
            ))}
          </ul>
        </DocumentSection>
      )}

      {/* Section 8: Totals Summary */}
      {content.totals && (
        <TotalsSummary
          totals={content.totals}
          timeline={content.timeline}
          confidence={quote.generation_metadata?.confidence_score}
        />
      )}
    </div>
  );
}

export default QuoteDocument;

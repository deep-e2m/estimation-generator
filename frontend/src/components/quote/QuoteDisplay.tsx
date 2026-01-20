/**
 * QuoteDisplay Component
 * Displays a generated quote with:
 * - Line items table (Category | Description | Hours Min/Likely/Max)
 * - Summary section with total hours
 * - Research references with clickable URLs
 * - Assumptions and exclusions sections
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Link as LinkIcon,
  Edit2,
} from 'lucide-react';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import type {
  Quote,
  Deliverable,
  ResearchReference,
  Risk,
  QuoteTotals,
} from '../../types/quote.types';

interface QuoteDisplayProps {
  quote: Quote;
  onEdit?: () => void;
  className?: string;
}

export const QuoteDisplay: React.FC<QuoteDisplayProps> = ({
  quote,
  onEdit,
  className,
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    scope: true,
    deliverables: true,
    assumptions: true,
    risks: false,
    research: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const { content } = quote;

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200', className)}>
      {/* Header */}
      <QuoteHeader quote={quote} onEdit={onEdit} />

      {/* Executive Summary */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Executive Summary
        </h3>
        <p className="text-gray-700 leading-relaxed">{content.executive_summary}</p>
      </div>

      {/* Scope Section */}
      <CollapsibleSection
        title="Scope"
        isExpanded={expandedSections.scope}
        onToggle={() => toggleSection('scope')}
        badge={`${content.scope.included.length} included, ${content.scope.excluded.length} excluded`}
      >
        <ScopeSection scope={content.scope} />
      </CollapsibleSection>

      {/* Deliverables Table */}
      <CollapsibleSection
        title="Deliverables"
        isExpanded={expandedSections.deliverables}
        onToggle={() => toggleSection('deliverables')}
        badge={`${content.deliverables.length} items`}
      >
        <DeliverablesTable deliverables={content.deliverables} />
      </CollapsibleSection>

      {/* Totals Summary */}
      <TotalsSummary totals={content.totals} />

      {/* Assumptions Section */}
      <CollapsibleSection
        title="Assumptions"
        isExpanded={expandedSections.assumptions}
        onToggle={() => toggleSection('assumptions')}
        badge={`${content.assumptions.length} items`}
      >
        <AssumptionsList assumptions={content.assumptions} />
      </CollapsibleSection>

      {/* Risks Section */}
      <CollapsibleSection
        title="Risks"
        isExpanded={expandedSections.risks}
        onToggle={() => toggleSection('risks')}
        badge={`${content.risks.length} items`}
      >
        <RisksList risks={content.risks} />
      </CollapsibleSection>

      {/* Research References Section */}
      <CollapsibleSection
        title="Research References"
        isExpanded={expandedSections.research}
        onToggle={() => toggleSection('research')}
        badge={`${content.research_references.length} sources`}
      >
        <ResearchReferencesList references={content.research_references} />
      </CollapsibleSection>

      {/* Metadata Footer */}
      <QuoteFooter quote={quote} />
    </div>
  );
};

/**
 * Quote Header with number, status, and basic info
 */
interface QuoteHeaderProps {
  quote: Quote;
  onEdit?: () => void;
}

const QuoteHeader: React.FC<QuoteHeaderProps> = ({ quote, onEdit }) => {
  const statusColors = {
    generating: 'bg-yellow-100 text-yellow-800',
    draft: 'bg-gray-100 text-gray-800',
    finalized: 'bg-blue-100 text-blue-800',
    sent: 'bg-purple-100 text-purple-800',
    accepted: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    archived: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900">{quote.quote_number}</h2>
            <span
              className={cn(
                'px-2.5 py-0.5 text-xs font-medium rounded-full capitalize',
                statusColors[quote.status]
              )}
            >
              {quote.status}
            </span>
            {quote.version > 1 && (
              <span className="px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded">
                v{quote.version}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {quote.project.name}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Created {formatDate(quote.created_at)} by {quote.created_by.full_name}
          </p>
        </div>
        {onEdit && quote.status === 'draft' && (
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Collapsible section wrapper
 */
interface CollapsibleSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  isExpanded,
  onToggle,
  badge,
  children,
}) => {
  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {badge && (
            <span className="px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded">
              {badge}
            </span>
          )}
        </div>
      </button>
      {isExpanded && <div className="px-6 pb-4">{children}</div>}
    </div>
  );
};

/**
 * Scope section with included/excluded items
 */
interface ScopeSectionProps {
  scope: Quote['content']['scope'];
}

const ScopeSection: React.FC<ScopeSectionProps> = ({ scope }) => {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Included */}
      <div>
        <h4 className="text-sm font-medium text-green-800 flex items-center gap-2 mb-3">
          <CheckCircle className="h-4 w-4" />
          Included in Scope
        </h4>
        <ul className="space-y-2">
          {scope.included.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Excluded */}
      <div>
        <h4 className="text-sm font-medium text-gray-600 flex items-center gap-2 mb-3">
          <XCircle className="h-4 w-4" />
          Excluded from Scope
        </h4>
        <ul className="space-y-2">
          {scope.excluded.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-gray-500">
              <XCircle className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

/**
 * Deliverables table with hours estimates
 */
interface DeliverablesTableProps {
  deliverables: Deliverable[];
}

const DeliverablesTable: React.FC<DeliverablesTableProps> = ({ deliverables }) => {
  // Group deliverables by category
  const groupedDeliverables = deliverables.reduce((acc, item) => {
    const category = item.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, Deliverable[]>);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-semibold text-gray-600">Description</th>
            <th className="text-right py-3 px-4 font-semibold text-gray-600 whitespace-nowrap">
              Min Hours
            </th>
            <th className="text-right py-3 px-4 font-semibold text-gray-600 whitespace-nowrap">
              Likely Hours
            </th>
            <th className="text-right py-3 px-4 font-semibold text-gray-600 whitespace-nowrap">
              Max Hours
            </th>
            <th className="text-right py-3 px-4 font-semibold text-gray-600 whitespace-nowrap">
              Expected
            </th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedDeliverables).map(([category, items]) => (
            <React.Fragment key={category}>
              {/* Category Header */}
              {Object.keys(groupedDeliverables).length > 1 && (
                <tr className="bg-gray-50">
                  <td
                    colSpan={5}
                    className="py-2 px-4 font-semibold text-gray-700"
                  >
                    {category}
                  </td>
                </tr>
              )}
              {/* Items */}
              {items.map((item, index) => (
                <tr
                  key={item.id}
                  className={cn(
                    'border-b border-gray-100',
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  )}
                >
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900">{item.name}</div>
                    <div className="text-gray-500 text-xs mt-0.5">{item.description}</div>
                  </td>
                  <td className="text-right py-3 px-4 text-gray-600">
                    {item.estimate.optimistic_hours}
                  </td>
                  <td className="text-right py-3 px-4 text-gray-600">
                    {item.estimate.most_likely_hours}
                  </td>
                  <td className="text-right py-3 px-4 text-gray-600">
                    {item.estimate.pessimistic_hours}
                  </td>
                  <td className="text-right py-3 px-4 font-medium text-gray-900">
                    {item.estimate.expected_hours}
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Totals summary section
 */
interface TotalsSummaryProps {
  totals: QuoteTotals;
}

const TotalsSummary: React.FC<TotalsSummaryProps> = ({ totals }) => {
  return (
    <div className="px-6 py-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-y border-gray-200">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Total Estimate
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {/* Hours Range */}
        <div>
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">Hours Range</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {totals.total_optimistic_hours} - {totals.total_pessimistic_hours}
          </p>
        </div>

        {/* Expected Hours */}
        <div>
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">Expected Hours</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {totals.total_expected_hours}
          </p>
        </div>

        {/* Hourly Rate */}
        <div>
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">Hourly Rate</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(totals.hourly_rate, totals.currency)}
          </p>
        </div>

        {/* Total Cost */}
        <div>
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">Total Cost</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(totals.total_cost, totals.currency)}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Assumptions list
 */
interface AssumptionsListProps {
  assumptions: string[];
}

const AssumptionsList: React.FC<AssumptionsListProps> = ({ assumptions }) => {
  return (
    <ul className="space-y-2">
      {assumptions.map((assumption, index) => (
        <li
          key={index}
          className="flex items-start gap-3 text-sm text-gray-700 py-2 px-3 bg-amber-50 rounded"
        >
          <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-amber-200 text-amber-800 rounded text-xs font-medium">
            {index + 1}
          </span>
          {assumption}
        </li>
      ))}
    </ul>
  );
};

/**
 * Risks list
 */
interface RisksListProps {
  risks: Risk[];
}

const RisksList: React.FC<RisksListProps> = ({ risks }) => {
  const impactColors = {
    low: 'text-green-700 bg-green-100',
    medium: 'text-amber-700 bg-amber-100',
    high: 'text-red-700 bg-red-100',
  };

  return (
    <div className="space-y-3">
      {risks.map((risk, index) => (
        <div
          key={risk.id || index}
          className="p-4 border border-gray-200 rounded-lg bg-white"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={cn(
                  'h-5 w-5 flex-shrink-0',
                  risk.impact === 'low' && 'text-green-500',
                  risk.impact === 'medium' && 'text-amber-500',
                  risk.impact === 'high' && 'text-red-500'
                )}
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{risk.description}</p>
                <p className="text-xs text-gray-500 mt-1">
                  <span className="font-medium">Mitigation:</span> {risk.mitigation}
                </p>
              </div>
            </div>
            <span
              className={cn(
                'px-2 py-0.5 text-xs font-medium rounded capitalize',
                impactColors[risk.impact]
              )}
            >
              {risk.impact} impact
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Research references list with clickable URLs
 */
interface ResearchReferencesListProps {
  references: ResearchReference[];
}

const ResearchReferencesList: React.FC<ResearchReferencesListProps> = ({ references }) => {
  const sourceTypeBadges: Record<string, string> = {
    official_docs: 'bg-blue-100 text-blue-700',
    plugin_page: 'bg-purple-100 text-purple-700',
    api_reference: 'bg-green-100 text-green-700',
    community: 'bg-amber-100 text-amber-700',
    other: 'bg-gray-100 text-gray-700',
  };

  const sourceTypeLabels: Record<string, string> = {
    official_docs: 'Official Docs',
    plugin_page: 'Plugin Page',
    api_reference: 'API Reference',
    community: 'Community',
    other: 'Other',
  };

  return (
    <div className="space-y-3">
      {references.map((ref, index) => (
        <div
          key={ref.id || index}
          className="p-4 border border-gray-200 rounded-lg bg-white hover:border-blue-200 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-gray-400" />
                <span
                  className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded',
                    sourceTypeBadges[ref.source_type] || sourceTypeBadges.other
                  )}
                >
                  {sourceTypeLabels[ref.source_type] || 'Source'}
                </span>
                {ref.is_valid === false && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">
                    Link may be outdated
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-900">{ref.summary}</p>
              <p className="text-xs text-gray-500 mt-1">{ref.relevance_note}</p>
            </div>
            <a
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <LinkIcon className="h-4 w-4" />
              Visit
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Quote footer with metadata
 */
interface QuoteFooterProps {
  quote: Quote;
}

const QuoteFooter: React.FC<QuoteFooterProps> = ({ quote }) => {
  return (
    <div className="px-6 py-4 bg-gray-50 rounded-b-lg border-t border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          {quote.generation_metadata && (
            <>
              <span>
                Generated in {quote.generation_metadata.generation_time_seconds}s
              </span>
              <span>
                Confidence: {Math.round(quote.generation_metadata.confidence_score * 100)}%
              </span>
              <span>
                {quote.generation_metadata.knowledge_docs_used.length} knowledge sources used
              </span>
            </>
          )}
        </div>
        <span>Last updated: {formatDate(quote.updated_at, { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
};

export default QuoteDisplay;

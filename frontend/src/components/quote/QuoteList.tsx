/**
 * QuoteList Component
 * Displays a list of quotes for a project
 *
 * Features:
 * - Quote cards with summary info
 * - Status badges
 * - Click to view/edit
 * - Loading and empty states
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, DollarSign, ChevronRight, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { QuoteSummary, QuoteStatus } from '@/types';

interface QuoteListProps {
  quotes: QuoteSummary[];
  projectId: string;
  isLoading?: boolean;
  onQuoteClick?: (quoteId: string) => void;
  onCreateQuote?: () => void;
  className?: string;
}

// Map status to badge variant
function getStatusBadgeVariant(status: QuoteStatus): 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' {
  const variants: Record<QuoteStatus, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
    generating: 'default',
    draft: 'warning',
    finalized: 'success',
    sent: 'default',
    accepted: 'success',
    rejected: 'destructive',
    archived: 'secondary',
  };
  return variants[status] || 'secondary';
}

// Map status to display label
function getStatusLabel(status: QuoteStatus): string {
  const labels: Record<QuoteStatus, string> = {
    generating: 'Generating',
    draft: 'Draft',
    finalized: 'Finalized',
    sent: 'Sent',
    accepted: 'Accepted',
    rejected: 'Rejected',
    archived: 'Archived',
  };
  return labels[status] || status;
}

/**
 * Individual quote card
 */
interface QuoteCardProps {
  quote: QuoteSummary;
  onClick: () => void;
}

function QuoteCard({ quote, onClick }: QuoteCardProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary-200"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left side - Quote info */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                <FileText className="h-5 w-5 text-primary-600" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {quote.quote_number}
                  </h3>
                  {quote.version > 1 && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      v{quote.version}
                    </span>
                  )}
                </div>
                {quote.client_name && (
                  <p className="text-sm text-gray-500 truncate">{quote.client_name}</p>
                )}
              </div>
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="font-medium">{quote.totals.total_expected_hours}</span>
                <span className="text-gray-400">hrs</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <DollarSign className="h-4 w-4 text-gray-400" />
                <span className="font-medium">
                  {formatCurrency(quote.totals.total_cost, quote.totals.currency)}
                </span>
              </div>
            </div>

            {/* Platform and timestamp */}
            <div className="flex items-center gap-3 mt-3">
              {quote.platform && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {quote.platform}
                </span>
              )}
              <span className="text-xs text-gray-400">
                {formatRelativeTime(quote.created_at)}
              </span>
            </div>
          </div>

          {/* Right side - Status and action */}
          <div className="flex flex-col items-end gap-3">
            <Badge variant={getStatusBadgeVariant(quote.status)}>
              {getStatusLabel(quote.status)}
            </Badge>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Empty state when no quotes exist
 */
interface EmptyStateProps {
  onCreateQuote?: () => void;
}

function EmptyState({ onCreateQuote }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
        <FileText className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">No quotes yet</h3>
      <p className="text-sm text-gray-500 text-center max-w-sm mb-6">
        Generate your first quote to get started with this project
      </p>
      {onCreateQuote && (
        <Button onClick={onCreateQuote} leftIcon={<Plus className="h-4 w-4" />}>
          Generate Quote
        </Button>
      )}
    </div>
  );
}

/**
 * Loading skeleton
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 bg-gray-200 rounded-lg" />
                  <div>
                    <div className="h-5 w-32 bg-gray-200 rounded mb-1" />
                    <div className="h-4 w-24 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <div className="h-4 w-20 bg-gray-100 rounded" />
                  <div className="h-4 w-24 bg-gray-100 rounded" />
                </div>
              </div>
              <div className="h-6 w-20 bg-gray-200 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function QuoteList({
  quotes,
  projectId,
  isLoading = false,
  onQuoteClick,
  onCreateQuote,
  className,
}: QuoteListProps) {
  const navigate = useNavigate();

  const handleQuoteClick = (quoteId: string) => {
    if (onQuoteClick) {
      onQuoteClick(quoteId);
    } else {
      navigate(`/projects/${projectId}/quotes/${quoteId}`);
    }
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!quotes || quotes.length === 0) {
    return <EmptyState onCreateQuote={onCreateQuote} />;
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500">
          {quotes?.length || 0} {quotes?.length === 1 ? 'Quote' : 'Quotes'}
        </h3>
        {onCreateQuote && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateQuote}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            New Quote
          </Button>
        )}
      </div>

      {/* Quote list */}
      <div className="space-y-3">
        {quotes.map((quote) => (
          <QuoteCard
            key={quote.id}
            quote={quote}
            onClick={() => handleQuoteClick(quote.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default QuoteList;

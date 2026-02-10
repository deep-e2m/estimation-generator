import { useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuotesList } from '@/hooks/useQuotes';
import { cn, formatCurrency, debounce, getStatusColor } from '@/lib/utils';
import { formatSmartDate } from '@/lib/date';
import { TableSkeleton } from '@/components/common/Skeleton';
import { NoQuotes, NoSearchResults } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import type { QuoteFilters, QuoteStatus, Platform, QuoteSummary } from '@/types';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Plus,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  RefreshCw,
} from 'lucide-react';

const statusOptions: { value: QuoteStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'finalized', label: 'Finalized' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
];

const platformOptions: { value: Platform | ''; label: string }[] = [
  { value: '', label: 'All Platforms' },
  { value: 'wordpress', label: 'WordPress' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'woocommerce', label: 'WooCommerce' },
  { value: 'custom', label: 'Custom' },
];

const sortOptions = [
  { value: 'created_at:desc', label: 'Newest First' },
  { value: 'created_at:asc', label: 'Oldest First' },
  { value: 'quote_number:desc', label: 'Quote # (High to Low)' },
  { value: 'quote_number:asc', label: 'Quote # (Low to High)' },
  { value: 'total_hours:desc', label: 'Hours (High to Low)' },
  { value: 'total_hours:asc', label: 'Hours (Low to High)' },
];

/**
 * Quote History page with table view, search, filters, and pagination
 */
export function QuoteHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');

  // Parse filters from URL
  const filters: QuoteFilters = useMemo(() => {
    const sortParam = searchParams.get('sort') || 'created_at:desc';
    const [sort_by, sort_order] = sortParam.split(':') as [QuoteFilters['sort_by'], QuoteFilters['sort_order']];

    return {
      search: searchParams.get('search') || undefined,
      status: (searchParams.get('status') as QuoteStatus) || undefined,
      platform: (searchParams.get('platform') as Platform) || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      sort_by,
      sort_order,
    };
  }, [searchParams]);

  // Fetch quotes with infinite query
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useQuotesList(filters);

  // Flatten pages into single array
  const quotes = useMemo(() => {
    return data?.pages.flatMap((page) => page.data) || [];
  }, [data]);

  const totalCount = data?.pages[0]?.pagination.total_count || 0;

  // Update filters in URL
  const updateFilters = useCallback(
    (updates: Partial<QuoteFilters & { sort?: string }>) => {
      const newParams = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          newParams.set(key, value);
        } else {
          newParams.delete(key);
        }
      });

      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  // Debounced search
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        updateFilters({ search: value || undefined });
      }, 300),
    [updateFilters]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    debouncedSearch(value);
  };

  const clearFilters = () => {
    setSearchValue('');
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters =
    filters.search ||
    filters.status ||
    filters.platform ||
    filters.date_from ||
    filters.date_to;

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 rounded-full bg-red-100 p-3">
          <FileText className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">
          Failed to load quotes
        </h2>
        <p className="mb-6 max-w-md text-gray-500">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </p>
        <Button onClick={() => refetch()} leftIcon={<RefreshCw className="h-4 w-4" />}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quote History</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and manage all your project estimates
          </p>
        </div>
        <Link to="/quotes/new">
          <Button leftIcon={<Plus className="h-4 w-4" />}>New Quote</Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by quote number or client name..."
              value={searchValue}
              onChange={handleSearchChange}
              className="pl-10"
            />
            {searchValue && (
              <button
                onClick={() => {
                  setSearchValue('');
                  updateFilters({ search: undefined });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            leftIcon={<Filter className="h-4 w-4" />}
            rightIcon={
              showFilters ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )
            }
          >
            Filters
            {hasActiveFilters && (
              <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-xs text-white">
                !
              </span>
            )}
          </Button>

          {/* Sort Dropdown */}
          <Select
            value={`${filters.sort_by || 'created_at'}:${filters.sort_order || 'desc'}`}
            onChange={(e) => updateFilters({ sort: e.target.value })}
            className="w-full sm:w-48"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Status Filter */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Status
                </label>
                <Select
                  value={filters.status || ''}
                  onChange={(e) =>
                    updateFilters({ status: (e.target.value as QuoteStatus) || undefined })
                  }
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Platform Filter */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Platform
                </label>
                <Select
                  value={filters.platform || ''}
                  onChange={(e) =>
                    updateFilters({ platform: (e.target.value as Platform) || undefined })
                  }
                >
                  {platformOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Date From */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  From Date
                </label>
                <Input
                  type="date"
                  value={filters.date_from || ''}
                  onChange={(e) =>
                    updateFilters({ date_from: e.target.value || undefined })
                  }
                />
              </div>

              {/* Date To */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  To Date
                </label>
                <Input
                  type="date"
                  value={filters.date_to || ''}
                  onChange={(e) =>
                    updateFilters({ date_to: e.target.value || undefined })
                  }
                />
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results Count */}
      {!isLoading && (
        <p className="text-sm text-gray-500">
          Showing {quotes.length} of {totalCount} quotes
        </p>
      )}

      {/* Loading State */}
      {isLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : quotes.length === 0 ? (
        // Empty States
        hasActiveFilters ? (
          <NoSearchResults query={searchValue || 'filtered'} onClear={clearFilters} />
        ) : (
          <NoQuotes onCreateQuote={() => window.location.href = '/quotes/new'} />
        )
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white lg:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Quote #
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Client / Project
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Platform
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Hours
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Created
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {quotes.map((quote) => (
                  <QuoteTableRow key={quote.id} quote={quote} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-3 lg:hidden">
            {quotes.map((quote) => (
              <QuoteMobileCard key={quote.id} quote={quote} />
            ))}
          </div>

          {/* Load More Button */}
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                isLoading={isFetchingNextPage}
              >
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Table row component for desktop view
 */
function QuoteTableRow({ quote }: { quote: QuoteSummary }) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="whitespace-nowrap px-4 py-4">
        <Link
          to={`/projects/${quote.project?.id}/quotes/${quote.id}`}
          className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
        >
          {quote.quote_number}
        </Link>
        {quote.version > 1 && (
          <span className="ml-2 text-xs text-gray-500">v{quote.version}</span>
        )}
      </td>
      <td className="px-4 py-4">
        <div className="max-w-xs">
          <p className="truncate font-medium text-gray-900">
            {quote.client_name || 'No client'}
          </p>
          <p className="truncate text-sm text-gray-500">
            {quote.project?.name || 'No project'}
          </p>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-4">
        {quote.platform ? (
          <Badge variant="secondary">{quote.platform}</Badge>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-4">
        <p className="font-medium text-gray-900">
          {quote.totals.total_expected_hours} hrs
        </p>
        <p className="text-sm text-gray-500">
          {formatCurrency(quote.totals.total_cost, quote.totals.currency)}
        </p>
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">
        {formatSmartDate(quote.created_at)}
      </td>
      <td className="whitespace-nowrap px-4 py-4">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
            getStatusColor(quote.status)
          )}
        >
          {quote.status}
        </span>
      </td>
    </tr>
  );
}

/**
 * Card component for mobile view
 */
function QuoteMobileCard({ quote }: { quote: QuoteSummary }) {
  return (
    <Link
      to={`/projects/${quote.project?.id}/quotes/${quote.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-primary-600">{quote.quote_number}</p>
          <p className="mt-1 font-medium text-gray-900">
            {quote.client_name || 'No client'}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
            getStatusColor(quote.status)
          )}
        >
          {quote.status}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
        {quote.platform && (
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            {quote.platform}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {formatSmartDate(quote.created_at)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <div>
          <p className="text-lg font-semibold text-gray-900">
            {quote.totals.total_expected_hours} hrs
          </p>
          <p className="text-sm text-gray-500">
            {formatCurrency(quote.totals.total_cost, quote.totals.currency)}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>
    </Link>
  );
}

export default QuoteHistory;

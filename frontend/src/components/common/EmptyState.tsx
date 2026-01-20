import { cn } from '@/lib/utils';
import { FileText, Search, FolderOpen, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Empty state component for displaying when there's no content
 */
export function EmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-16 text-center',
        className
      )}
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
      {description && (
        <p className="mb-8 max-w-sm text-sm text-gray-500 leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * Empty state for no search results
 */
export function NoSearchResults({
  query,
  onClear,
}: {
  query: string;
  onClear?: () => void;
}) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={`We couldn't find any quotes matching "${query}". Try adjusting your search or filters.`}
      action={
        onClear
          ? {
              label: 'Clear search',
              onClick: onClear,
            }
          : undefined
      }
    />
  );
}

/**
 * Empty state for no quotes
 */
export function NoQuotes({ onCreateQuote }: { onCreateQuote?: () => void }) {
  return (
    <EmptyState
      icon={FileText}
      title="No quotes yet"
      description="Get started by creating your first quote. Our AI will help you generate accurate project estimates."
      action={
        onCreateQuote
          ? {
              label: 'Create your first quote',
              onClick: onCreateQuote,
            }
          : undefined
      }
    />
  );
}

export default EmptyState;

import { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuote, useQuoteVersions, useDeleteQuote, useExportQuote, useExportStatus } from '@/hooks/useQuotes';
import { cn, formatCurrency, getStatusColor, downloadUrl } from '@/lib/utils';
import { formatDate, formatSmartDate } from '@/lib/date';
import { Skeleton, SkeletonCard } from '@/components/common/Skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';
import type { Quote, QuoteVersion, ExportFormat } from '@/types';
import {
  ArrowLeft,
  Edit,
  FileText,
  Download,
  Trash2,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  History,
  FileDown,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Quote Detail page showing full quote information with edit, export, and version history
 */
export function QuoteDetail() {
  const { projectId, quoteId } = useParams<{ projectId: string; quoteId: string }>();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [activeExportId, setActiveExportId] = useState<string | null>(null);

  // Fetch quote data
  const {
    data: quote,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuote(projectId || '', quoteId || '');

  // Fetch versions
  const { data: versions, isLoading: versionsLoading } = useQuoteVersions(
    projectId || '',
    quoteId || ''
  );

  // Mutations
  const deleteQuote = useDeleteQuote();
  const exportQuote = useExportQuote();

  // Export status polling
  const { data: exportStatus } = useExportStatus(activeExportId);

  // Handle export completion
  if (exportStatus?.status === 'completed' && activeExportId) {
    if (exportStatus.download_url) {
      downloadUrl(exportStatus.download_url, `${quote?.quote_number}.${exportStatus.format}`);
      toast.success('Export ready', { description: 'Your download should start automatically' });
    }
    setActiveExportId(null);
  }

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!projectId || !quoteId) return;

      try {
        const result = await exportQuote.mutateAsync({
          projectId,
          quoteId,
          format,
        });
        setActiveExportId(result.export_job_id);
      } catch {
        // Error handled by mutation
      }
    },
    [projectId, quoteId, exportQuote]
  );

  const handleDelete = useCallback(async () => {
    if (!projectId || !quoteId) return;

    try {
      await deleteQuote.mutateAsync({ projectId, quoteId });
      navigate('/quotes');
    } catch {
      // Error handled by mutation
    }
    setShowDeleteDialog(false);
  }, [projectId, quoteId, deleteQuote, navigate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Skeleton className="h-8 w-64" />
        </div>
      </div>
    );
  }

  // Error state
  if (isError || !quote) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-gray-200 bg-white p-12 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Failed to load quote</h2>
            <p className="mt-1 text-sm text-gray-500">
              {error instanceof Error ? error.message : 'Quote not found'}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button and Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="mt-1 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {quote.quote_number}
              </h1>
              {quote.version > 1 && (
                <Badge variant="secondary">v{quote.version}</Badge>
              )}
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                  getStatusColor(quote.status)
                )}
              >
                {quote.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {quote.project.name}
              {quote.requirements?.text && ` - ${quote.requirements.text.slice(0, 60)}...`}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Created {formatSmartDate(quote.created_at)} by {quote.created_by.full_name}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pl-12 lg:pl-0">
          <Button
            variant="outline"
            onClick={() => setShowVersions(!showVersions)}
            leftIcon={<History className="h-4 w-4" />}
          >
            {showVersions ? 'Hide' : 'Show'} Versions
          </Button>
          <Link to={`/projects/${projectId}/quotes/${quoteId}/edit`}>
            <Button variant="outline" leftIcon={<Edit className="h-4 w-4" />}>
              Edit
            </Button>
          </Link>

          {/* Export Dropdown */}
          <div className="relative group">
            <Button
              variant="outline"
              leftIcon={
                activeExportId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )
              }
              disabled={!!activeExportId}
            >
              Export
            </Button>
            <div className="absolute right-0 top-full z-10 mt-1 hidden w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg group-hover:block">
              <button
                onClick={() => handleExport('pdf')}
                disabled={!!activeExportId}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                <FileDown className="h-4 w-4" />
                Export as PDF
              </button>
              <button
                onClick={() => handleExport('docx')}
                disabled={!!activeExportId}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                Export as DOCX
              </button>
            </div>
          </div>

          <Button
            variant="danger"
            leftIcon={<Trash2 className="h-4 w-4" />}
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className={cn('space-y-6', showVersions ? 'lg:col-span-2' : 'lg:col-span-3')}>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Total Hours"
              value={`${quote.content.totals.total_expected_hours}`}
              subValue={`${quote.content.totals.total_optimistic_hours}-${quote.content.totals.total_pessimistic_hours} range`}
              icon={Clock}
            />
            <StatCard
              label="Total Cost"
              value={formatCurrency(
                quote.content.totals.total_cost,
                quote.content.totals.currency
              )}
              subValue={`@ ${formatCurrency(
                quote.content.totals.hourly_rate,
                quote.content.totals.currency
              )}/hr`}
              icon={DollarSign}
            />
            <StatCard
              label="Deliverables"
              value={String(quote.content.deliverables.length)}
              subValue="Line items"
              icon={CheckCircle}
            />
            <StatCard
              label="Risks"
              value={String(quote.content.risks.length)}
              subValue="Identified"
              icon={AlertTriangle}
            />
          </div>

          {/* Executive Summary */}
          <Section title="Executive Summary">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {quote.content.executive_summary}
            </p>
          </Section>

          {/* Scope */}
          <Section title="Scope">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-3 text-sm font-semibold text-gray-900">Included</h4>
                <ul className="space-y-2">
                  {quote.content.scope.included.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-3 text-sm font-semibold text-gray-900">Excluded</h4>
                <ul className="space-y-2">
                  {quote.content.scope.excluded.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                      <span className="mt-0.5 h-4 w-4 shrink-0 text-center text-gray-400">
                        -
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>

          {/* Deliverables Table */}
          <Section title="Deliverables">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Deliverable
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      Optimistic
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      Most Likely
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      Pessimistic
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Expected
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {quote.content.deliverables.map((deliverable) => (
                    <tr key={deliverable.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <p className="font-medium text-gray-900">{deliverable.name}</p>
                        <p className="text-sm text-gray-500">{deliverable.description}</p>
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-500">
                        {deliverable.estimate.optimistic_hours} hrs
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-500">
                        {deliverable.estimate.most_likely_hours} hrs
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-500">
                        {deliverable.estimate.pessimistic_hours} hrs
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-gray-900">
                        {deliverable.estimate.expected_hours} hrs
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-4 text-gray-900">Total</td>
                    <td className="px-4 py-4 text-center text-gray-700">
                      {quote.content.totals.total_optimistic_hours} hrs
                    </td>
                    <td className="px-4 py-4 text-center text-gray-700">
                      {quote.content.totals.total_most_likely_hours} hrs
                    </td>
                    <td className="px-4 py-4 text-center text-gray-700">
                      {quote.content.totals.total_pessimistic_hours} hrs
                    </td>
                    <td className="px-4 py-4 text-right text-gray-900">
                      {quote.content.totals.total_expected_hours} hrs
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Assumptions */}
          <Section title="Assumptions">
            <ul className="space-y-2">
              {quote.content.assumptions.map((assumption, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                  {assumption}
                </li>
              ))}
            </ul>
          </Section>

          {/* Risks */}
          {quote.content.risks.length > 0 && (
            <Section title="Risks">
              <div className="space-y-3">
                {quote.content.risks.map((risk, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-lg border p-4',
                      risk.impact === 'high'
                        ? 'border-red-200 bg-red-50'
                        : risk.impact === 'medium'
                        ? 'border-yellow-200 bg-yellow-50'
                        : 'border-gray-200 bg-gray-50'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <p className="font-medium text-gray-900">{risk.description}</p>
                      <Badge
                        variant={
                          risk.impact === 'high'
                            ? 'error'
                            : risk.impact === 'medium'
                            ? 'warning'
                            : 'secondary'
                        }
                      >
                        {risk.impact} impact
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      <strong>Mitigation:</strong> {risk.mitigation}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Timeline */}
          {quote.content.timeline && (
            <Section title="Timeline">
              <div className="flex items-center gap-4 text-sm text-gray-700">
                <p>
                  <strong>Start:</strong> {formatDate(quote.content.timeline.estimated_start)}
                </p>
                <ChevronRight className="h-4 w-4 text-gray-400" />
                <p>
                  <strong>End:</strong> {formatDate(quote.content.timeline.estimated_end)}
                </p>
              </div>
              {quote.content.timeline.milestones.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-semibold text-gray-900">Milestones</h4>
                  <div className="space-y-2">
                    {quote.content.timeline.milestones.map((milestone, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2"
                      >
                        <span className="text-sm text-gray-700">{milestone.name}</span>
                        <span className="text-sm text-gray-500">
                          {formatDate(milestone.target_date)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Feedback Widget */}
          <Section title="Was this estimate helpful?">
            <FeedbackWidget
              projectId={projectId || ''}
              quoteId={quoteId || ''}
            />
          </Section>
        </div>

        {/* Version History Sidebar */}
        {showVersions && (
          <div className="lg:col-span-1">
            <div className="sticky top-4 rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-4 font-semibold text-gray-900">Version History</h3>
              {versionsLoading ? (
                <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
              ) : versions && versions.length > 0 ? (
                <div className="space-y-3">
                  {versions.map((version) => (
                    <VersionItem
                      key={version.id}
                      version={version}
                      isActive={version.id === quoteId}
                      projectId={projectId || ''}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No previous versions</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => setShowDeleteDialog(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Quote</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {quote.quote_number}? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={deleteQuote.isPending}
            >
              Delete Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Stat card component
 */
function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-gray-500">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      {subValue && <p className="text-sm text-gray-500">{subValue}</p>}
    </div>
  );
}

/**
 * Section wrapper component
 */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>
      {children}
    </div>
  );
}

/**
 * Version history item
 */
function VersionItem({
  version,
  isActive,
  projectId,
}: {
  version: QuoteVersion;
  isActive: boolean;
  projectId: string;
}) {
  return (
    <Link
      to={`/projects/${projectId}/quotes/${version.id}`}
      className={cn(
        'block rounded-lg border p-3 transition-colors',
        isActive
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-900">
          Version {version.version}
        </span>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
            getStatusColor(version.status)
          )}
        >
          {version.status}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {formatSmartDate(version.created_at)}
      </p>
      {version.version_note && (
        <p className="mt-1 text-xs text-gray-600 line-clamp-2">
          {version.version_note}
        </p>
      )}
      <p className="mt-2 text-sm font-medium text-gray-700">
        {version.totals.total_expected_hours} hrs
      </p>
    </Link>
  );
}

export default QuoteDetail;

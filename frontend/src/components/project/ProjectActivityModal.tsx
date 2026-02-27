import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { projectsService } from '@/services/projects.service';
import type { AuditLogEntry } from '@/services/audit-logs.service';
import { getActionLabel } from '@/constants/actionLabels';

const PER_PAGE = 25;

interface ProjectActivityModalProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onClose: () => void;
}

export function ProjectActivityModal({
  projectId,
  projectName,
  open,
  onClose,
}: ProjectActivityModalProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    if (!open || !projectId) return;
    setPage(1);
    loadActivity(1);
  }, [open, projectId]);

  useEffect(() => {
    if (!open || !projectId) return;
    loadActivity(page);
  }, [page]);

  async function loadActivity(p: number) {
    try {
      setLoading(true);
      setError(null);
      const response = await projectsService.getProjectActivity(projectId, {
        page: p,
        per_page: PER_PAGE,
      });
      if (response.success) {
        setEntries(response.data);
        setTotalPages(response.pagination.total_pages);
        setTotalItems(response.pagination.total_items);
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
              ?.message
          : 'Failed to load activity';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  function formatTimestamp(ts: string) {
    return format(new Date(ts), 'MMM d, yyyy HH:mm');
  }

  function outcomeClass(outcome: string) {
    return outcome === 'success'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        className="relative z-10 w-full max-w-3xl max-h-[85vh] flex flex-col rounded-lg border bg-card shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-activity-title"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id="project-activity-title" className="text-lg font-semibold">
            Activity: {projectName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {error && (
            <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          {loading && entries.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Loading activity...</div>
          ) : entries.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No activity for this project yet.</div>
          ) : (
            <ul className="space-y-3">
              {entries.map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm"
                >
                  <span className="text-muted-foreground shrink-0">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${outcomeClass(
                      log.outcome
                    )}`}
                  >
                    {log.outcome}
                  </span>
                  <span className="font-medium">{getActionLabel(log.action)}</span>
                  <span className="text-muted-foreground">
                    — {log.actor_name || log.actor_email || 'Unknown'}
                    {log.actor_email && log.actor_name !== log.actor_email && ` (${log.actor_email})`}
                  </span>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <span className="w-full text-xs text-muted-foreground mt-1">
                      {JSON.stringify(log.metadata)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-2">
            <span className="text-sm text-muted-foreground">
              {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, totalItems)} of {totalItems}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded border hover:bg-accent disabled:opacity-50"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded border hover:bg-accent disabled:opacity-50"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

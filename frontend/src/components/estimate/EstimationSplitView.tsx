/**
 * EstimationSplitView Component
 * 2-column interface with tabs and resizable divider
 *
 * Features:
 * - Resizable split view with drag handle
 * - Tab navigation (Estimate, Chat, History, Export)
 * - Mobile-responsive with tab switching
 * - Quote history/versioning
 * - Validation warnings
 * - Export preview
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  MessageSquare, 
  History, 
  Download,
  GripVertical,
  Sparkles,
  Eye,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Project, Quote } from '@/types';
import type { ChangeDescription, RefinedProjectUpdate } from '@/types/quote.types';
import { quoteService } from '@/services/quote-generation.service';
import { quotesRealtimeService } from '@/services/quotes-realtime.service';
import { ensureValidAccessToken } from '@/store/authStore';
import { EstimationChatPanel } from './EstimationChatPanel';
import { EstimationPreviewPanel } from './EstimationPreviewPanel';
import { QuoteDocument } from './preview/QuoteDocument';

type TabType = 'estimate' | 'chat' | 'history' | 'export';
type MobileViewType = 'chat' | 'preview';

interface EstimationSplitViewProps {
  project: Project;
  initialQuote: Quote;
  onQuoteUpdated?: (
    quote: Quote,
    changes?: ChangeDescription[],
    updatedProject?: RefinedProjectUpdate | null
  ) => void;
}

export function EstimationSplitView({
  project,
  initialQuote,
  onQuoteUpdated,
}: EstimationSplitViewProps) {
  const navigate = useNavigate();
  const [currentQuote, setCurrentQuote] = useState<Quote>(initialQuote);
  const [recentChanges, setRecentChanges] = useState<ChangeDescription[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('estimate');
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'docx' | null>(null);
  const [mobileView, setMobileView] = useState<MobileViewType>('chat');
  const [splitRatio, setSplitRatio] = useState(35); // Chat 35%, rest to preview
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const quoteWsRef = useRef<WebSocket | null>(null);

  const handleQuoteUpdate = useCallback(
    (
      updatedQuote: Quote,
      changes: ChangeDescription[],
      updatedProject?: RefinedProjectUpdate | null
    ) => {
      setCurrentQuote(updatedQuote);
      setRecentChanges(changes);

      // Clear recent changes highlight after animation
      setTimeout(() => {
        setRecentChanges([]);
      }, 2500);

      // Notify parent (so header can update total hours and project name/description)
      if (onQuoteUpdated) {
        onQuoteUpdated(updatedQuote, changes, updatedProject);
      }
    },
    [onQuoteUpdated]
  );

  // Handle quote saved from the inline editor (no change descriptions)
  const handleQuoteSaved = useCallback(
    (updatedQuote: Quote) => {
      // Preserve project name even if the update payload does not include it.
      const existingProject = currentQuote?.project as { id?: string; name?: string } | undefined;
      const updatedProject = updatedQuote.project as { id?: string; name?: string } | undefined;

      const mergedProjectName =
        updatedProject?.name ||
        (updatedQuote as Quote & { project_name?: string }).project_name ||
        existingProject?.name ||
        project.name;

      const mergedProject =
        updatedProject || existingProject
          ? {
              ...(existingProject || {}),
              ...(updatedProject || {}),
              id: updatedProject?.id ?? existingProject?.id ?? project.id,
              name: mergedProjectName,
            }
          : { id: project.id, name: mergedProjectName };

      const mergedQuote: Quote = {
        ...currentQuote,
        ...updatedQuote,
        project: mergedProject as Quote['project'],
      };

      setCurrentQuote(mergedQuote);
      if (onQuoteUpdated) {
        onQuoteUpdated(mergedQuote, [], undefined);
      }
    },
    [currentQuote, onQuoteUpdated, project.id, project.name]
  );

  // Handle responsive layout
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Subscribe to realtime quote updates (multi-tab / multi-user)
  useEffect(() => {
    if (!currentQuote?.id) return;

    let cancelled = false;

    const setupWebSocket = async () => {
      // Ensure we have a fresh, non-expired access token before opening the WebSocket.
      const token = await ensureValidAccessToken();
      if (!token || cancelled) {
        return;
      }

      // Close any existing connection before opening a new one
      if (quoteWsRef.current) {
        try {
          if (
            quoteWsRef.current.readyState === WebSocket.OPEN ||
            quoteWsRef.current.readyState === WebSocket.CLOSING
          ) {
            quoteWsRef.current.close();
          }
        } catch {
          // Ignore errors during cleanup
        }
        quoteWsRef.current = null;
      }

      const ws = quotesRealtimeService.connect(currentQuote.id, {
        onSync: (quote) => {
          // Initial snapshot when a new subscriber connects
          handleQuoteSaved(quote);
        },
        onQuoteUpdated: (quote) => {
          // Another tab/user edited the quote
          handleQuoteSaved(quote);
        },
        onStatusChanged: (quote) => {
          handleQuoteSaved(quote);
        },
        onDeleted: (quoteId) => {
          if (quoteId === currentQuote.id) {
            toast.info('This estimate was deleted in another session.');
            // Navigate back to project detail if possible
            navigate(`/projects/${project.id}`);
          }
        },
        onError: (error) => {
          console.error('Quote realtime error:', error);
        },
      });

      quoteWsRef.current = ws;
    };

    void setupWebSocket();

    return () => {
      cancelled = true;
      if (quoteWsRef.current) {
        try {
          if (
            quoteWsRef.current.readyState === WebSocket.OPEN ||
            quoteWsRef.current.readyState === WebSocket.CLOSING
          ) {
            quoteWsRef.current.close();
          }
        } catch {
          // Ignore errors during cleanup
        } finally {
          quoteWsRef.current = null;
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuote?.id, project.id, navigate, handleQuoteSaved]);

  // Direct export (PDF or DOCX) via backend; triggers download
  const handleExportDirect = useCallback(
    async (format: 'pdf' | 'docx') => {
      if (!project?.id || !currentQuote?.id) return;
      setExportingFormat(format);
      try {
        const blob = await quoteService.exportQuote(project.id, currentQuote.id, format);
        const quoteNumber =
          currentQuote.quote_number || `EST-${String(currentQuote.id).slice(0, 8).toUpperCase()}`;
        const name = (currentQuote.project as { name?: string })?.name || project.name || 'estimate';
        const safeName = name.replace(/[^a-zA-Z0-9]/g, '-');
        quoteService.triggerDownload(blob, `${quoteNumber}-${safeName}.${format}`);
        toast.success(`${format.toUpperCase()} export downloaded`);
      } catch (error) {
        toast.error(`Failed to export as ${format.toUpperCase()}`, {
          description: error instanceof Error ? error.message : 'Please try again.',
        });
      } finally {
        setExportingFormat(null);
      }
    },
    [project?.id, project?.name, currentQuote?.id, currentQuote?.quote_number, currentQuote?.project]
  );

  // Handle resize drag
  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const newRatio = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Constrain between 25% and 65%
      setSplitRatio(Math.min(Math.max(newRatio, 25), 65));
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className={cn('estimation-split-container-wrapper', isMobile && 'mobile')}>
      {/* Desktop Tab Navigation */}
      {!isMobile && (
        <div className="estimation-tabs">
          <div className="estimation-tabs-list">
            <button
              className={cn('estimation-tab', activeTab === 'estimate' && 'active')}
              onClick={() => setActiveTab('estimate')}
            >
              <FileText className="h-4 w-4" />
              <span>Estimate</span>
            </button>
            <button
              className={cn('estimation-tab', activeTab === 'chat' && 'active')}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Chat</span>
            </button>
            <button
              className={cn('estimation-tab', activeTab === 'history' && 'active')}
              onClick={() => setActiveTab('history')}
            >
              <History className="h-4 w-4" />
              <span>History</span>
            </button>
            <button
              className={cn('estimation-tab', activeTab === 'export' && 'active')}
              onClick={() => setActiveTab('export')}
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      {isMobile && (
        <div className="estimation-mobile-tabs">
          <motion.button
            className={cn('estimation-mobile-tab', mobileView === 'chat' && 'active')}
            onClick={() => setMobileView('chat')}
            whileTap={{ scale: 0.98 }}
          >
            <Sparkles className="h-4 w-4" />
            <span>Refine</span>
          </motion.button>
          <motion.button
            className={cn('estimation-mobile-tab', mobileView === 'preview' && 'active')}
            onClick={() => setMobileView('preview')}
            whileTap={{ scale: 0.98 }}
          >
            <Eye className="h-4 w-4" />
            <span>Preview</span>
          </motion.button>
        </div>
      )}

      {/* Split View Container */}
      <div ref={containerRef} className={cn('estimation-split-container', isMobile && 'mobile')}>
        {/* Desktop: Show both panels with resizer */}
        {!isMobile ? (
          <>
            {/* Left Panel: Chat Interface */}
            <div
              className="estimation-panel-chat"
              style={{ width: `${splitRatio}%` }}
            >
              <EstimationChatPanel
                project={project}
                quote={currentQuote}
                onQuoteUpdated={handleQuoteUpdate}
              />
            </div>

            {/* Resize Handle */}
            <div
              className={cn('estimation-resize-handle', isDragging && 'dragging')}
              onMouseDown={handleMouseDown}
            >
              <GripVertical className="h-4 w-4" />
            </div>

            {/* Right Panel: Content based on active tab */}
            <div
              className="estimation-panel-preview"
              style={{ width: `${100 - splitRatio}%` }}
            >
          {activeTab === 'estimate' && (
            <div className="estimation-panel-preview-wrap">
              <div className="estimation-panel-preview-inner">
                <EstimationPreviewPanel
                  quote={currentQuote}
                  project={project}
                  recentChanges={recentChanges}
                  onQuoteSaved={handleQuoteSaved}
                />
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="estimation-tab-content">
              <div className="estimation-tab-empty">
                <MessageSquare className="h-12 w-12 text-gray-300" />
                <h3>Chat View</h3>
                <p>Chat interface is shown in the left panel. Use it to refine your estimate.</p>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="estimation-tab-content">
              <div className="estimation-history-header">
                <h3>Quote History</h3>
                <p className="text-sm text-gray-500">Track changes and restore previous versions</p>
              </div>
              <div className="estimation-history-list">
                <div className="estimation-history-item current">
                  <div className="estimation-history-item-header">
                    <div>
                      <h4>Version 1 (Current)</h4>
                      <p className="text-sm text-gray-500">
                        {new Date(currentQuote.updated_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="estimation-history-badge current">Current</span>
                  </div>
                  <ul className="estimation-history-changes">
                    <li>Initial AI generation</li>
                    <li>Total hours: {currentQuote.total_hours ?? 0}h</li>
                  </ul>
                </div>
                <div className="estimation-history-empty">
                  <History className="h-8 w-8 text-gray-300" />
                  <p className="text-sm text-gray-500">
                    Future versions will appear here as you make changes
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="estimation-tab-content">
              <div className="estimation-export-header">
                <h3>Export Options</h3>
                <p className="text-sm text-gray-500">Download your estimate in supported formats</p>
              </div>
              <div className="estimation-export-options">
                <button
                  type="button"
                  className="estimation-export-option"
                  onClick={() => handleExportDirect('pdf')}
                  disabled={exportingFormat !== null}
                >
                  <div className="estimation-export-icon pdf">
                    {exportingFormat === 'pdf' ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <FileText className="h-6 w-6" />
                    )}
                  </div>
                  <div className="estimation-export-info">
                    <h4>Export as PDF</h4>
                    <p>Professional PDF document for sharing</p>
                  </div>
                  <Download className="h-5 w-5 text-gray-400" />
                </button>

                <button
                  type="button"
                  className="estimation-export-option"
                  onClick={() => handleExportDirect('docx')}
                  disabled={exportingFormat !== null}
                >
                  <div className="estimation-export-icon docx">
                    {exportingFormat === 'docx' ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <FileText className="h-6 w-6" />
                    )}
                  </div>
                  <div className="estimation-export-info">
                    <h4>Export as DOCX</h4>
                    <p>Editable Microsoft Word document</p>
                  </div>
                  <Download className="h-5 w-5 text-gray-400" />
                </button>

                <button
                  type="button"
                  className="estimation-export-option"
                  onClick={() => {
                    const data = JSON.stringify(currentQuote, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `estimate-${currentQuote.id}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <div className="estimation-export-icon json">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="estimation-export-info">
                    <h4>Export as JSON</h4>
                    <p>Raw data for integration or backup</p>
                  </div>
                  <Download className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              <div className="estimation-export-preview">
                <h4>Preview</h4>
                <div className="estimation-export-preview-content">
                  <QuoteDocument quote={currentQuote} />
                </div>
              </div>
            </div>
          )}
            </div>
          </>
        ) : (
          /* Mobile: Single panel with animated transitions */
          <AnimatePresence mode="wait">
            {mobileView === 'chat' ? (
              <motion.div
                key="mobile-chat"
                className="estimation-mobile-panel"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <EstimationChatPanel
                  project={project}
                  quote={currentQuote}
                  onQuoteUpdated={handleQuoteUpdate}
                />
              </motion.div>
            ) : (
              <motion.div
                key="mobile-preview"
                className="estimation-mobile-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <EstimationPreviewPanel
                  quote={currentQuote}
                  project={project}
                  recentChanges={recentChanges}
                  onQuoteSaved={handleQuoteSaved}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

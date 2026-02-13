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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Project, Quote } from '@/types';
import type { ChangeDescription } from '@/types/quote.types';
import { EstimationChatPanel } from './EstimationChatPanel';
import { EstimationPreviewPanel } from './EstimationPreviewPanel';

type TabType = 'estimate' | 'chat' | 'history' | 'export';
type MobileViewType = 'chat' | 'preview';

interface StatCardData {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  iconClass: string;
}

interface EstimationSplitViewProps {
  project: Project;
  initialQuote: Quote;
  onQuoteUpdated?: (quote: Quote) => void;
  statCards?: StatCardData[];
}

export function EstimationSplitView({
  project,
  initialQuote,
  onQuoteUpdated,
  statCards,
}: EstimationSplitViewProps) {
  const navigate = useNavigate();
  const [currentQuote, setCurrentQuote] = useState<Quote>(initialQuote);
  const [recentChanges, setRecentChanges] = useState<ChangeDescription[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('estimate');
  const [mobileView, setMobileView] = useState<MobileViewType>('chat');
  const [splitRatio, setSplitRatio] = useState(35); // Chat 35%, rest to preview
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle responsive layout
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleQuoteUpdate = useCallback(
    (updatedQuote: Quote, changes: ChangeDescription[]) => {
      setCurrentQuote(updatedQuote);
      setRecentChanges(changes);

      // Clear recent changes highlight after animation
      setTimeout(() => {
        setRecentChanges([]);
      }, 2500);

      // Notify parent
      if (onQuoteUpdated) {
        onQuoteUpdated(updatedQuote);
      }
    },
    [onQuoteUpdated]
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
              {/* Stat Cards above preview */}
              {statCards && statCards.length > 0 && (
                <div className="estimation-stat-cards">
                  {statCards.map((card, index) => (
                    <div key={index} className={`estimation-stat-card ${card.iconClass}`}>
                      <div className="estimation-stat-content">
                        <span className="estimation-stat-label">{card.label}</span>
                        <span className="estimation-stat-value">{card.value}</span>
                        {card.subtext && (
                          <span className="estimation-stat-subtext">{card.subtext}</span>
                        )}
                      </div>
                      <div className={`estimation-stat-icon ${card.iconClass}`}>
                        {card.icon}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="estimation-panel-preview-inner">
                <EstimationPreviewPanel
                  quote={currentQuote}
                  recentChanges={recentChanges}
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
                <p className="text-sm text-gray-500">Download your estimate in various formats</p>
              </div>
              <div className="estimation-export-options">
                <button
                  className="estimation-export-option"
                  onClick={() => navigate(`/projects/${project.id}/quotes/${currentQuote.id}/export?format=pdf`)}
                >
                  <div className="estimation-export-icon pdf">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="estimation-export-info">
                    <h4>Export as PDF</h4>
                    <p>Professional PDF document with branding</p>
                  </div>
                  <Download className="h-5 w-5 text-gray-400" />
                </button>

                <button
                  className="estimation-export-option"
                  onClick={() => navigate(`/projects/${project.id}/quotes/${currentQuote.id}/export?format=docx`)}
                >
                  <div className="estimation-export-icon docx">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="estimation-export-info">
                    <h4>Export as DOCX</h4>
                    <p>Editable Microsoft Word document</p>
                  </div>
                  <Download className="h-5 w-5 text-gray-400" />
                </button>

                <button
                  className="estimation-export-option"
                  onClick={() => {
                    const data = JSON.stringify(currentQuote, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `estimate-${currentQuote.id}.json`;
                    a.click();
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
                  <div className="estimation-export-preview-document">
                    <div className="estimation-export-preview-header">
                      <h1>{project.name}</h1>
                      <p>Project Estimate</p>
                    </div>
                    <div className="estimation-export-preview-body">
                      <div className="estimation-export-preview-section">
                        <h3>Executive Summary</h3>
                        <p>{currentQuote.content?.executive_summary || 'No summary available'}</p>
                      </div>
                      <div className="estimation-export-preview-section">
                        <h3>Total Estimate</h3>
                        <p className="text-2xl font-bold text-primary-600">
                          {currentQuote.total_hours ?? 0} hours
                        </p>
                      </div>
                    </div>
                  </div>
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
                  recentChanges={recentChanges}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

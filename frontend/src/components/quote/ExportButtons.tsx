/**
 * ExportButtons Component
 * PDF and DOCX export functionality with:
 * - Loading states during generation
 * - Download handling with proper filenames
 * - Error handling and retry options
 */

import React, { useState, useCallback } from 'react';
import {
  FileText,
  Download,
  Loader2,
  Check,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { quoteService } from '@/services';
import type { Quote, ExportOptions } from '../../types/quote.types';

interface ExportButtonsProps {
  quote: Quote;
  projectId: string;
  variant?: 'default' | 'compact';
  className?: string;
}

type ExportFormat = 'pdf' | 'docx';

interface ExportState {
  format: ExportFormat | null;
  status: 'idle' | 'exporting' | 'downloading' | 'success' | 'error';
  progress: number;
  error: string | null;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({
  quote,
  projectId,
  variant = 'default',
  className,
}) => {
  const [exportState, setExportState] = useState<ExportState>({
    format: null,
    status: 'idle',
    progress: 0,
    error: null,
  });
  const [showDropdown, setShowDropdown] = useState(false);

  /**
   * Handle export to specified format
   */
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setShowDropdown(false);
      setExportState({
        format,
        status: 'exporting',
        progress: 0,
        error: null,
      });

      try {
        const blob = await quoteService.exportQuote(projectId, quote.id, format);

        const projectName = quote.project.name.replace(/[^a-zA-Z0-9]/g, '-');
        const filename = `${quote.quote_number}-${projectName}.${format}`;

        quoteService.triggerDownload(blob, filename);

        // Success state
        setExportState({
          format: null,
          status: 'success',
          progress: 100,
          error: null,
        });

        // Reset after 3 seconds
        setTimeout(() => {
          setExportState({
            format: null,
            status: 'idle',
            progress: 0,
            error: null,
          });
        }, 3000);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Export failed';
        setExportState({
          format,
          status: 'error',
          progress: 0,
          error: errorMessage,
        });
      }
    },
    [projectId, quote]
  );

  /**
   * Retry failed export
   */
  const handleRetry = useCallback(() => {
    if (exportState.format) {
      handleExport(exportState.format);
    }
  }, [exportState.format, handleExport]);

  /**
   * Reset error state
   */
  const handleDismissError = useCallback(() => {
    setExportState({
      format: null,
      status: 'idle',
      progress: 0,
      error: null,
    });
  }, []);

  const isExporting =
    exportState.status === 'exporting' || exportState.status === 'downloading';

  // Compact variant - dropdown menu
  if (variant === 'compact') {
    return (
      <div className={cn('relative inline-block', className)}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={isExporting}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
            isExporting
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          )}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : exportState.status === 'success' ? (
            <>
              <Check className="h-4 w-4 text-green-600" />
              Downloaded
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>

        {/* Dropdown Menu */}
        {showDropdown && !isExporting && (
          <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
            <button
              onClick={() => handleExport('pdf')}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
            >
              <FileText className="h-4 w-4 text-red-500" />
              Export as PDF
            </button>
            <button
              onClick={() => handleExport('docx')}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg"
            >
              <FileText className="h-4 w-4 text-blue-500" />
              Export as DOCX
            </button>
          </div>
        )}

        {/* Error State */}
        {exportState.status === 'error' && (
          <div className="absolute right-0 mt-1 w-64 bg-red-50 border border-red-200 rounded-lg p-3 shadow-lg z-10">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-700">{exportState.error}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleRetry}
                    className="text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Retry
                  </button>
                  <button
                    onClick={handleDismissError}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default variant - separate buttons
  return (
    <div className={cn('space-y-3', className)}>
      {/* PDF Button */}
      <ExportButton
        format="pdf"
        label="Download PDF"
        icon={<FileText className="h-4 w-4" />}
        iconColor="text-red-500"
        isExporting={exportState.format === 'pdf' && isExporting}
        isSuccess={exportState.status === 'success' && exportState.format === null}
        progress={exportState.format === 'pdf' ? exportState.progress : 0}
        error={exportState.format === 'pdf' ? exportState.error : null}
        onExport={() => handleExport('pdf')}
        onRetry={handleRetry}
        onDismissError={handleDismissError}
        disabled={isExporting && exportState.format !== 'pdf'}
      />

      {/* DOCX Button */}
      <ExportButton
        format="docx"
        label="Download DOCX"
        icon={<FileText className="h-4 w-4" />}
        iconColor="text-blue-500"
        isExporting={exportState.format === 'docx' && isExporting}
        isSuccess={exportState.status === 'success' && exportState.format === null}
        progress={exportState.format === 'docx' ? exportState.progress : 0}
        error={exportState.format === 'docx' ? exportState.error : null}
        onExport={() => handleExport('docx')}
        onRetry={handleRetry}
        onDismissError={handleDismissError}
        disabled={isExporting && exportState.format !== 'docx'}
      />
    </div>
  );
};

/**
 * Individual export button component
 */
interface ExportButtonProps {
  format: ExportFormat;
  label: string;
  icon: React.ReactNode;
  iconColor: string;
  isExporting: boolean;
  isSuccess: boolean;
  progress: number;
  error: string | null;
  onExport: () => void;
  onRetry: () => void;
  onDismissError: () => void;
  disabled: boolean;
}

const ExportButton: React.FC<ExportButtonProps> = ({
  format: _format,
  label,
  icon,
  iconColor,
  isExporting,
  isSuccess: _isSuccess,
  progress,
  error,
  onExport,
  onRetry,
  onDismissError,
  disabled,
}) => {
  if (error) {
    return (
      <div className="border border-red-200 rounded-lg p-3 bg-red-50">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Export failed</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={onRetry}
                className="text-xs font-medium text-red-700 hover:text-red-800"
              >
                Try again
              </button>
              <button
                onClick={onDismissError}
                className="text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isExporting) {
    return (
      <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">
              {progress < 100 ? 'Generating...' : 'Downloading...'}
            </p>
            <div className="w-full bg-blue-200 rounded-full h-1.5 mt-2">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-blue-700">{progress}%</span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onExport}
      disabled={disabled}
      className={cn(
        'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors',
        disabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
      )}
    >
      <span className={iconColor}>{icon}</span>
      {label}
      <Download className="h-4 w-4 ml-auto text-gray-400" />
    </button>
  );
};

/**
 * Inline export button for use in headers/toolbars
 */
interface InlineExportButtonProps {
  quote: Quote;
  projectId: string;
  format: ExportFormat;
  className?: string;
}

export const InlineExportButton: React.FC<InlineExportButtonProps> = ({
  quote,
  projectId,
  format,
  className,
}) => {
  const [state, setState] = useState<{
    status: 'idle' | 'exporting' | 'success' | 'error';
    progress: number;
    error: string | null;
  }>({
    status: 'idle',
    progress: 0,
    error: null,
  });

  const handleExport = useCallback(async () => {
    setState({ status: 'exporting', progress: 0, error: null });

      try {
      const blob = await quoteService.exportQuote(projectId, quote.id, format);
      const projectName = quote.project.name.replace(/[^a-zA-Z0-9]/g, '-');
      const filename = `${quote.quote_number}-${projectName}.${format}`;

      setState({ status: 'success', progress: 100, error: null });

      setTimeout(() => {
        setState({ status: 'idle', progress: 0, error: null });
      }, 2000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Export failed';
      setState({ status: 'error', progress: 0, error: errorMessage });
    }
  }, [format, projectId, quote]);

  const formatLabel = format.toUpperCase();
  const formatColor = format === 'pdf' ? 'text-red-500' : 'text-blue-500';

  return (
    <button
      onClick={handleExport}
      disabled={state.status === 'exporting'}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
        state.status === 'exporting'
          ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
          : state.status === 'error'
          ? 'bg-red-50 text-red-700 border border-red-200'
          : state.status === 'success'
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
        className
      )}
      title={state.error || `Export as ${formatLabel}`}
    >
      {state.status === 'exporting' ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {state.progress}%
        </>
      ) : state.status === 'success' ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-600" />
          Done
        </>
      ) : state.status === 'error' ? (
        <>
          <AlertCircle className="h-3.5 w-3.5" />
          Failed
        </>
      ) : (
        <>
          <FileText className={cn('h-3.5 w-3.5', formatColor)} />
          {formatLabel}
        </>
      )}
    </button>
  );
};

export default ExportButtons;

/**
 * Export Dialog Component
 * Modal for selecting export format (DOCX or PDF) and triggering download
 */

import React, { useState, useCallback } from 'react';
import {
  X,
  FileText,
  FileDown,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { quoteService } from '@/services/quote.service';

// Export format type
type ExportFormat = 'docx' | 'pdf';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  quoteId: string;
  quoteNumber: string;
}

export function ExportDialog({
  isOpen,
  onClose,
  projectId,
  quoteId,
  quoteNumber,
}: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('docx');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportError(null);

    try {
      // Call the export API
      const blob = await quoteService.exportQuote(projectId, quoteId, selectedFormat);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${quoteNumber}.${selectedFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportSuccess(true);

      // Auto close after success
      setTimeout(() => {
        onClose();
        setExportSuccess(false);
      }, 1500);
    } catch (error) {
      console.error('Export failed:', error);
      setExportError(error instanceof Error ? error.message : 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [projectId, quoteId, quoteNumber, selectedFormat, onClose]);

  const handleClose = useCallback(() => {
    if (!isExporting) {
      setExportError(null);
      setExportSuccess(false);
      onClose();
    }
  }, [isExporting, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Export Quote</h2>
          <button
            onClick={handleClose}
            disabled={isExporting}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Success State */}
          {exportSuccess && (
            <div className="flex flex-col items-center py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-100 mb-4">
                <CheckCircle className="h-8 w-8 text-success-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Download Started!</h3>
              <p className="text-sm text-gray-500">Your file is being downloaded.</p>
            </div>
          )}

          {/* Error State */}
          {exportError && !exportSuccess && (
            <div className="mb-6 p-4 bg-error-50 border border-error-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-error-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-error-800">Export Failed</p>
                  <p className="text-sm text-error-700 mt-1">{exportError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Format Selection */}
          {!exportSuccess && (
            <>
              <p className="text-sm text-gray-600 mb-6">
                Choose your preferred format for <strong>{quoteNumber}</strong>
              </p>

              <div className="space-y-3 mb-6">
                {/* DOCX Option */}
                <button
                  type="button"
                  onClick={() => setSelectedFormat('docx')}
                  disabled={isExporting}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200',
                    selectedFormat === 'docx'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white',
                    isExporting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-lg',
                      selectedFormat === 'docx' ? 'bg-primary-100' : 'bg-gray-100'
                    )}
                  >
                    <FileText
                      className={cn(
                        'h-6 w-6',
                        selectedFormat === 'docx' ? 'text-primary-600' : 'text-gray-500'
                      )}
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <p
                      className={cn(
                        'font-semibold',
                        selectedFormat === 'docx' ? 'text-primary-900' : 'text-gray-900'
                      )}
                    >
                      Microsoft Word (.docx)
                    </p>
                    <p className="text-sm text-gray-500">Editable document format</p>
                  </div>
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                      selectedFormat === 'docx'
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-gray-300'
                    )}
                  >
                    {selectedFormat === 'docx' && (
                      <CheckCircle className="h-3 w-3 text-white" />
                    )}
                  </div>
                </button>

                {/* PDF Option */}
                <button
                  type="button"
                  onClick={() => setSelectedFormat('pdf')}
                  disabled={isExporting}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200',
                    selectedFormat === 'pdf'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white',
                    isExporting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-lg',
                      selectedFormat === 'pdf' ? 'bg-primary-100' : 'bg-gray-100'
                    )}
                  >
                    <FileDown
                      className={cn(
                        'h-6 w-6',
                        selectedFormat === 'pdf' ? 'text-primary-600' : 'text-gray-500'
                      )}
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <p
                      className={cn(
                        'font-semibold',
                        selectedFormat === 'pdf' ? 'text-primary-900' : 'text-gray-900'
                      )}
                    >
                      PDF Document (.pdf)
                    </p>
                    <p className="text-sm text-gray-500">Print-ready format</p>
                  </div>
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                      selectedFormat === 'pdf'
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-gray-300'
                    )}
                  >
                    {selectedFormat === 'pdf' && (
                      <CheckCircle className="h-3 w-3 text-white" />
                    )}
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!exportSuccess && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={handleClose}
              disabled={isExporting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200',
                isExporting
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              )}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download {selectedFormat.toUpperCase()}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExportDialog;

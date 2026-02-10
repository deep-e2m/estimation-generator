/**
 * NewQuote Page
 * Requirements input page for generating new quotes
 * Features:
 * - Large text area for pasting requirements
 * - Character count display
 * - File upload zone (images, documents)
 * - Platform selection
 * - Generate Quote button with streaming progress
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  FileText,
  ChevronDown,
  AlertCircle,
  Loader2,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { FileUploader } from '../components/upload/FileUploader';
import { useFileUpload } from '../hooks/useFileUpload';
import { quoteService } from '../services/quote.service';
import type {
  Platform,
  GenerationProgress,
  Quote,
  GenerateQuoteRequest,
  GenerationStep,
} from '../types/quote.types';

// Constants
const MIN_REQUIREMENTS_LENGTH = 50;
const MAX_REQUIREMENTS_LENGTH = 50000;

// Platform options
const PLATFORMS: Array<{ value: Platform; label: string; description: string }> = [
  { value: 'wordpress', label: 'WordPress', description: 'Content management and blogging' },
  { value: 'shopify', label: 'Shopify', description: 'Hosted e-commerce platform' },
  { value: 'woocommerce', label: 'WooCommerce', description: 'WordPress e-commerce plugin' },
  { value: 'custom', label: 'Custom', description: 'React, Vue, Angular, Magento, or other frameworks' },
];

// Generation step labels
const STEP_LABELS: Record<GenerationStep, string> = {
  parsing_input: 'Parsing requirements...',
  analyzing_requirements: 'Analyzing requirements...',
  retrieving_knowledge: 'Researching platform capabilities...',
  generating_estimate: 'Calculating estimates...',
  formatting_output: 'Generating quote document...',
};

interface NewQuotePageProps {
  projectId: string;
  onQuoteGenerated?: (quote: Quote) => void;
  onCancel?: () => void;
}

export const NewQuotePage: React.FC<NewQuotePageProps> = ({
  projectId,
  onQuoteGenerated,
  onCancel,
}) => {
  // Form state
  const [requirements, setRequirements] = useState('');
  const [platform, setPlatform] = useState<Platform>('wordpress');
  const [isPlatformOpen, setIsPlatformOpen] = useState(false);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatedQuote, setGeneratedQuote] = useState<Quote | null>(null);

  // Cancel function ref
  const [cancelGeneration, setCancelGeneration] = useState<(() => void) | null>(null);

  // File upload hook
  const {
    files,
    uploadedRecords,
    isUploading,
    addFiles,
    removeFile,
    retryUpload,
  } = useFileUpload({
    projectId,
    category: 'requirements',
    onError: (error) => {
      console.error('Upload error:', error);
    },
  });

  // Character count
  const characterCount = requirements.length;
  const isUnderMinLength = characterCount > 0 && characterCount < MIN_REQUIREMENTS_LENGTH;
  const isOverMaxLength = characterCount > MAX_REQUIREMENTS_LENGTH;

  // Can generate check
  const canGenerate = useMemo(() => {
    const hasText = characterCount >= MIN_REQUIREMENTS_LENGTH;
    const hasFiles = uploadedRecords.length > 0;
    const hasValidInput = hasText || hasFiles;

    return hasValidInput && !isUploading && !isGenerating && !isOverMaxLength;
  }, [characterCount, uploadedRecords.length, isUploading, isGenerating, isOverMaxLength]);

  /**
   * Handle requirements text change
   */
  const handleRequirementsChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length <= MAX_REQUIREMENTS_LENGTH) {
        setRequirements(value);
      }
    },
    []
  );

  /**
   * Handle platform selection
   */
  const handlePlatformSelect = useCallback((selectedPlatform: Platform) => {
    setPlatform(selectedPlatform);
    setIsPlatformOpen(false);
  }, []);

  /**
   * Handle quote generation
   */
  const handleGenerateQuote = useCallback(() => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedQuote(null);
    setGenerationProgress(null);

    const request: GenerateQuoteRequest = {
      requirements: requirements,
      hourly_rate: 150, // Default rate, should come from user settings
      use_rag: true,
      project_context: {
        platform,
      },
    };

    const cancel = quoteService.generateQuoteWithProgress(
      projectId,
      request,
      // Progress callback
      (progress) => {
        setGenerationProgress(progress);
      },
      // Complete callback
      (quote) => {
        setIsGenerating(false);
        setGeneratedQuote(quote);
        setCancelGeneration(null);
        onQuoteGenerated?.(quote);
      },
      // Error callback
      (error) => {
        setIsGenerating(false);
        setGenerationError(error);
        setCancelGeneration(null);
      }
    );

    setCancelGeneration(() => cancel);
  }, [canGenerate, requirements, platform, projectId, onQuoteGenerated]);

  /**
   * Handle cancel generation
   */
  const handleCancelGeneration = useCallback(() => {
    if (cancelGeneration) {
      cancelGeneration();
      setIsGenerating(false);
      setGenerationProgress(null);
      setCancelGeneration(null);
    }
  }, [cancelGeneration]);

  /**
   * Reset form for new quote
   */
  const handleReset = useCallback(() => {
    setRequirements('');
    setGeneratedQuote(null);
    setGenerationError(null);
    setGenerationProgress(null);
  }, []);

  // Get selected platform label
  const selectedPlatform = PLATFORMS.find((p) => p.value === platform);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Generate New Quote</h1>
        <p className="mt-3 text-gray-500 text-lg">
          Enter your project requirements and upload any supporting documents or images.
        </p>
      </div>

      {/* Generation Success */}
      {generatedQuote && (
        <div className="mb-8 p-6 bg-success-50 border border-success-200 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-100">
              <CheckCircle className="h-5 w-5 text-success-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-success-800">Quote Generated Successfully</h3>
              <p className="text-sm text-success-700 mt-1">
                Quote {generatedQuote.quote_number} has been created.
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => onQuoteGenerated?.(generatedQuote)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-success-700 bg-success-100 rounded-lg hover:bg-success-200 transition-colors"
                >
                  View Quote
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Create Another
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generation Error */}
      {generationError && (
        <div className="mb-8 p-6 bg-error-50 border border-error-200 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error-100">
              <AlertCircle className="h-5 w-5 text-error-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-error-800">Generation Failed</h3>
              <p className="text-sm text-error-700 mt-1">{generationError}</p>
              <button
                onClick={handleGenerateQuote}
                className="mt-4 px-4 py-2 text-sm font-medium text-error-700 bg-error-100 rounded-lg hover:bg-error-200 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generation Progress */}
      {isGenerating && generationProgress && (
        <div className="mb-8 p-6 bg-primary-50 border border-primary-200 rounded-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100">
              <Loader2 className="h-5 w-5 text-primary-600 animate-spin" />
            </div>
            <h3 className="font-semibold text-primary-800 text-lg">Generating Quote...</h3>
          </div>

          {/* Progress Steps */}
          <div className="space-y-4 ml-2">
            {(['parsing_input', 'analyzing_requirements', 'retrieving_knowledge', 'generating_estimate', 'formatting_output'] as GenerationStep[]).map(
              (step, index) => {
                const stepNumber = index + 1;
                const isComplete = generationProgress.progress.steps_completed >= stepNumber;
                const isCurrent = generationProgress.progress.current_step === step;

                return (
                  <div key={step} className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300',
                        isComplete && 'bg-primary-600 text-white',
                        isCurrent && !isComplete && 'bg-primary-200 text-primary-700 animate-pulse',
                        !isComplete && !isCurrent && 'bg-gray-200 text-gray-500'
                      )}
                    >
                      {isComplete ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        stepNumber
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-sm',
                        isComplete && 'text-primary-700',
                        isCurrent && !isComplete && 'text-primary-700 font-medium',
                        !isComplete && !isCurrent && 'text-gray-500'
                      )}
                    >
                      {STEP_LABELS[step]}
                    </span>
                  </div>
                );
              }
            )}
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between text-sm text-primary-700 mb-2">
              <span className="font-medium">Progress</span>
              <span className="font-semibold">{generationProgress.progress.percentage}%</span>
            </div>
            <div className="w-full bg-primary-200 rounded-full h-2.5">
              <div
                className="bg-primary-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${generationProgress.progress.percentage}%` }}
              />
            </div>
          </div>

          {/* Cancel Button */}
          <button
            onClick={handleCancelGeneration}
            className="mt-6 px-4 py-2 text-sm font-medium text-primary-700 bg-white border border-primary-300 rounded-lg hover:bg-primary-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main Form */}
      {!generatedQuote && (
        <div className="space-y-8">
          {/* Platform Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Target Platform
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsPlatformOpen(!isPlatformOpen)}
                className="w-full flex items-center justify-between px-5 py-4 bg-white border border-gray-300 rounded-xl hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 shadow-sm"
                disabled={isGenerating}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                    <FileText className="h-5 w-5 text-gray-500" />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-gray-900">
                      {selectedPlatform?.label}
                    </span>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {selectedPlatform?.description}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    'h-5 w-5 text-gray-400 transition-transform duration-200',
                    isPlatformOpen && 'rotate-180'
                  )}
                />
              </button>

              {/* Dropdown */}
              {isPlatformOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                  {PLATFORMS.map((p, index) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => handlePlatformSelect(p.value)}
                      className={cn(
                        'w-full px-5 py-4 text-left hover:bg-gray-50 transition-colors flex items-center gap-4',
                        p.value === platform && 'bg-primary-50',
                        index !== PLATFORMS.length - 1 && 'border-b border-gray-100'
                      )}
                    >
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        p.value === platform ? 'bg-primary-100' : 'bg-gray-100'
                      )}>
                        <FileText className={cn(
                          'h-5 w-5',
                          p.value === platform ? 'text-primary-600' : 'text-gray-500'
                        )} />
                      </div>
                      <div>
                        <span className={cn(
                          'font-semibold',
                          p.value === platform ? 'text-primary-700' : 'text-gray-900'
                        )}>{p.label}</span>
                        <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Requirements Text Area */}
          <div>
            <div className="flex justify-between items-baseline mb-3">
              <label
                htmlFor="requirements"
                className="block text-sm font-medium text-gray-700"
              >
                Project Requirements
              </label>
              <span
                className={cn(
                  'text-xs font-medium',
                  isUnderMinLength && 'text-warning-600',
                  isOverMaxLength && 'text-error-600',
                  !isUnderMinLength && !isOverMaxLength && 'text-gray-500'
                )}
              >
                {characterCount.toLocaleString()} / {MAX_REQUIREMENTS_LENGTH.toLocaleString()} characters
              </span>
            </div>

            <textarea
              id="requirements"
              value={requirements}
              onChange={handleRequirementsChange}
              placeholder="Paste or type your project requirements here...

Example:
- We need a mobile app with user authentication
- Push notifications support
- Integration with our existing REST API
- Both iOS and Android platforms
- Offline support for viewing cached data"
              className={cn(
                'w-full h-72 px-5 py-4 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 shadow-sm',
                isOverMaxLength && 'border-error-300 focus:ring-error-500/20 focus:border-error-500',
                !isOverMaxLength && 'border-gray-300 hover:border-gray-400'
              )}
              disabled={isGenerating}
            />

            {/* Validation Messages */}
            {isUnderMinLength && (
              <p className="mt-2 text-xs text-warning-600 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Minimum {MIN_REQUIREMENTS_LENGTH} characters required for meaningful quote generation
              </p>
            )}

            {isOverMaxLength && (
              <p className="mt-2 text-xs text-error-600 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Requirements exceed maximum length
              </p>
            )}
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Supporting Files (Optional)
            </label>
            <p className="text-sm text-gray-500 mb-4">
              Upload screenshots, mockups, diagrams, or requirement documents
            </p>
            <FileUploader
              files={files}
              isUploading={isUploading}
              onFilesAdd={addFiles}
              onFileRemove={removeFile}
              onRetry={retryUpload}
              disabled={isGenerating}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
              disabled={isGenerating}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleGenerateQuote}
              disabled={!canGenerate}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 shadow-sm',
                canGenerate
                  ? 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-md'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Generate Quote
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          {/* Help Text */}
          {!canGenerate && !isGenerating && (
            <p className="text-sm text-center text-gray-500 bg-gray-50 py-3 px-4 rounded-lg">
              {characterCount === 0 && uploadedRecords.length === 0
                ? 'Enter requirements text or upload files to generate a quote'
                : isUnderMinLength
                ? `Add ${MIN_REQUIREMENTS_LENGTH - characterCount} more characters or upload files`
                : isUploading
                ? 'Wait for file upload to complete'
                : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default NewQuotePage;

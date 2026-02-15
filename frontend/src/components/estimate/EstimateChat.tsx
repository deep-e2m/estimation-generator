/**
 * EstimateChat Component
 * AI-initiated estimate generation chat with step-by-step progress
 *
 * STRICT WORKFLOW:
 * 1. AI auto-initiates analysis on mount (NO greetings/filler)
 * 2. Shows step-by-step progress bar in chat window
 * 3. Generates single hours-only estimate
 * 4. Displays only "Edit in Editor" and "Approve" actions
 * 5. NO regeneration allowed - one estimate per project
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Clock,
  Edit2,
  Loader2,
  AlertCircle,
  FileText,
  Search,
  Layers,
  Calculator,
  BookCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { quoteService } from '@/services/quote-generation.service';
import type { Project, Quote } from '@/types';
import type { GenerateQuoteRequest } from '@/types/quote.types';
import { EstimationSplitView } from './EstimationSplitView';
import { EstimationGenerationUI } from './EstimationGenerationUI';

// Step definitions as per specification
type AnalysisStep =
  | 'parsing_requirements'
  | 'analyzing_scope'
  | 'mapping_tasks'
  | 'estimating_hours'
  | 'validating_estimate';

interface StepConfig {
  id: AnalysisStep;
  label: string;
  description: string;
  icon: React.ElementType;
}

const ANALYSIS_STEPS: StepConfig[] = [
  {
    id: 'parsing_requirements',
    label: 'Parsing Requirements',
    description: 'Reading and parsing project requirements',
    icon: FileText,
  },
  {
    id: 'analyzing_scope',
    label: 'Analyzing Scope',
    description: 'Analyzing scope and complexity',
    icon: Search,
  },
  {
    id: 'mapping_tasks',
    label: 'Mapping Tasks',
    description: 'Mapping requirements to technical tasks',
    icon: Layers,
  },
  {
    id: 'estimating_hours',
    label: 'Estimating Hours',
    description: 'Calculating effort in hours',
    icon: Calculator,
  },
  {
    id: 'validating_estimate',
    label: 'Validating Estimate',
    description: 'Validating against historical examples',
    icon: BookCheck,
  },
];

interface EstimateChatProps {
  project: Project;
  existingEstimate?: Quote | null;
  onEstimateGenerated?: (quote: Quote) => void;
  /** Use the new full-screen generation UI instead of inline progress */
  useFullscreenUI?: boolean;
}

export function EstimateChat({
  project,
  existingEstimate,
  onEstimateGenerated,
  useFullscreenUI = true, // Default to new fullscreen UI
}: EstimateChatProps) {
  const navigate = useNavigate();

  // State
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(!!existingEstimate);
  const [generatedEstimate, setGeneratedEstimate] = useState<Quote | null>(
    existingEstimate || null
  );
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [showSplitView, setShowSplitView] = useState(!!existingEstimate);
  const [showConfirmation, setShowConfirmation] = useState(!existingEstimate);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showFullscreenGeneration, setShowFullscreenGeneration] = useState(false);

  // Refs
  const hasStartedRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check if estimate already exists (enforces single estimate rule)
  const hasExistingEstimate = !!existingEstimate || !!generatedEstimate;

  // Sync existingEstimate changes
  useEffect(() => {
    if (existingEstimate && !generatedEstimate) {
      setGeneratedEstimate(existingEstimate);
      setIsComplete(true);
      setShowSplitView(true);
    }
  }, [existingEstimate, generatedEstimate]);

  // Progress simulation for steps
  useEffect(() => {
    if (isGenerating && currentStep < ANALYSIS_STEPS.length) {
      const stepDuration = 1500; // 1.5 seconds per step
      const progressPerStep = 100 / ANALYSIS_STEPS.length;

      const timer = setInterval(() => {
        setProgress((prev) => {
          const nextProgress = prev + 2;
          const stepThreshold = (currentStep + 1) * progressPerStep;

          if (nextProgress >= stepThreshold && currentStep < ANALYSIS_STEPS.length - 1) {
            setCurrentStep((s) => s + 1);
          }

          return Math.min(nextProgress, 95); // Cap at 95% until complete
        });
      }, stepDuration / (progressPerStep / 2));

      return () => clearInterval(timer);
    }
  }, [isGenerating, currentStep]);

  // Start estimate generation
  const startEstimateGeneration = useCallback(async () => {
    if (isGenerating || hasExistingEstimate) return;

    // If using fullscreen UI, show it instead of inline progress
    if (useFullscreenUI) {
      setShowConfirmation(false);
      setShowFullscreenGeneration(true);
      return;
    }

    setShowConfirmation(false);
    setIsGenerating(true);
    setError(null);
    setCurrentStep(0);
    setProgress(0);
    setIsCancelling(false);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    const request: GenerateQuoteRequest = {
      requirements: project.description || '',
      use_rag: true,
      project_context: {
        platform: project.platform,
        project_name: project.name,
      },
    };

    try {
      // Call the backend to generate quote
      const response = await quoteService.generateQuote(project.id, request);

      // Check if cancelled
      if (isCancelling) {
        return;
      }

      const quote = response.quote;

      // Complete the progress
      setProgress(100);
      setCurrentStep(ANALYSIS_STEPS.length);
      setIsComplete(true);
      setGeneratedEstimate(quote);
      setShowSplitView(true);

      if (onEstimateGenerated) {
        onEstimateGenerated(quote);
      }
    } catch (err) {
      if (isCancelling) {
        setError('Estimate generation was cancelled.');
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to generate estimate. Please try again.'
        );
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [project, isGenerating, hasExistingEstimate, onEstimateGenerated, isCancelling, useFullscreenUI]);

  // Handle fullscreen generation complete
  const handleFullscreenComplete = useCallback((quote: Quote) => {
    setShowFullscreenGeneration(false);
    setGeneratedEstimate(quote);
    setIsComplete(true);
    setShowSplitView(true);

    if (onEstimateGenerated) {
      onEstimateGenerated(quote);
    }
  }, [onEstimateGenerated]);

  // Handle fullscreen generation cancel
  const handleFullscreenCancel = useCallback(() => {
    setShowFullscreenGeneration(false);
    setShowConfirmation(true);
  }, []);

  // Cancel estimate generation
  const handleCancel = useCallback(() => {
    if (!isGenerating) return;
    
    setIsCancelling(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    setShowConfirmation(true);
    setProgress(0);
    setCurrentStep(0);
  }, [isGenerating]);

  // Handle Edit in Editor action
  const handleEditInEditor = useCallback(() => {
    if (generatedEstimate) {
      navigate(`/projects/${project.id}/quotes/${generatedEstimate.id}/edit`);
    }
  }, [generatedEstimate, navigate, project.id]);

  // Handle Approve action
  const handleApprove = useCallback(async () => {
    if (!generatedEstimate) return;

    try {
      // Update quote status to approved
      await quoteService.updateQuote(project.id, generatedEstimate.id, {
        status: 'approved',
      });
      // Navigate to quote detail
      navigate(`/projects/${project.id}/quotes/${generatedEstimate.id}`);
    } catch (err) {
      setError('Failed to approve estimate. Please try again.');
    }
  }, [generatedEstimate, navigate, project.id]);

  // Show fullscreen generation UI
  if (showFullscreenGeneration) {
    return (
      <EstimationGenerationUI
        project={project}
        onComplete={handleFullscreenComplete}
        onCancel={handleFullscreenCancel}
      />
    );
  }

  // Show split view if estimate exists
  if (showSplitView && generatedEstimate) {
    return (
      <EstimationSplitView
        project={project}
        initialQuote={generatedEstimate}
        onQuoteUpdated={onEstimateGenerated}
      />
    );
  }

  // Render estimate content (hours only, NO pricing)
  const renderEstimateContent = () => {
    if (!generatedEstimate) return null;

    // Get total hours from either root level or content.totals
    const totalHours =
      generatedEstimate.total_hours ??
      generatedEstimate.content?.totals?.total_expected_hours ??
      0;

    // Get executive summary from content if available
    const summary = generatedEstimate.content?.executive_summary || '';

    return (
      <div className="space-y-6">
        {/* Estimate Header */}
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-100">
              <CheckCircle className="h-5 w-5 text-success-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Estimate Complete</h3>
              <p className="text-sm text-gray-500">
                {generatedEstimate.quote_number ||
                  `EST-${generatedEstimate.id?.slice(0, 8).toUpperCase()}`}
              </p>
            </div>
          </div>
        </div>

        {/* Total Hours Summary */}
        <div className="py-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-2xl font-bold text-primary-700">
            <Clock className="h-6 w-6" />
            <span>{Number(totalHours).toLocaleString()} hours</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">Total Estimated Effort</p>
        </div>

        {/* Estimate Details */}
        {summary && (
          <div className="pt-4 border-t border-gray-100">
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-normal bg-gray-50 p-4 rounded-lg">
                {summary}
              </pre>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={chatContainerRef}
      className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden"
    >
      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
            <Calculator className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Estimate Generation</h2>
            <p className="text-sm text-gray-500">{project.name}</p>
          </div>
        </div>
      </div>

      {/* Chat Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Confirmation Dialog */}
        {showConfirmation && !hasExistingEstimate && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="max-w-md text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 mx-auto mb-4">
                <Calculator className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Ready to generate estimate?
              </h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                I'll analyze your project requirements and create a detailed hours estimate. 
                This process takes approximately 30-45 seconds.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/projects')}
                  className="px-6 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={startEstimateGeneration}
                  className="px-6 py-3 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-all duration-200 shadow-sm inline-flex items-center gap-2"
                >
                  Generate Estimate
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI-Initiated Analysis State */}
        {isGenerating && !isComplete && (
          <div>
            {/* Compact Progress Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 text-primary-600 animate-spin" />
                  <span className="font-medium text-gray-900">
                    Generating estimate...
                  </span>
                </div>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
                >
                  Cancel
                </button>
              </div>

              {/* Estimated time remaining */}
              <p className="text-sm text-gray-500 mb-4">
                Estimated time: {Math.max(5, Math.round((100 - progress) / 100 * 30))}s remaining
              </p>

              {/* Compact Step Progress - Inline */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {ANALYSIS_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const isComplete = index < currentStep;
                  const isCurrent = index === currentStep;

                  return (
                    <div
                      key={step.id}
                      className={cn(
                        'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-300',
                        isComplete && 'bg-success-50 text-success-700',
                        isCurrent && 'bg-primary-50 text-primary-700',
                        !isComplete && !isCurrent && 'bg-gray-50 text-gray-400'
                      )}
                    >
                      {isComplete ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : isCurrent ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                      <span className="font-medium">{step.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium text-primary-700">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-6 bg-error-50 border border-error-200 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error-100">
                <AlertCircle className="h-5 w-5 text-error-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-error-800">
                  Estimate Generation Failed
                </h3>
                <p className="text-sm text-error-700 mt-1">{error}</p>
                {/* Note: No retry button - single estimate per project rule */}
              </div>
            </div>
          </div>
        )}

        {/* Completed Estimate */}
        {isComplete && generatedEstimate && (
          <div>
            {renderEstimateContent()}
          </div>
        )}

        {/* Existing Estimate (if loaded from backend) */}
        {!isGenerating && !isComplete && existingEstimate && (
          <div>
            {renderEstimateContent()}
          </div>
        )}
      </div>

      {/* Action Buttons - Only "Edit in Editor" and "Approve" */}
      {(isComplete || existingEstimate) && generatedEstimate && (
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-center gap-4">
            <p className="text-sm text-gray-600 mr-4">Ready to proceed?</p>

            {/* Edit in Editor Button */}
            <button
              onClick={handleEditInEditor}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm"
            >
              <Edit2 className="h-4 w-4" />
              Edit in Editor
            </button>

            {/* Approve Button */}
            <button
              onClick={handleApprove}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-all duration-200 shadow-sm"
            >
              <CheckCircle className="h-4 w-4" />
              Approve
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EstimateChat;

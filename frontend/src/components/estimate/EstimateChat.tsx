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
import { quoteService } from '@/services/quote.service';
import type { Project } from '@/types';
import type { Quote, GenerateQuoteRequest } from '@/types/quote.types';

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
}

export function EstimateChat({
  project,
  existingEstimate,
  onEstimateGenerated,
}: EstimateChatProps) {
  const navigate = useNavigate();

  // State
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [generatedEstimate, setGeneratedEstimate] = useState<Quote | null>(
    existingEstimate || null
  );
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Refs
  const hasStartedRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Check if estimate already exists (enforces single estimate rule)
  const hasExistingEstimate = !!existingEstimate || !!generatedEstimate;

  // Auto-start estimate generation on mount (AI-initiated, no greetings)
  useEffect(() => {
    // Only start if no existing estimate and hasn't started yet
    if (!hasExistingEstimate && !hasStartedRef.current && project.description) {
      hasStartedRef.current = true;
      startEstimateGeneration();
    }
  }, [project, hasExistingEstimate]);

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

    setIsGenerating(true);
    setError(null);
    setCurrentStep(0);
    setProgress(0);

    const request: GenerateQuoteRequest = {
      requirements: project.description,
      use_rag: true,
      project_context: {
        platform: project.platform,
        project_name: project.name,
      },
    };

    try {
      // Call the backend to generate quote
      const response = await quoteService.generateQuote(project.id, request);
      const quote = response.quote;

      // Complete the progress
      setProgress(100);
      setCurrentStep(ANALYSIS_STEPS.length);
      setIsComplete(true);
      setGeneratedEstimate(quote);

      if (onEstimateGenerated) {
        onEstimateGenerated(quote);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate estimate. Please try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  }, [project, isGenerating, hasExistingEstimate, onEstimateGenerated]);

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

  // Render estimate content (hours only, NO pricing)
  const renderEstimateContent = () => {
    if (!generatedEstimate) return null;

    // Parse the estimate content to extract hours breakdown
    const content = generatedEstimate.content || '';
    const totalHours = Number(generatedEstimate.total_hours) || 0;

    return (
      <div className="estimate-content">
        {/* Estimate Header */}
        <div className="estimate-header">
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
        <div className="estimate-total">
          <div className="flex items-center gap-2 text-2xl font-bold text-primary-700">
            <Clock className="h-6 w-6" />
            <span>{totalHours.toLocaleString()} hours</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">Total Estimated Effort</p>
        </div>

        {/* Estimate Details */}
        <div className="estimate-details">
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-normal bg-gray-50 p-4 rounded-lg">
              {content}
            </pre>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={chatContainerRef}
      className="estimate-chat flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden"
    >
      {/* Chat Header */}
      <div className="estimate-chat-header px-6 py-4 border-b border-gray-100 bg-gray-50">
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
        {/* AI-Initiated Analysis State */}
        {isGenerating && !isComplete && (
          <div className="estimate-analysis">
            {/* Progress Steps - Displayed in Chat Window */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-6">
                <Loader2 className="h-5 w-5 text-primary-600 animate-spin" />
                <span className="font-medium text-gray-900">
                  Analyzing project requirements...
                </span>
              </div>

              {/* Step-by-step Progress */}
              <div className="space-y-4">
                {ANALYSIS_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const isComplete = index < currentStep;
                  const isCurrent = index === currentStep;
                  const isPending = index > currentStep;

                  return (
                    <div
                      key={step.id}
                      className={cn(
                        'flex items-center gap-4 p-3 rounded-lg transition-all duration-300',
                        isComplete && 'bg-success-50',
                        isCurrent && 'bg-primary-50',
                        isPending && 'bg-gray-50 opacity-50'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300',
                          isComplete && 'bg-success-100',
                          isCurrent && 'bg-primary-100 animate-pulse',
                          isPending && 'bg-gray-200'
                        )}
                      >
                        {isComplete ? (
                          <CheckCircle className="h-5 w-5 text-success-600" />
                        ) : isCurrent ? (
                          <Loader2 className="h-5 w-5 text-primary-600 animate-spin" />
                        ) : (
                          <Icon className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p
                          className={cn(
                            'font-medium',
                            isComplete && 'text-success-700',
                            isCurrent && 'text-primary-700',
                            isPending && 'text-gray-500'
                          )}
                        >
                          {step.label}
                        </p>
                        <p
                          className={cn(
                            'text-sm',
                            isComplete && 'text-success-600',
                            isCurrent && 'text-primary-600',
                            isPending && 'text-gray-400'
                          )}
                        >
                          {step.description}
                        </p>
                      </div>
                      {isComplete && (
                        <span className="text-xs font-medium text-success-600">
                          Complete
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div className="mt-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium text-primary-700">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="estimate-error p-6 bg-error-50 border border-error-200 rounded-xl">
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
          <div className="estimate-complete">
            {renderEstimateContent()}
          </div>
        )}

        {/* Existing Estimate (if loaded from backend) */}
        {!isGenerating && !isComplete && existingEstimate && (
          <div className="estimate-existing">
            {(() => {
              // Set the generated estimate from existing
              if (!generatedEstimate) {
                setGeneratedEstimate(existingEstimate);
                setIsComplete(true);
              }
              return renderEstimateContent();
            })()}
          </div>
        )}
      </div>

      {/* Action Buttons - Only "Edit in Editor" and "Approve" */}
      {(isComplete || existingEstimate) && generatedEstimate && (
        <div className="estimate-actions px-6 py-4 border-t border-gray-100 bg-gray-50">
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

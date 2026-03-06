/**
 * EstimationGenerationUI Component
 * Estimation generation with timeline summary, circular progress ring,
 * and estimate summary (requirements, tasks, hours + backend metadata).
 * Progress is honest: single "Generating…" until API returns, then full results.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Search,
  Layers,
  Calculator,
  BookCheck,
  CheckCircle,
  X,
  Sparkles,
  Clock,
  ListTodo,
  ArrowRight,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { documentsService } from '@/services/documents.service';
import { quoteService } from '@/services/quote-generation.service';
import type { Project, Quote } from '@/types';
import type { GenerateQuoteRequest } from '@/types/quote.types';

/** Calibration band from similar projects (for UI guardrail display). */
export interface CalibrationBand {
  min_hours: number;
  max_hours: number;
  median_hours: number;
}

/** Backend metadata returned after generation (same shape as API generation_metadata). */
export interface GenerationMetadataResult {
  model_used?: string;
  tokens_used?: number;
  generation_cost?: number;
  rag_context_used?: boolean;
  generation_time_ms?: number;
  analysis?: { requirements_count?: number; tasks_count?: number };
  validation_warnings?: string[];
  calibration_band?: CalibrationBand;
  requirements_coverage_warnings?: string[];
  company_stack_used?: boolean;
  company_stack_fallback?: string | null;
  reference_urls_used?: string[];
}

// Step definitions
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
  color: string;
}

const ANALYSIS_STEPS: StepConfig[] = [
  {
    id: 'parsing_requirements',
    label: 'Parsing Requirements',
    description: 'Reading and extracting project requirements',
    icon: FileText,
    color: 'primary',
  },
  {
    id: 'analyzing_scope',
    label: 'Analyzing Scope',
    description: 'Understanding complexity and scope',
    icon: Search,
    color: 'purple',
  },
  {
    id: 'mapping_tasks',
    label: 'Mapping Tasks',
    description: 'Breaking down into deliverables',
    icon: Layers,
    color: 'info',
  },
  {
    id: 'estimating_hours',
    label: 'Estimating Hours',
    description: 'Calculating effort for each task',
    icon: Calculator,
    color: 'warning',
  },
  {
    id: 'validating_estimate',
    label: 'Validating Estimate',
    description: 'Cross-checking with historical data',
    icon: BookCheck,
    color: 'success',
  },
];

interface LiveStats {
  requirementsFound: number;
  tasksIdentified: number;
  hoursCalculated: number;
}

interface EstimationGenerationUIProps {
  project: Project;
  onComplete: (quote: Quote) => void;
  onCancel: () => void;
  /** Optional explicit reference URLs to include in the brief (when URL scraping is enabled) */
  referenceUrls?: string[];
  /** When set, backend crawls this URL for same-host pages and includes all in the brief (full-site estimation) */
  crawlSiteFromUrl?: string;
}

// Animated counter hook
function useAnimatedCounter(target: number, duration: number = 1000): number {
  const [count, setCount] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(0);

  useEffect(() => {
    if (target === count) return;
    
    startValueRef.current = count;
    startTimeRef.current = Date.now();
    
    const animate = () => {
      if (startTimeRef.current === null) return;
      
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const easeOutQuad = (t: number) => t * (2 - t);
      const easedProgress = easeOutQuad(progress);
      
      const newValue = Math.round(
        startValueRef.current + (target - startValueRef.current) * easedProgress
      );
      
      setCount(newValue);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [target, duration]);

  return count;
}

// Circular Progress Ring Component
function CircularProgress({ 
  progress, 
  size = 200, 
  strokeWidth = 12 
}: { 
  progress: number; 
  size?: number; 
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="estimation-gen-progress-ring">
      <svg width={size} height={size} className="estimation-gen-progress-svg">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-gray-200)"
          strokeWidth={strokeWidth}
        />
        {/* Gradient definition */}
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-primary-500)" />
            <stop offset="50%" stopColor="var(--color-purple-500)" />
            <stop offset="100%" stopColor="var(--color-primary-600)" />
          </linearGradient>
        </defs>
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="estimation-gen-progress-circle"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="estimation-gen-progress-center">
        <span className="estimation-gen-progress-value">{Math.round(progress)}%</span>
        <span className="estimation-gen-progress-label">Complete</span>
      </div>
    </div>
  );
}

// Step Card — shows step; supports complete, active (during gen), or pending
function StepCard({
  step,
  index,
  isComplete,
  isActive,
  totalTimeSeconds,
  stepCount,
}: {
  step: StepConfig;
  index: number;
  isComplete: boolean;
  isActive: boolean;
  totalTimeSeconds: number | null;
  stepCount: number;
}) {
  const Icon = step.icon;
  const isLast = index === stepCount - 1;
  const showTime = isComplete && isLast && totalTimeSeconds != null;

  return (
    <div
      className={cn(
        'estimation-gen-step-card',
        isComplete && 'complete',
        isActive && 'active',
        !isComplete && !isActive && 'pending'
      )}
    >
      <div className="estimation-gen-step-connector">
        <div
          className={cn(
            'estimation-gen-step-line',
            isComplete && 'complete',
            isActive && 'active'
          )}
        />
      </div>

      <div
        className={cn(
          'estimation-gen-step-icon',
          `color-${step.color}`,
          isComplete && 'complete',
          isActive && 'active'
        )}
      >
        {isComplete ? (
          <CheckCircle className="w-5 h-5" />
        ) : isActive ? (
          <div className="estimation-gen-step-spinner">
            <Icon className="w-5 h-5" />
          </div>
        ) : (
          <Icon className="w-5 h-5" />
        )}
      </div>

      <div className="estimation-gen-step-content">
        <h4 className="estimation-gen-step-label">{step.label}</h4>
        <p className="estimation-gen-step-desc">{step.description}</p>
        {showTime && (
          <span className="estimation-gen-step-time">
            <Clock className="w-3 h-3" />
            Total: {totalTimeSeconds.toFixed(1)}s
          </span>
        )}
      </div>
    </div>
  );
}

// Live Stat Component — value can be number or null (shows "—" while pending)
function LiveStat({
  icon: Icon,
  label,
  value,
  suffix = '',
  color = 'primary',
}: {
  icon: React.ElementType;
  label: string;
  value: number | null;
  suffix?: string;
  color?: string;
}) {
  const animatedValue = useAnimatedCounter(value ?? 0, 800);
  const isPending = value === null;

  return (
    <div className={cn('estimation-gen-stat', `color-${color}`)}>
      <div className="estimation-gen-stat-icon">
        <Icon className="w-5 h-5" />
      </div>
      <div className="estimation-gen-stat-content">
        <span className="estimation-gen-stat-value">
          {isPending ? '—' : `${animatedValue}${suffix}`}
        </span>
        <span className="estimation-gen-stat-label">{label}</span>
      </div>
    </div>
  );
}

export function EstimationGenerationUI({
  project,
  onComplete,
  onCancel,
  referenceUrls,
  crawlSiteFromUrl,
}: EstimationGenerationUIProps) {
  // State
  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalTimeSeconds, setTotalTimeSeconds] = useState<number | null>(null);
  const [liveStats, setLiveStats] = useState<LiveStats>({
    requirementsFound: 0,
    tasksIdentified: 0,
    hoursCalculated: 0,
  });
  const [generationMetadata, setGenerationMetadata] = useState<GenerationMetadataResult | null>(null);
  const [referenceUrlsUsed, setReferenceUrlsUsed] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const hasStartedRef = useRef<boolean>(false);

  // Single progress ramp 0 → 90% over ~45s while waiting (honest: no fake steps)
  useEffect(() => {
    if (!isGenerating || error) return;
    const durationMs = 45_000;
    const interval = 500;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(90, (elapsed / durationMs) * 90);
      setProgress(pct);
    }, interval);
    return () => clearInterval(timer);
  }, [isGenerating, error]);

  // Start generation - with guard against React StrictMode double-mounting
  useEffect(() => {
    // Prevent duplicate API calls in React StrictMode (development)
    // hasStartedRef is reset when retryCount changes
    if (hasStartedRef.current && retryCount === 0) {
      return;
    }
    hasStartedRef.current = true;

    const startGeneration = async () => {
      // Frontend validation before sending request
      const description = project.description?.trim() || '';
      const name = project.name?.trim() || '';

      // Validate project name exists
      if (name.length < 2) {
        setError('Project name is required. Please provide a meaningful project name.');
        setIsGenerating(false);
        return;
      }

      abortControllerRef.current = new AbortController();
      startTimeRef.current = Date.now();

      // Include SOW/source document text from project requirement documents for accurate estimation
      let documentSummary: string | undefined;
      try {
        const requirementDocs = await documentsService.list(project.id, 'requirements');
        const texts = requirementDocs
          .map((d) => d.plain_text?.trim())
          .filter((t): t is string => !!t);
        if (texts.length > 0) {
          documentSummary = texts.join('\n\n---\n\n');
        }
      } catch {
        // Non-blocking: continue without document_summary if list fails
      }

      // Reference URLs: passed from project.reference_urls (auto-extracted at creation) or
      // referenceUrlsUsed (from last quote). Backend also extracts from description, instructions, and docs.
      const request: GenerateQuoteRequest = {
        requirements: description,
        use_rag: true,
        regenerate: true, // Allow regeneration if estimate already exists
        project_context: {
          platform: project.platform,
          project_name: name,
          ...(project.additional_instructions?.trim()
            ? { additional_instructions: project.additional_instructions.trim() }
            : {}),
          ...(documentSummary ? { document_summary: documentSummary } : {}),
          ...(referenceUrls?.length ? { reference_urls: referenceUrls } : {}),
          ...(crawlSiteFromUrl ? { crawl_site_from_url: crawlSiteFromUrl } : {}),
        },
      };

      // Log for debugging
      console.log('[QUOTE_GEN] Starting generation:', {
        projectId: project.id,
        projectName: name,
        requirementsLength: description.length,
        platform: project.platform,
        hasContext: !!request.project_context,
      });

      try {
        const response = await quoteService.generateQuote(project.id, request);
        const quote = response.quote;
        const meta = response.generation_metadata;
        const analysis = meta?.analysis;

        const timeTaken = (Date.now() - startTimeRef.current) / 1000;
        setTotalTimeSeconds(timeTaken);
        setGenerationMetadata(meta ?? null);
        const urlsUsed = (quote.metadata as { reference_urls_used?: string[] } | undefined)?.reference_urls_used;
        setReferenceUrlsUsed(Array.isArray(urlsUsed) ? urlsUsed : []);
        setLiveStats({
          requirementsFound: analysis?.requirements_count ?? 0,
          tasksIdentified: analysis?.tasks_count ?? 0,
          hoursCalculated: quote.total_hours ?? 0,
        });
        setProgress(100);
        setIsGenerating(false);

        setTimeout(() => {
          onComplete(quote);
        }, 1500);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          const errorMessage = err instanceof Error ? err.message : 'Failed to generate estimate';
          setError(errorMessage);
          setIsGenerating(false);
          // Reset progress to show error state clearly
          setProgress(0);
        }
      }
    };

    startGeneration();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [project, retryCount, referenceUrls, crawlSiteFromUrl]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
    onCancel();
  }, [onCancel]);

  const handleRetry = useCallback(() => {
    hasStartedRef.current = false;
    setError(null);
    setIsGenerating(true);
    setProgress(0);
    setTotalTimeSeconds(null);
    setGenerationMetadata(null);
    setReferenceUrlsUsed([]);
    setLiveStats({ requirementsFound: 0, tasksIdentified: 0, hoursCalculated: 0 });
    setRetryCount((prev) => prev + 1);
  }, []);

  // Map time-based progress (0–90%) to an estimated step so the left panel and center message reflect progress
  const estimatedStepIndex = Math.min(
    ANALYSIS_STEPS.length - 1,
    Math.floor((progress / 90) * ANALYSIS_STEPS.length)
  );
  const currentStepLabel = ANALYSIS_STEPS[estimatedStepIndex]?.label ?? 'Generating estimate';

  return (
    <div className="estimation-gen-container">
      {/* Background decoration */}
      <div className="estimation-gen-bg-decoration" />
      
      {/* Header */}
      <header className="estimation-gen-header">
        <div className="estimation-gen-header-left">
          <div className="estimation-gen-ai-badge">
            <Sparkles className="w-4 h-4" />
            <span>AI Estimator</span>
          </div>
          <h1 className="estimation-gen-title">{project.name}</h1>
        </div>
        <button 
          onClick={handleCancel}
          className="estimation-gen-cancel-btn"
          disabled={progress === 100}
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </header>

      {/* Main content */}
      <div className="estimation-gen-content">
        {/* Left: Timeline — summary of steps (all complete only after API returns) */}
        <div className="estimation-gen-timeline">
          <div className="estimation-gen-timeline-header">
            <h2>Generation Progress</h2>
            <p>
              {isGenerating
                ? 'AI is analyzing your project'
                : totalTimeSeconds != null
                  ? `Complete · ${totalTimeSeconds.toFixed(1)}s`
                  : 'Complete'}
            </p>
          </div>

          <div className="estimation-gen-steps">
            {ANALYSIS_STEPS.map((step, index) => (
              <StepCard
                key={step.id}
                step={step}
                index={index}
                isComplete={!isGenerating || index < estimatedStepIndex}
                isActive={isGenerating && index === estimatedStepIndex}
                totalTimeSeconds={!isGenerating ? totalTimeSeconds : null}
                stepCount={ANALYSIS_STEPS.length}
              />
            ))}
          </div>
        </div>

        {/* Center: Progress Ring + current step label */}
        <div className="estimation-gen-center">
          <div className="estimation-gen-ring-container">
            <CircularProgress progress={progress} size={220} strokeWidth={14} />

            {progress === 100 && (
              <div className="estimation-gen-complete-badge">
                <CheckCircle className="w-6 h-6" />
                <span>Complete!</span>
              </div>
            )}
          </div>

          {isGenerating && (
            <div className="estimation-gen-current-step">
              <span className="estimation-gen-current-step-text">
                {currentStepLabel}…
              </span>
              <span className="estimation-gen-current-step-dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="estimation-gen-error">
              <p>{error}</p>
              <button onClick={handleRetry} className="estimation-gen-retry-btn">
                Try Again
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Estimate summary + backend details */}
        <div className="estimation-gen-stats">
          <div className="estimation-gen-stats-header">
            <h2>Estimate Summary</h2>
            <p>Results from this run</p>
          </div>

          <div className="estimation-gen-stats-grid">
            <LiveStat
              icon={FileText}
              label="Requirements Found"
              value={isGenerating ? null : liveStats.requirementsFound}
              color="primary"
            />
            <LiveStat
              icon={ListTodo}
              label="Tasks Identified"
              value={isGenerating ? null : liveStats.tasksIdentified}
              color="purple"
            />
            <LiveStat
              icon={Clock}
              label="Hours Calculated"
              value={isGenerating ? null : liveStats.hoursCalculated}
              suffix="h"
              color="success"
            />
          </div>

          {!isGenerating && referenceUrlsUsed.length > 0 && (
            <p className="estimation-gen-reference-urls-used">
              Reference URLs ({referenceUrlsUsed.length}) were used for this estimate.
            </p>
          )}

          {/* Calibration band + validation warnings + requirements to verify */}
          {!isGenerating && generationMetadata && (
            <div className="estimation-gen-validation-section">
              {generationMetadata.calibration_band && (
                <p className="estimation-gen-calibration-band">
                  <Info className="w-4 h-4 shrink-0" />
                  Similar projects: {Math.round(generationMetadata.calibration_band.min_hours)}–
                  {Math.round(generationMetadata.calibration_band.max_hours)} hours (median{' '}
                  {Math.round(generationMetadata.calibration_band.median_hours)}).
                </p>
              )}
              {generationMetadata.validation_warnings && generationMetadata.validation_warnings.length > 0 && (
                <div className="estimation-gen-warnings">
                  {generationMetadata.validation_warnings.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        'estimation-gen-warning-item',
                        msg.toLowerCase().includes('typical range') || msg.toLowerCase().includes('similar projects')
                          ? 'estimation-gen-warning-calibration'
                          : ''
                      )}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{msg}</span>
                    </div>
                  ))}
                </div>
              )}
              {generationMetadata.requirements_coverage_warnings &&
                generationMetadata.requirements_coverage_warnings.length > 0 && (
                  <div className="estimation-gen-requirements-verify">
                    <h4 className="estimation-gen-requirements-verify-title">
                      Requirements to verify
                    </h4>
                    <ul className="estimation-gen-requirements-verify-list">
                      {generationMetadata.requirements_coverage_warnings.slice(0, 10).map((phrase, i) => (
                        <li key={i}>{phrase}</li>
                      ))}
                      {generationMetadata.requirements_coverage_warnings.length > 10 && (
                        <li className="text-muted-foreground">
                          +{generationMetadata.requirements_coverage_warnings.length - 10} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
            </div>
          )}

          {/* Project info card */}
          <div className="estimation-gen-project-card">
            <h3>Project Details</h3>
            <div className="estimation-gen-project-info">
              <div className="estimation-gen-project-row">
                <span className="label">Input</span>
                <span className="value estimation-gen-input-value">
                  {project.name || '—'} · {(project.description || '').length} chars
                </span>
              </div>
              <div className="estimation-gen-project-row">
                <span className="label">Platform</span>
                <span className="value">{project.platform || 'Not specified'}</span>
              </div>
              <div className="estimation-gen-project-row">
                <span className="label">Created</span>
                <span className="value">Just now</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EstimationGenerationUI;

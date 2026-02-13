/**
 * EstimationGenerationUI Component
 * Modern Gen-Z style estimation generation with vertical timeline,
 * circular progress ring, and live stats counters.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { quoteService } from '@/services/quote-generation.service';
import type { Project, Quote } from '@/types';
import type { GenerateQuoteRequest } from '@/types/quote.types';

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

// Step Card Component
function StepCard({ 
  step, 
  index, 
  currentStep, 
  completedSteps,
  timeTaken 
}: { 
  step: StepConfig;
  index: number;
  currentStep: number;
  completedSteps: number[];
  timeTaken?: number;
}) {
  const Icon = step.icon;
  const isComplete = completedSteps.includes(index);
  const isCurrent = index === currentStep;
  const isPending = index > currentStep;

  return (
    <div 
      className={cn(
        'estimation-gen-step-card',
        isComplete && 'complete',
        isCurrent && 'active',
        isPending && 'pending'
      )}
    >
      <div className="estimation-gen-step-connector">
        <div className={cn(
          'estimation-gen-step-line',
          isComplete && 'complete',
          isCurrent && 'active'
        )} />
      </div>
      
      <div className={cn(
        'estimation-gen-step-icon',
        `color-${step.color}`,
        isComplete && 'complete',
        isCurrent && 'active'
      )}>
        {isComplete ? (
          <CheckCircle className="w-5 h-5" />
        ) : isCurrent ? (
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
        {isComplete && timeTaken !== undefined && (
          <span className="estimation-gen-step-time">
            <Clock className="w-3 h-3" />
            {timeTaken.toFixed(1)}s
          </span>
        )}
      </div>
    </div>
  );
}

// Live Stat Component
function LiveStat({ 
  icon: Icon, 
  label, 
  value, 
  suffix = '',
  color = 'primary'
}: { 
  icon: React.ElementType;
  label: string;
  value: number;
  suffix?: string;
  color?: string;
}) {
  const animatedValue = useAnimatedCounter(value, 800);

  return (
    <div className={cn('estimation-gen-stat', `color-${color}`)}>
      <div className="estimation-gen-stat-icon">
        <Icon className="w-5 h-5" />
      </div>
      <div className="estimation-gen-stat-content">
        <span className="estimation-gen-stat-value">
          {animatedValue}{suffix}
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
}: EstimationGenerationUIProps) {
  const navigate = useNavigate();
  
  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepTimes, setStepTimes] = useState<Record<number, number>>({});
  const [liveStats, setLiveStats] = useState<LiveStats>({
    requirementsFound: 0,
    tasksIdentified: 0,
    hoursCalculated: 0,
  });
  const [retryCount, setRetryCount] = useState(0); // Used to trigger retry
  const [analysisReceived, setAnalysisReceived] = useState(false); // Track if real data received

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const stepStartTimeRef = useRef<number>(Date.now());
  const hasStartedRef = useRef<boolean>(false); // Prevent duplicate API calls in StrictMode

  // Simulate step progression (visual feedback while waiting for API)
  useEffect(() => {
    if (!isGenerating || error) return;

    const stepDuration = 1800; // 1.8 seconds per step
    const progressPerStep = 100 / ANALYSIS_STEPS.length;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const nextProgress = prev + 1.5;
        const currentStepThreshold = (currentStep + 1) * progressPerStep;

        // Update live stats based on progress ONLY if real data hasn't been received
        // These are placeholder animations while waiting for the actual API response
        if (!analysisReceived) {
          if (nextProgress < 20) {
            setLiveStats(s => ({ ...s, requirementsFound: Math.min(Math.floor(nextProgress * 0.3), 5) }));
          } else if (nextProgress < 40) {
            setLiveStats(s => ({ ...s, requirementsFound: Math.min(Math.floor(nextProgress * 0.4), 8), tasksIdentified: Math.min(Math.floor((nextProgress - 20) * 0.2), 4) }));
          } else if (nextProgress < 80) {
            setLiveStats(s => ({ ...s, tasksIdentified: Math.min(Math.floor((nextProgress - 20) * 0.3), 6), hoursCalculated: Math.min(Math.floor((nextProgress - 40) * 2), 80) }));
          }
        }

        // Check if we should advance to next step
        if (nextProgress >= currentStepThreshold && currentStep < ANALYSIS_STEPS.length - 1) {
          const timeTaken = (Date.now() - stepStartTimeRef.current) / 1000;
          setStepTimes(prev => ({ ...prev, [currentStep]: timeTaken }));
          setCompletedSteps(prev => [...prev, currentStep]);
          setCurrentStep(s => s + 1);
          stepStartTimeRef.current = Date.now();
        }

        return Math.min(nextProgress, 95); // Cap at 95% until API completes
      });
    }, stepDuration / (progressPerStep / 1.5));

    return () => clearInterval(timer);
  }, [isGenerating, currentStep, error, analysisReceived]);

  // Start generation - with guard against React StrictMode double-mounting
  useEffect(() => {
    // Prevent duplicate API calls in React StrictMode (development)
    // hasStartedRef is reset when retryCount changes
    if (hasStartedRef.current && retryCount === 0) {
      return;
    }
    hasStartedRef.current = true;

    const startGeneration = async () => {
      abortControllerRef.current = new AbortController();
      stepStartTimeRef.current = Date.now();

      const request: GenerateQuoteRequest = {
        requirements: project.description || '',
        use_rag: true,
        regenerate: true, // Allow regeneration if estimate already exists
        project_context: {
          platform: project.platform,
          project_name: project.name,
        },
      };

      try {
        const response = await quoteService.generateQuote(project.id, request);
        const quote = response.quote;
        const analysis = response.generation_metadata?.analysis;

        // Complete final step
        const timeTaken = (Date.now() - stepStartTimeRef.current) / 1000;
        setStepTimes(prev => ({ ...prev, [currentStep]: timeTaken }));
        setCompletedSteps(prev => [...prev, ANALYSIS_STEPS.length - 1]);
        
        // Set REAL stats from API response
        setAnalysisReceived(true);
        setLiveStats({
          requirementsFound: analysis?.requirements_count || Math.max(5, Math.floor((project.description?.length || 100) / 50)),
          tasksIdentified: analysis?.tasks_count || Math.max(5, Math.floor((quote.total_hours || 100) / 20)),
          hoursCalculated: quote.total_hours || 0,
        });
        
        setProgress(100);
        setIsGenerating(false);

        // Small delay for animation, then complete
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
  }, [project, retryCount]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
    onCancel();
  }, [onCancel]);

  const handleRetry = useCallback(() => {
    // Reset state and trigger new generation via retryCount
    hasStartedRef.current = false;
    setError(null);
    setIsGenerating(true);
    setCurrentStep(0);
    setCompletedSteps([]);
    setProgress(0);
    setStepTimes({});
    setLiveStats({ requirementsFound: 0, tasksIdentified: 0, hoursCalculated: 0 });
    setAnalysisReceived(false);
    setRetryCount(prev => prev + 1); // Trigger useEffect to run again
  }, []);

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
        {/* Left: Vertical Timeline */}
        <div className="estimation-gen-timeline">
          <div className="estimation-gen-timeline-header">
            <h2>Generation Progress</h2>
            <p>AI is analyzing your project</p>
          </div>
          
          <div className="estimation-gen-steps">
            {ANALYSIS_STEPS.map((step, index) => (
              <StepCard
                key={step.id}
                step={step}
                index={index}
                currentStep={currentStep}
                completedSteps={completedSteps}
                timeTaken={stepTimes[index]}
              />
            ))}
          </div>
        </div>

        {/* Center: Progress Ring */}
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

          {/* Current step indicator */}
          {isGenerating && currentStep < ANALYSIS_STEPS.length && (
            <div className="estimation-gen-current-step">
              <span className="estimation-gen-current-step-text">
                {ANALYSIS_STEPS[currentStep].label}
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

        {/* Right: Live Stats */}
        <div className="estimation-gen-stats">
          <div className="estimation-gen-stats-header">
            <h2>Live Analysis</h2>
            <p>Real-time insights</p>
          </div>
          
          <div className="estimation-gen-stats-grid">
            <LiveStat
              icon={FileText}
              label="Requirements Found"
              value={liveStats.requirementsFound}
              color="primary"
            />
            <LiveStat
              icon={ListTodo}
              label="Tasks Identified"
              value={liveStats.tasksIdentified}
              color="purple"
            />
            <LiveStat
              icon={Clock}
              label="Hours Calculated"
              value={liveStats.hoursCalculated}
              suffix="h"
              color="success"
            />
          </div>

          {/* Project info card */}
          <div className="estimation-gen-project-card">
            <h3>Project Details</h3>
            <div className="estimation-gen-project-info">
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

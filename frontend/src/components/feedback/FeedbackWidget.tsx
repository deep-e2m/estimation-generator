import { useState, useCallback } from 'react';
import { useSubmitFeedback, useQuoteFeedback } from '@/hooks/useQuotes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { FeedbackRating, FeedbackCategory, FeedbackSubmission } from '@/types';
import {
  ThumbsUp,
  ThumbsDown,
  Check,
} from 'lucide-react';

interface FeedbackWidgetProps {
  projectId: string;
  quoteId: string;
  compact?: boolean;
}

const feedbackCategories: { value: FeedbackCategory; label: string; description: string }[] = [
  { value: 'accuracy', label: 'Accuracy', description: 'Hour estimates were accurate' },
  { value: 'completeness', label: 'Completeness', description: 'All requirements were covered' },
  { value: 'clarity', label: 'Clarity', description: 'The output was clear and well-organized' },
  { value: 'assumptions', label: 'Assumptions', description: 'Assumptions were reasonable' },
  { value: 'risks', label: 'Risks', description: 'Risks were properly identified' },
  { value: 'formatting', label: 'Formatting', description: 'Document formatting was good' },
  { value: 'speed', label: 'Speed', description: 'Generation was fast enough' },
];

/**
 * Feedback widget with thumbs up/down and optional detailed feedback
 */
export function FeedbackWidget({ projectId, quoteId, compact = false }: FeedbackWidgetProps) {
  const [selectedRating, setSelectedRating] = useState<FeedbackRating | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<FeedbackCategory[]>([]);
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Fetch existing feedback
  const { data: existingFeedback } = useQuoteFeedback(projectId, quoteId);

  // Submit mutation
  const submitFeedback = useSubmitFeedback();

  // Check if user has already submitted feedback
  const hasFeedback = existingFeedback && existingFeedback.length > 0;
  const userFeedback = hasFeedback ? existingFeedback[0] : null;

  const handleRatingClick = useCallback((rating: FeedbackRating) => {
    setSelectedRating(rating);
    setShowDetails(true);
  }, []);

  const toggleCategory = useCallback((category: FeedbackCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedRating) return;

    const feedback: FeedbackSubmission = {
      rating: selectedRating,
      feedback_categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      comment: comment.trim() || undefined,
    };

    try {
      await submitFeedback.mutateAsync({
        projectId,
        quoteId,
        feedback,
      });
      setIsSubmitted(true);
    } catch {
      // Error handled by mutation
    }
  }, [selectedRating, selectedCategories, comment, projectId, quoteId, submitFeedback]);

  const handleCancel = () => {
    setSelectedRating(null);
    setShowDetails(false);
    setSelectedCategories([]);
    setComment('');
  };

  // Show existing feedback if already submitted
  if (hasFeedback && userFeedback && !isSubmitted) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>You rated this:</span>
          {userFeedback.rating === 'positive' ? (
            <span className="flex items-center gap-1 text-green-600">
              <ThumbsUp className="h-4 w-4 fill-current" />
              Helpful
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-600">
              <ThumbsDown className="h-4 w-4 fill-current" />
              Not helpful
            </span>
          )}
        </div>
      </div>
    );
  }

  // Show success message after submission
  if (isSubmitted) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-green-700">
        <Check className="h-5 w-5" />
        <span className="text-sm font-medium">Thank you for your feedback!</span>
      </div>
    );
  }

  // Compact version (just thumbs)
  if (compact && !showDetails) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Was this helpful?</span>
        <button
          onClick={() => handleRatingClick('positive')}
          className={cn(
            'rounded-full p-2 transition-colors',
            selectedRating === 'positive'
              ? 'bg-green-100 text-green-700'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
          )}
          aria-label="Thumbs up - This was helpful"
        >
          <ThumbsUp className="h-5 w-5" />
        </button>
        <button
          onClick={() => handleRatingClick('negative')}
          className={cn(
            'rounded-full p-2 transition-colors',
            selectedRating === 'negative'
              ? 'bg-red-100 text-red-700'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
          )}
          aria-label="Thumbs down - This was not helpful"
        >
          <ThumbsDown className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Rating Buttons */}
      {!showDetails && (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <span className="text-sm text-gray-600">Was this estimate helpful?</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleRatingClick('positive')}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                selectedRating === 'positive'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50'
              )}
            >
              <ThumbsUp className="h-4 w-4" />
              Yes, helpful
            </button>
            <button
              onClick={() => handleRatingClick('negative')}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                selectedRating === 'negative'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-700 hover:border-red-300 hover:bg-red-50'
              )}
            >
              <ThumbsDown className="h-4 w-4" />
              Not helpful
            </button>
          </div>
        </div>
      )}

      {/* Detailed Feedback Form */}
      {showDetails && (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          {/* Selected Rating */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Your rating:</span>
              {selectedRating === 'positive' ? (
                <span className="flex items-center gap-1 text-green-600">
                  <ThumbsUp className="h-4 w-4" />
                  Helpful
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-600">
                  <ThumbsDown className="h-4 w-4" />
                  Not helpful
                </span>
              )}
            </div>
            <button
              onClick={() => setShowDetails(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Change
            </button>
          </div>

          {/* Category Selection */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {selectedRating === 'positive'
                ? 'What was good about it?'
                : 'What could be improved?'}
              <span className="ml-1 font-normal text-gray-400">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {feedbackCategories.map((category) => (
                <button
                  key={category.value}
                  onClick={() => toggleCategory(category.value)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    selectedCategories.includes(category.value)
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  )}
                  title={category.description}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comment Box */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Additional comments
              <span className="ml-1 font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                selectedRating === 'positive'
                  ? 'Tell us what worked well...'
                  : 'Tell us how we can improve...'
              }
              rows={3}
              maxLength={1000}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <p className="mt-1 text-xs text-gray-400">{comment.length}/1000 characters</p>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              isLoading={submitFeedback.isPending}
              disabled={!selectedRating}
            >
              Submit Feedback
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline feedback (for list views)
 */
export function InlineFeedbackButtons({
  projectId,
  quoteId,
  onFeedbackSubmitted,
}: {
  projectId: string;
  quoteId: string;
  onFeedbackSubmitted?: () => void;
}) {
  const submitFeedback = useSubmitFeedback();
  const [submitted, setSubmitted] = useState<FeedbackRating | null>(null);

  const handleQuickFeedback = async (rating: FeedbackRating) => {
    try {
      await submitFeedback.mutateAsync({
        projectId,
        quoteId,
        feedback: { rating },
      });
      setSubmitted(rating);
      onFeedbackSubmitted?.();
    } catch {
      // Error handled by mutation
    }
  };

  if (submitted) {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-500">
        <Check className="h-3 w-3 text-green-500" />
        Thanks!
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleQuickFeedback('positive');
        }}
        disabled={submitFeedback.isPending}
        className="rounded p-1 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600 disabled:opacity-50"
        aria-label="Helpful"
      >
        <ThumbsUp className="h-4 w-4" />
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleQuickFeedback('negative');
        }}
        disabled={submitFeedback.isPending}
        className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        aria-label="Not helpful"
      >
        <ThumbsDown className="h-4 w-4" />
      </button>
    </div>
  );
}

export default FeedbackWidget;

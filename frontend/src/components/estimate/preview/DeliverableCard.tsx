/**
 * DeliverableCard Component
 * Individual deliverable item with progress bar visualization
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Deliverable } from '@/types/quote.types';

interface DeliverableCardProps {
  deliverable: Deliverable;
  totalHours: number;
  isHighlighted?: boolean;
  index?: number;
}

export function DeliverableCard({
  deliverable,
  totalHours,
  isHighlighted = false,
  index = 0,
}: DeliverableCardProps) {
  const expectedHours = deliverable.estimate.expected_hours;
  const percentage = totalHours > 0 ? (expectedHours / totalHours) * 100 : 0;
  
  // Determine color based on percentage
  const getBarColor = () => {
    if (percentage > 20) return 'var(--color-primary-500)';
    if (percentage > 10) return 'var(--color-primary-400)';
    return 'var(--color-primary-300)';
  };

  return (
    <motion.div
      className={cn('deliverable-card', isHighlighted && 'deliverable-card-highlighted')}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
    >
      {/* Header Row */}
      <div className="deliverable-card-header">
        <h4 className="deliverable-card-name">{deliverable.name}</h4>
        <span className="deliverable-card-hours">{expectedHours}h</span>
      </div>

      {/* Description */}
      {deliverable.description && (
        <p className="deliverable-card-desc">{deliverable.description}</p>
      )}

      {/* Progress Bar */}
      <div className="deliverable-card-bar">
        <motion.div
          className="deliverable-card-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          transition={{ duration: 0.5, delay: index * 0.05 + 0.2, ease: 'easeOut' }}
          style={{ backgroundColor: getBarColor() }}
        />
      </div>

      {/* Three-Point Estimates */}
      <div className="deliverable-card-estimates">
        <span className="deliverable-estimate optimistic">
          <span className="deliverable-estimate-label">Opt</span>
          <span className="deliverable-estimate-value">{deliverable.estimate.optimistic_hours}h</span>
        </span>
        <span className="deliverable-estimate expected">
          <span className="deliverable-estimate-label">Expected</span>
          <span className="deliverable-estimate-value">{deliverable.estimate.expected_hours}h</span>
        </span>
        <span className="deliverable-estimate pessimistic">
          <span className="deliverable-estimate-label">Pess</span>
          <span className="deliverable-estimate-value">{deliverable.estimate.pessimistic_hours}h</span>
        </span>
      </div>

      {/* Notes */}
      {deliverable.notes && (
        <p className="deliverable-card-notes">{deliverable.notes}</p>
      )}
    </motion.div>
  );
}

export default DeliverableCard;

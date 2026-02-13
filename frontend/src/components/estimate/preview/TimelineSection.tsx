/**
 * TimelineSection Component
 * Visual timeline with milestones
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Flag, Clock } from 'lucide-react';
import type { QuoteTimeline } from '@/types/quote.types';

interface TimelineSectionProps {
  timeline: QuoteTimeline;
}

export function TimelineSection({ timeline }: TimelineSectionProps) {
  const startDate = new Date(timeline.estimated_start);
  const endDate = new Date(timeline.estimated_end);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.ceil(totalDays / 7);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getMilestonePosition = (dateStr: string) => {
    const date = new Date(dateStr);
    const elapsed = date.getTime() - startDate.getTime();
    const total = endDate.getTime() - startDate.getTime();
    return Math.min(Math.max((elapsed / total) * 100, 0), 100);
  };

  return (
    <div className="timeline-section">
      {/* Duration Summary */}
      <div className="timeline-summary">
        <div className="timeline-summary-item">
          <Clock className="h-4 w-4" />
          <span className="timeline-summary-label">Duration</span>
          <span className="timeline-summary-value">{totalWeeks} weeks</span>
        </div>
        <div className="timeline-summary-item">
          <Calendar className="h-4 w-4" />
          <span className="timeline-summary-label">Start</span>
          <span className="timeline-summary-value">{formatDate(startDate)}</span>
        </div>
        <div className="timeline-summary-item">
          <Flag className="h-4 w-4" />
          <span className="timeline-summary-label">End</span>
          <span className="timeline-summary-value">{formatDate(endDate)}</span>
        </div>
      </div>

      {/* Visual Timeline */}
      <div className="timeline-visual">
        <div className="timeline-track">
          {/* Start marker */}
          <div className="timeline-marker timeline-marker-start">
            <div className="timeline-marker-dot" />
            <span className="timeline-marker-label">{formatDate(startDate)}</span>
          </div>

          {/* Progress bar */}
          <div className="timeline-progress">
            <motion.div
              className="timeline-progress-fill"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>

          {/* Milestones */}
          {timeline.milestones && timeline.milestones.length > 0 && (
            <div className="timeline-milestones">
              {timeline.milestones.map((milestone, index) => (
                <motion.div
                  key={index}
                  className="timeline-milestone"
                  style={{ left: `${getMilestonePosition(milestone.target_date)}%` }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 + 0.5 }}
                >
                  <div className="timeline-milestone-marker" />
                  <div className="timeline-milestone-content">
                    <span className="timeline-milestone-name">{milestone.name}</span>
                    <span className="timeline-milestone-date">
                      {formatDate(new Date(milestone.target_date))}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* End marker */}
          <div className="timeline-marker timeline-marker-end">
            <div className="timeline-marker-dot" />
            <span className="timeline-marker-label">{formatDate(endDate)}</span>
          </div>
        </div>
      </div>

      {/* Milestones List (if any) */}
      {timeline.milestones && timeline.milestones.length > 0 && (
        <div className="timeline-milestones-list">
          <h4 className="timeline-milestones-title">Key Milestones</h4>
          <ul>
            {timeline.milestones.map((milestone, index) => (
              <li key={index} className="timeline-milestone-item">
                <span className="timeline-milestone-item-dot" />
                <span className="timeline-milestone-item-name">{milestone.name}</span>
                <span className="timeline-milestone-item-date">
                  {formatDate(new Date(milestone.target_date))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default TimelineSection;

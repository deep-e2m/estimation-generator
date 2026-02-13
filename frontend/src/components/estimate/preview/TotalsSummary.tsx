/**
 * TotalsSummary Component
 * Summary card with estimated totals and confidence
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import type { QuoteTotals, QuoteTimeline } from '@/types/quote.types';

interface TotalsSummaryProps {
  totals: QuoteTotals;
  timeline?: QuoteTimeline;
  confidence?: number;
}

export function TotalsSummary({ totals, timeline, confidence }: TotalsSummaryProps) {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 0.8) return { label: 'High', color: 'success' };
    if (score >= 0.6) return { label: 'Medium', color: 'warning' };
    return { label: 'Low', color: 'error' };
  };

  const getDuration = () => {
    if (!timeline) return null;
    const start = new Date(timeline.estimated_start);
    const end = new Date(timeline.estimated_end);
    const weeks = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
    return `${weeks} weeks`;
  };

  const confidenceInfo = confidence ? getConfidenceLabel(confidence) : null;
  const duration = getDuration();

  return (
    <motion.div
      className="totals-summary"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="totals-summary-header">
        <h3 className="totals-summary-title">Estimated Totals</h3>
        {confidenceInfo && (
          <span className={`totals-confidence totals-confidence-${confidenceInfo.color}`}>
            <TrendingUp className="h-3 w-3" />
            {confidenceInfo.label} Confidence ({Math.round(confidence! * 100)}%)
          </span>
        )}
      </div>

      <div className="totals-grid">
        {/* Expected Hours */}
        <div className="totals-card totals-card-primary">
          <div className="totals-card-icon">
            <Clock className="h-5 w-5" />
          </div>
          <div className="totals-card-content">
            <span className="totals-card-value">
              {totals.total_expected_hours.toLocaleString()}h
            </span>
            <span className="totals-card-label">Expected Hours</span>
          </div>
        </div>

        {/* Total Cost */}
        {totals.total_cost > 0 && (
          <div className="totals-card totals-card-success">
            <div className="totals-card-icon">
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="totals-card-content">
              <span className="totals-card-value">
                {formatCurrency(totals.total_cost, totals.currency)}
              </span>
              <span className="totals-card-label">
                Estimated Cost
                {totals.hourly_rate > 0 && (
                  <span className="totals-card-subtext">
                    @ {formatCurrency(totals.hourly_rate, totals.currency)}/hr
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Duration */}
        {duration && (
          <div className="totals-card totals-card-info">
            <div className="totals-card-icon">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="totals-card-content">
              <span className="totals-card-value">{duration}</span>
              <span className="totals-card-label">Timeline</span>
            </div>
          </div>
        )}
      </div>

      {/* Three-point estimate breakdown */}
      <div className="totals-breakdown">
        <div className="totals-breakdown-item">
          <span className="totals-breakdown-label">Optimistic</span>
          <span className="totals-breakdown-value optimistic">
            {totals.total_optimistic_hours}h
          </span>
        </div>
        <div className="totals-breakdown-item">
          <span className="totals-breakdown-label">Most Likely</span>
          <span className="totals-breakdown-value likely">
            {totals.total_most_likely_hours}h
          </span>
        </div>
        <div className="totals-breakdown-item">
          <span className="totals-breakdown-label">Pessimistic</span>
          <span className="totals-breakdown-value pessimistic">
            {totals.total_pessimistic_hours}h
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default TotalsSummary;

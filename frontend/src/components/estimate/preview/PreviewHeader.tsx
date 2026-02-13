/**
 * PreviewHeader Component
 * Dashboard-style header with metrics for the preview panel
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Package,
  FileText,
  Download,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Quote } from '@/types';

interface PreviewHeaderProps {
  quote: Quote;
  onExportClick?: () => void;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  color: 'primary' | 'success' | 'warning' | 'info' | 'neutral';
  trend?: { value: number; isPositive: boolean };
  delay?: number;
}

const colorClasses = {
  primary: 'metric-card-primary',
  success: 'metric-card-success',
  warning: 'metric-card-warning',
  info: 'metric-card-info',
  neutral: 'metric-card-neutral',
};

function MetricCard({
  label,
  value,
  subtext,
  icon,
  color,
  trend,
  delay = 0,
}: MetricCardProps) {
  return (
    <motion.div
      className={cn('preview-metric-card', colorClasses[color])}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <div className="preview-metric-icon">{icon}</div>
      <div className="preview-metric-content">
        <span className="preview-metric-value">{value}</span>
        <span className="preview-metric-label">{label}</span>
        {subtext && <span className="preview-metric-subtext">{subtext}</span>}
        {trend && (
          <span
            className={cn(
              'preview-metric-trend',
              trend.isPositive ? 'positive' : 'negative'
            )}
          >
            <TrendingUp
              className={cn('h-3 w-3', !trend.isPositive && 'rotate-180')}
            />
            {trend.value > 0 ? '+' : ''}
            {trend.value}h
          </span>
        )}
      </div>
    </motion.div>
  );
}

function getStatusInfo(status: string): {
  label: string;
  color: 'primary' | 'success' | 'warning' | 'info' | 'neutral';
  icon: React.ReactNode;
} {
  switch (status) {
    case 'draft':
      return {
        label: 'Draft',
        color: 'neutral',
        icon: <FileText className="h-5 w-5" />,
      };
    case 'finalized':
      return {
        label: 'Finalized',
        color: 'success',
        icon: <CheckCircle className="h-5 w-5" />,
      };
    case 'generating':
      return {
        label: 'Generating',
        color: 'primary',
        icon: <Clock className="h-5 w-5" />,
      };
    case 'sent':
      return {
        label: 'Sent',
        color: 'info',
        icon: <FileText className="h-5 w-5" />,
      };
    default:
      return {
        label: status || 'Draft',
        color: 'neutral',
        icon: <FileText className="h-5 w-5" />,
      };
  }
}

export function PreviewHeader({ quote, onExportClick }: PreviewHeaderProps) {
  const totalHours =
    quote.total_hours ??
    quote.content?.totals?.total_expected_hours ??
    0;
  
  const deliverablesCount = quote.content?.deliverables?.length ?? 0;
  const risksCount = quote.content?.risks?.length ?? 0;
  const statusInfo = getStatusInfo(quote.status);

  return (
    <motion.div
      className="preview-header"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header Top Row */}
      <div className="preview-header-top">
        <div className="preview-header-title">
          <h3>Estimate Overview</h3>
          <span className="preview-header-quote-number">
            {quote.quote_number || `EST-${quote.id?.slice(0, 8).toUpperCase()}`}
          </span>
        </div>
        
        {onExportClick && (
          <motion.button
            className="preview-export-btn"
            onClick={onExportClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
            <ChevronDown className="h-3 w-3" />
          </motion.button>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="preview-metrics-grid">
        <MetricCard
          label="Total Hours"
          value={totalHours > 0 ? `${totalHours}h` : '—'}
          subtext="Expected effort"
          icon={<Clock className="h-5 w-5" />}
          color="primary"
          delay={0}
        />
        <MetricCard
          label="Deliverables"
          value={deliverablesCount > 0 ? deliverablesCount : '—'}
          subtext={deliverablesCount > 0 ? 'Line items' : 'No items'}
          icon={<Package className="h-5 w-5" />}
          color="success"
          delay={0.1}
        />
        <MetricCard
          label="Status"
          value={statusInfo.label}
          icon={statusInfo.icon}
          color={statusInfo.color}
          delay={0.2}
        />
        {risksCount > 0 && (
          <MetricCard
            label="Risks"
            value={risksCount}
            subtext="Identified"
            icon={<AlertTriangle className="h-5 w-5" />}
            color="warning"
            delay={0.3}
          />
        )}
      </div>

      {/* Last Updated */}
      <div className="preview-header-footer">
        <span className="preview-last-updated">
          Last updated: {formatRelativeTime(quote.updated_at)}
        </span>
        {quote.generation_metadata?.confidence_score && (
          <span className="preview-confidence">
            Confidence: {Math.round(quote.generation_metadata.confidence_score * 100)}%
          </span>
        )}
      </div>
    </motion.div>
  );
}

export default PreviewHeader;

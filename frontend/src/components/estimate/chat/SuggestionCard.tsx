/**
 * SuggestionCard Component
 * Interactive card for quick action suggestions in the chat empty state
 */

import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SuggestionCardProps {
  icon: LucideIcon;
  title: string;
  example: string;
  onClick: (example: string) => void;
  color?: 'primary' | 'success' | 'warning' | 'info';
  delay?: number;
}

const colorVariants = {
  primary: {
    bg: 'var(--color-primary-50)',
    border: 'var(--color-primary-200)',
    iconBg: 'var(--color-primary-100)',
    iconColor: 'var(--color-primary-600)',
    hoverBorder: 'var(--color-primary-400)',
  },
  success: {
    bg: 'var(--color-success-50)',
    border: 'var(--color-success-200)',
    iconBg: 'var(--color-success-100)',
    iconColor: 'var(--color-success-600)',
    hoverBorder: 'var(--color-success-400)',
  },
  warning: {
    bg: 'var(--color-warning-50)',
    border: 'var(--color-warning-200)',
    iconBg: 'var(--color-warning-100)',
    iconColor: 'var(--color-warning-600)',
    hoverBorder: 'var(--color-warning-400)',
  },
  info: {
    bg: 'var(--color-info-50)',
    border: 'var(--color-info-200)',
    iconBg: 'var(--color-info-100)',
    iconColor: 'var(--color-info-600)',
    hoverBorder: 'var(--color-info-400)',
  },
};

export function SuggestionCard({
  icon: Icon,
  title,
  example,
  onClick,
  color = 'primary',
  delay = 0,
}: SuggestionCardProps) {
  const colors = colorVariants[color];

  return (
    <motion.button
      className="suggestion-card"
      onClick={() => onClick(example)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      style={{
        '--suggestion-bg': colors.bg,
        '--suggestion-border': colors.border,
        '--suggestion-icon-bg': colors.iconBg,
        '--suggestion-icon-color': colors.iconColor,
        '--suggestion-hover-border': colors.hoverBorder,
      } as React.CSSProperties}
    >
      <div className="suggestion-card-icon">
        <Icon className="h-5 w-5" />
      </div>
      <div className="suggestion-card-content">
        <span className="suggestion-card-title">{title}</span>
        <span className="suggestion-card-example">"{example}"</span>
      </div>
    </motion.button>
  );
}

export default SuggestionCard;

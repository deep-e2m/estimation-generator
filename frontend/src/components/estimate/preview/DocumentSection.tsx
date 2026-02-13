/**
 * DocumentSection Component
 * Collapsible section for the quote document
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentSectionProps {
  number: string;
  title: string;
  icon?: React.ReactNode;
  badge?: string | number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  isHighlighted?: boolean;
  onToggle?: (expanded: boolean) => void;
}

export function DocumentSection({
  number,
  title,
  icon,
  badge,
  children,
  defaultExpanded = true,
  isHighlighted = false,
  onToggle,
}: DocumentSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    onToggle?.(newState);
  };

  return (
    <motion.div
      className={cn(
        'document-section',
        isExpanded && 'document-section-expanded',
        isHighlighted && 'document-section-highlighted'
      )}
      initial={false}
      animate={isHighlighted ? { backgroundColor: ['rgba(59, 130, 246, 0.1)', 'transparent'] } : {}}
      transition={{ duration: 2 }}
    >
      {/* Section Header */}
      <button
        className="document-section-header"
        onClick={handleToggle}
        aria-expanded={isExpanded}
      >
        <div className="document-section-header-left">
          <span className="document-section-number">{number}</span>
          {icon && <span className="document-section-icon">{icon}</span>}
          <h3 className="document-section-title">{title}</h3>
        </div>
        
        <div className="document-section-header-right">
          {badge !== undefined && (
            <span className="document-section-badge">{badge}</span>
          )}
          <span className="document-section-chevron">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        </div>
      </button>

      {/* Section Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            className="document-section-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className="document-section-content-inner">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default DocumentSection;

/**
 * ChangesSummary Component
 * Visual summary of changes made to the quote
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChangeDescription } from '@/types/quote.types';

interface ChangesSummaryProps {
  changes: ChangeDescription[];
  compact?: boolean;
}

const changeTypeConfig = {
  added: {
    icon: Plus,
    label: 'Added',
    className: 'change-added',
  },
  updated: {
    icon: Pencil,
    label: 'Updated',
    className: 'change-updated',
  },
  removed: {
    icon: Trash2,
    label: 'Removed',
    className: 'change-removed',
  },
};

export function ChangesSummary({ changes, compact = false }: ChangesSummaryProps) {
  if (!changes || changes.length === 0) return null;

  return (
    <motion.div
      className={cn('changes-summary', compact && 'changes-summary-compact')}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.3 }}
    >
      <div className="changes-summary-header">
        <span className="changes-summary-title">Changes Applied</span>
        <span className="changes-summary-count">{changes.length}</span>
      </div>
      
      <ul className="changes-summary-list">
        {changes.map((change, index) => {
          const config = changeTypeConfig[change.change_type];
          const Icon = config.icon;
          
          return (
            <motion.li
              key={`${change.section}-${index}`}
              className={cn('changes-summary-item', config.className)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <div className="changes-summary-item-icon">
                <Icon className="h-3 w-3" />
              </div>
              <div className="changes-summary-item-content">
                <span className="changes-summary-item-section">{change.section}</span>
                {!compact && change.description && (
                  <span className="changes-summary-item-desc">{change.description}</span>
                )}
              </div>
              <span className="changes-summary-item-badge">{config.label}</span>
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
}

export default ChangesSummary;

/**
 * ScopeSection Component
 * Displays included and excluded items in the scope
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import type { QuoteScope } from '@/types/quote.types';

interface ScopeSectionProps {
  scope: QuoteScope;
}

export function ScopeSection({ scope }: ScopeSectionProps) {
  const hasIncluded = scope.included && scope.included.length > 0;
  const hasExcluded = scope.excluded && scope.excluded.length > 0;

  if (!hasIncluded && !hasExcluded) {
    return (
      <div className="scope-empty">
        <p>No scope defined yet</p>
      </div>
    );
  }

  return (
    <div className="scope-section">
      {/* Included Items */}
      {hasIncluded && (
        <div className="scope-group scope-included">
          <h4 className="scope-group-title">
            <span className="scope-group-icon included">
              <Check className="h-3 w-3" />
            </span>
            Included
            <span className="scope-group-count">{scope.included.length}</span>
          </h4>
          <ul className="scope-list">
            {scope.included.map((item, index) => (
              <motion.li
                key={index}
                className="scope-item scope-item-included"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
              >
                <span className="scope-item-icon">
                  <Check className="h-3 w-3" />
                </span>
                <span className="scope-item-text">{item}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      {/* Excluded Items */}
      {hasExcluded && (
        <div className="scope-group scope-excluded">
          <h4 className="scope-group-title">
            <span className="scope-group-icon excluded">
              <X className="h-3 w-3" />
            </span>
            Excluded
            <span className="scope-group-count">{scope.excluded.length}</span>
          </h4>
          <ul className="scope-list">
            {scope.excluded.map((item, index) => (
              <motion.li
                key={index}
                className="scope-item scope-item-excluded"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
              >
                <span className="scope-item-icon">
                  <X className="h-3 w-3" />
                </span>
                <span className="scope-item-text">{item}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ScopeSection;

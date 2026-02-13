/**
 * DeliverablesList Component
 * Groups and displays deliverables by category
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Package } from 'lucide-react';
import { DeliverableCard } from './DeliverableCard';
import type { Deliverable, ChangeDescription } from '@/types/quote.types';

interface DeliverablesListProps {
  deliverables: Deliverable[];
  totalHours: number;
  recentChanges?: ChangeDescription[];
}

export function DeliverablesList({
  deliverables,
  totalHours,
  recentChanges = [],
}: DeliverablesListProps) {
  // Group deliverables by category
  const groupedDeliverables = useMemo(() => {
    const groups: Record<string, Deliverable[]> = {};
    
    deliverables.forEach((deliverable) => {
      const category = deliverable.category || 'General';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(deliverable);
    });

    return groups;
  }, [deliverables]);

  // Check if a deliverable was recently changed
  const isHighlighted = (deliverableId: string) => {
    return recentChanges.some(
      (change) =>
        change.field_path?.includes(deliverableId) ||
        change.section.toLowerCase().includes('deliverable')
    );
  };

  // Calculate category totals
  const getCategoryTotal = (items: Deliverable[]) => {
    return items.reduce((sum, d) => sum + d.estimate.expected_hours, 0);
  };

  const categories = Object.entries(groupedDeliverables);

  if (deliverables.length === 0) {
    return (
      <div className="deliverables-empty">
        <Package className="h-8 w-8 text-gray-300" />
        <p>No deliverables defined yet</p>
      </div>
    );
  }

  return (
    <div className="deliverables-list">
      {categories.map(([category, items], categoryIndex) => (
        <motion.div
          key={category}
          className="deliverables-category"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: categoryIndex * 0.1 }}
        >
          {/* Category Header */}
          <div className="deliverables-category-header">
            <h4 className="deliverables-category-title">
              {categoryIndex + 1}.{categories.length > 1 ? (categoryIndex + 1) : ''} {category}
            </h4>
            <span className="deliverables-category-total">
              {getCategoryTotal(items)}h total
            </span>
          </div>

          {/* Category Items */}
          <div className="deliverables-category-items">
            {items.map((deliverable, index) => (
              <DeliverableCard
                key={deliverable.id}
                deliverable={deliverable}
                totalHours={totalHours}
                isHighlighted={isHighlighted(deliverable.id)}
                index={index}
              />
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default DeliverablesList;

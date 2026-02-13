/**
 * EstimationPreviewPanel Component
 * Right panel of the split view - live quote preview only (no duplicate overview header)
 */

import React from 'react';
import { QuoteDocument } from './preview/QuoteDocument';
import type { Quote } from '@/types';
import type { ChangeDescription } from '@/types/quote.types';

interface EstimationPreviewPanelProps {
  quote: Quote;
  recentChanges?: ChangeDescription[];
}

export function EstimationPreviewPanel({
  quote,
}: EstimationPreviewPanelProps) {
  return (
    <div className="estimation-preview-panel">
      <div className="estimation-preview-content">
        <QuoteDocument quote={quote} />
      </div>
    </div>
  );
}

export default EstimationPreviewPanel;

/**
 * EstimationPreviewPanel Component
 * Right panel of the split view - live quote preview with rich document format
 */

import React from 'react';
import { PreviewHeader } from './preview/PreviewHeader';
import { QuoteDocument } from './preview/QuoteDocument';
import type { Quote } from '@/types';
import type { ChangeDescription } from '@/types/quote.types';

interface EstimationPreviewPanelProps {
  quote: Quote;
  recentChanges: ChangeDescription[];
}

export function EstimationPreviewPanel({
  quote,
  recentChanges,
}: EstimationPreviewPanelProps) {
  return (
    <div className="estimation-preview-panel">
      {/* Dashboard-style Header */}
      <PreviewHeader quote={quote} />

      {/* Rich Document Content */}
      <div className="estimation-preview-content">
        <QuoteDocument quote={quote} recentChanges={recentChanges} />
      </div>
    </div>
  );
}

export default EstimationPreviewPanel;

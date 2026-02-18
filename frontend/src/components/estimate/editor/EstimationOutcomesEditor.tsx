import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ESTIMATION_OUTCOMES_KEYS,
  ESTIMATION_OUTCOMES_LABELS,
} from '@/constants/estimation-outcomes';
import type { EstimationOutcomes, Quote } from '@/types';

export interface EstimationOutcomesEditorProps {
  quote: Quote;
  onContentChange: (serialized: string) => void;
  onSave: (serialized: string) => Promise<void>;
  readOnly?: boolean;
}

/**
 * Editor for key-value estimation outcomes. Renders one block per section key
 * so editing one section does not affect others.
 */
export function EstimationOutcomesEditor({
  quote,
  onContentChange,
  onSave,
  readOnly = false,
}: EstimationOutcomesEditorProps) {
  const outcomes = quote.content?.estimation_outcomes ?? {};
  const [values, setValues] = useState<EstimationOutcomes>(() => {
    const initial: EstimationOutcomes = {};
    for (const key of ESTIMATION_OUTCOMES_KEYS) {
      initial[key] = outcomes[key] ?? '';
    }
    return initial;
  });

  // Sync from quote when it changes (e.g. after save or load)
  useEffect(() => {
    const source = quote.content?.estimation_outcomes ?? {};
    const next: EstimationOutcomes = {};
    for (const key of ESTIMATION_OUTCOMES_KEYS) {
      next[key] = source[key] ?? '';
    }
    setValues(next);
  }, [quote.id, quote.updated_at, quote.content?.estimation_outcomes]);

  const serialized = useMemo(() => JSON.stringify(values), [values]);

  const handleChange = useCallback(
    (key: string, value: string) => {
      setValues((prev) => {
        const next = { ...prev, [key]: value };
        onContentChange(JSON.stringify(next));
        return next;
      });
    },
    [onContentChange]
  );

  const handleSave = useCallback(async () => {
    await onSave(serialized);
  }, [onSave, serialized]);

  useEffect(() => {
    if (readOnly) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readOnly, handleSave]);

  return (
    <div className="estimation-outcomes-editor space-y-6">
      {ESTIMATION_OUTCOMES_KEYS.map((key) => (
        <section key={key} className="estimation-outcomes-section">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {ESTIMATION_OUTCOMES_LABELS[key] ?? key}
          </label>
          {readOnly ? (
            <div className="doc-body-text whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50/50 px-3 py-2 text-gray-800 min-h-[2.5rem]">
              {values[key] || '—'}
            </div>
          ) : (
            <textarea
              className="w-full min-h-[80px] rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-y"
              value={values[key] ?? ''}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={`Enter ${ESTIMATION_OUTCOMES_LABELS[key] ?? key}...`}
              rows={key === 'website_structure' || key === 'assumptions' ? 6 : 3}
            />
          )}
        </section>
      ))}
    </div>
  );
}

export default EstimationOutcomesEditor;

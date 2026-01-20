/**
 * Custom hook for auto-save functionality
 * Provides debounced auto-save with status tracking
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { debounce } from '../lib/utils';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseAutoSaveReturn {
  status: AutoSaveStatus;
  lastSaved: Date | null;
  error: string | null;
  save: () => Promise<void>;
  isSaving: boolean;
}

export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = 2000,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dataRef = useRef(data);
  const saveRef = useRef(onSave);
  const enabledRef = useRef(enabled);

  // Keep refs up to date
  useEffect(() => {
    dataRef.current = data;
    saveRef.current = onSave;
    enabledRef.current = enabled;
  }, [data, onSave, enabled]);

  /**
   * Perform the save operation
   */
  const performSave = useCallback(async () => {
    if (!enabledRef.current) return;

    setStatus('saving');
    setError(null);

    try {
      await saveRef.current(dataRef.current);
      setStatus('saved');
      setLastSaved(new Date());

      // Reset to idle after 2 seconds
      setTimeout(() => {
        setStatus((current) => (current === 'saved' ? 'idle' : current));
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save';
      setStatus('error');
      setError(errorMessage);
    }
  }, []);

  /**
   * Debounced save function
   */
  const debouncedSave = useCallback(
    debounce(() => {
      performSave();
    }, debounceMs),
    [performSave, debounceMs]
  );

  /**
   * Trigger auto-save when data changes
   */
  useEffect(() => {
    if (enabled) {
      debouncedSave();
    }
  }, [data, enabled, debouncedSave]);

  /**
   * Manual save function
   */
  const save = useCallback(async () => {
    await performSave();
  }, [performSave]);

  return {
    status,
    lastSaved,
    error,
    save,
    isSaving: status === 'saving',
  };
}

export default useAutoSave;

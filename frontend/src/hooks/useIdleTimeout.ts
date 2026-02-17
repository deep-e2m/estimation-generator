/**
 * Idle timeout hook: calls onIdle after no activity for timeoutMinutes.
 * Activity = user events (click, keydown, touchstart, scroll) or API requests (user-activity event).
 * Used so the user stays logged in while active and is logged out only after 1 hour of inactivity.
 */

import { useEffect, useRef, useCallback } from 'react';

const ACTIVITY_EVENT = 'user-activity';

const ACTIVITY_EVENTS = ['click', 'keydown', 'touchstart'] as const;

/** Throttle (ms) for scroll so we don't reset the timer on every scroll tick. */
const SCROLL_THROTTLE_MS = 2000;

export interface UseIdleTimeoutOptions {
  /** Minutes of inactivity before onIdle is called. Default 60. */
  timeoutMinutes?: number;
  /** Called when the idle timeout is reached (no activity for timeoutMinutes). */
  onIdle: () => void;
  /** If false, the idle timer is paused. Default true. */
  enabled?: boolean;
}

export function useIdleTimeout({
  timeoutMinutes = 60,
  onIdle,
  enabled = true,
}: UseIdleTimeoutOptions): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    clearTimer();
    if (!enabled) return;
    const ms = timeoutMinutes * 60 * 1000;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onIdleRef.current();
    }, ms);
  }, [enabled, timeoutMinutes, clearTimer]);

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      return;
    }

    resetTimer();

    const handleActivity = () => resetTimer();

    let scrollScheduled = false;
    const handleScroll = () => {
      if (scrollScheduled) return;
      scrollScheduled = true;
      resetTimer();
      setTimeout(() => {
        scrollScheduled = false;
      }, SCROLL_THROTTLE_MS);
    };

    ACTIVITY_EVENTS.forEach((ev) => document.addEventListener(ev, handleActivity));
    window.addEventListener(ACTIVITY_EVENT, handleActivity);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      clearTimer();
      ACTIVITY_EVENTS.forEach((ev) => document.removeEventListener(ev, handleActivity));
      window.removeEventListener(ACTIVITY_EVENT, handleActivity);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [enabled, timeoutMinutes, resetTimer, clearTimer]);
}

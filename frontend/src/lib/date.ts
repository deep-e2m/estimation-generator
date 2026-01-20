import {
  format,
  formatDistanceToNow,
  parseISO,
  isValid,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
} from 'date-fns';

/**
 * Parse an ISO date string safely
 */
export function parseDate(dateString: string): Date | null {
  try {
    const date = parseISO(dateString);
    return isValid(date) ? date : null;
  } catch {
    return null;
  }
}

/**
 * Format a date for display
 */
export function formatDate(
  dateString: string,
  formatString: string = 'MMM d, yyyy'
): string {
  const date = parseDate(dateString);
  if (!date) return 'Invalid date';
  return format(date, formatString);
}

/**
 * Format a date with time
 */
export function formatDateTime(dateString: string): string {
  return formatDate(dateString, 'MMM d, yyyy h:mm a');
}

/**
 * Format a date as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = parseDate(dateString);
  if (!date) return 'Invalid date';
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Get a smart date format - relative for recent, absolute for older
 */
export function formatSmartDate(dateString: string): string {
  const date = parseDate(dateString);
  if (!date) return 'Invalid date';

  const now = new Date();
  const daysDiff = differenceInDays(now, date);

  if (daysDiff < 1) {
    const hoursDiff = differenceInHours(now, date);
    if (hoursDiff < 1) {
      const minutesDiff = differenceInMinutes(now, date);
      if (minutesDiff < 1) return 'Just now';
      return `${minutesDiff}m ago`;
    }
    return `${hoursDiff}h ago`;
  }

  if (daysDiff < 7) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  if (daysDiff < 365) {
    return format(date, 'MMM d');
  }

  return format(date, 'MMM d, yyyy');
}

/**
 * Format a date for input fields
 */
export function formatDateForInput(dateString: string): string {
  return formatDate(dateString, 'yyyy-MM-dd');
}

/**
 * Check if a date is in the past
 */
export function isPastDate(dateString: string): boolean {
  const date = parseDate(dateString);
  if (!date) return false;
  return date < new Date();
}

/**
 * Get the date range label
 */
export function getDateRangeLabel(from: string, to: string): string {
  const fromFormatted = formatDate(from, 'MMM d');
  const toFormatted = formatDate(to, 'MMM d, yyyy');
  return `${fromFormatted} - ${toFormatted}`;
}

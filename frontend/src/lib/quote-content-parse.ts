/**
 * Parse quote content (markdown text) to derive total hours and requirements/deliverables
 * count when the API does not provide them (e.g. quote.total_hours is 0 or metadata.breakdown is empty).
 * Used by project detail stat cards so "Total Hours" and "Requirements" show values from the document.
 */

/**
 * Get the raw markdown string from quote content (executive_summary holds full document when content is markdown).
 */
function getContentText(content: { executive_summary?: string } | null | undefined): string {
  if (!content?.executive_summary) return '';
  return typeof content.executive_summary === 'string' ? content.executive_summary : '';
}

/**
 * Parse "X - Y hours" or "X–Y hours" or "**X - Y hours**" from content; returns midpoint or single value.
 * Returns 0 if no match.
 */
export function parseTotalHoursFromContent(content: { executive_summary?: string } | null | undefined): number {
  const text = getContentText(content);
  if (!text) return 0;

  // Range: "80 - 100 hours", "80–100 hours", "80 to 100 hours", optional bold/markdown
  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*[-–—to]+\s*(\d+(?:\.\d+)?)\s*hours?/i);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) return (min + max) / 2;
  }

  // Single value: "100 hours", "Estimated: 80 hours"
  const singleMatch = text.match(/(?:total|estimated|effort)[^\d]*(\d+(?:\.\d+)?)\s*hours?|(\d+(?:\.\d+)?)\s*hours?(?:\s*(?:total|estimated))?/i);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1] || singleMatch[2] || '0');
    if (Number.isFinite(val)) return val;
  }

  return 0;
}

/**
 * Count deliverable/requirement-like items in content: numbered subsections (2.1, 2.2) and bullet points.
 * Used when metadata.breakdown is empty so the Requirements card still shows a meaningful count.
 */
export function parseRequirementsCountFromContent(content: { executive_summary?: string } | null | undefined): number {
  const text = getContentText(content);
  if (!text) return 0;

  // Numbered subsections: 2.1, 2.2, 3.1, 7.1 etc.
  const subsectionMatches = text.matchAll(/\d+\.\d+(?:\s|$)/g);
  const subsectionCount = [...subsectionMatches].length;

  // Bullet points: "- Item" or "* Item" at line start
  const bulletMatches = text.matchAll(/^\s*[-*]\s+\S/gm);
  const bulletCount = [...bulletMatches].length;

  // Prefer subsection count (more structured); if none, use bullet count; otherwise 0
  if (subsectionCount > 0) return subsectionCount;
  if (bulletCount > 0) return bulletCount;
  return 0;
}

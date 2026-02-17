/**
 * Utilities for quote document preview.
 * Ensures "Estimated Effort & Timeline" is never blank when we have total hours.
 */

/**
 * Detects the "Estimated Effort & Timeline" section header (markdown).
 * Matches: "### 4. Estimated Effort & Timeline", "7. Estimated Effort & Timeline", etc.
 */
function isEstimatedEffortHeader(line: string): boolean {
  const t = line.trim();
  return (
    (/^#{1,4}\s*\d+\.\s+.+Estimated Effort.+/i.test(t) ||
      /^\d+\.\s+Estimated Effort.+/i.test(t)) &&
    /Estimated Effort/i.test(t)
  );
}

/**
 * Detects the start of a following section (next numbered heading).
 */
function isSectionStart(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return /^#{1,4}\s*\d+\.\s/.test(t) || /^\d+\.\s+[A-Za-z]/.test(t);
}

/**
 * If the "Estimated Effort & Timeline" section exists but has no content
 * (blank until the next section), inject fallback text using total_hours.
 * Only modifies markdown body; does not change HTML.
 */
export function ensureEstimatedEffortSection(body: string, totalHours: number): string {
  if (!body || totalHours <= 0) return body;

  const hours = Math.round(totalHours);
  const weeksMin = Math.max(1, Math.ceil(hours / 40));
  const weeksMax = Math.max(weeksMin, Math.ceil(hours / 20));
  const weeksStr = weeksMin === weeksMax ? `${weeksMin}` : `${weeksMin}–${weeksMax}`;
  const fallback =
    `\n\n**Estimated Total Effort**\n${hours} hours\n\n**Estimated Timeline**\n${weeksStr} weeks from project kickoff, subject to timely client feedback and content availability.\n\n`;

  const lines = body.split('\n');
  let sectionStartIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (isEstimatedEffortHeader(lines[i])) {
      sectionStartIndex = i;
      break;
    }
  }

  if (sectionStartIndex === -1) return body;

  let nextSectionIndex = lines.length;
  for (let j = sectionStartIndex + 1; j < lines.length; j++) {
    if (isSectionStart(lines[j])) {
      nextSectionIndex = j;
      break;
    }
  }

  const between = lines.slice(sectionStartIndex + 1, nextSectionIndex).join('\n');
  if (!between.trim()) {
    const before = lines.slice(0, sectionStartIndex + 1).join('\n');
    const after = lines.slice(nextSectionIndex).join('\n');
    return before + fallback + after;
  }

  return body;
}

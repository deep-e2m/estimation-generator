/**
 * Utilities for quote document preview.
 * Ensures "Estimated Effort & Timeline" is never blank when we have total hours.
 */

/**
 * Detects the "Estimated Effort & Timeline" section header (markdown).
 * Matches: "### 4. Estimated Effort & Timeline", "7. Estimated Effort & Timeline",
 * "**4 Estimated Effort & Timeline**" (bold without dot), etc.
 */
function isEstimatedEffortHeader(line: string): boolean {
  const t = line.trim();
  return (
    (/^#{1,4}\s*\d+\.?\s*.+Estimated Effort.+/i.test(t) ||
      /^\d+\.\s+Estimated Effort.+/i.test(t) ||
      /^\*\*\d+\s+.*Estimated Effort.*\*\*$/i.test(t)) &&
    /Estimated Effort/i.test(t)
  );
}

/**
 * Detects the start of a following section (next numbered heading).
 * Includes bold markdown style: "**5 Assumptions & Client Responsibilities**"
 */
function isSectionStart(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return (
    /^#{1,4}\s*\d+\.?\s/.test(t) ||
    /^\d+\.\s+[A-Za-z]/.test(t) ||
    /^\*\*\d+\s+[A-Za-z]/.test(t)
  );
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
  // Treat as empty if only whitespace or horizontal rules (---, ___, ***)
  const betweenWithoutHr = between.replace(/^[-_*]{2,}\s*$/gm, '').trim();
  if (!betweenWithoutHr) {
    const before = lines.slice(0, sectionStartIndex + 1).join('\n');
    const after = lines.slice(nextSectionIndex).join('\n');
    return before + fallback + after;
  }

  return body;
}

/**
 * Build fallback effort/timeline HTML fragment (no wrapper).
 */
function buildEffortFallbackHtml(totalHours: number): string {
  const hours = Math.round(totalHours);
  const weeksMin = Math.max(1, Math.ceil(hours / 40));
  const weeksMax = Math.max(weeksMin, Math.ceil(hours / 20));
  const weeksStr =
    weeksMin === weeksMax ? `${weeksMin}` : `${weeksMin}–${weeksMax}`;
  return `<p><strong>Estimated Total Effort</strong></p><p>${hours} hours</p><p><strong>Estimated Timeline</strong></p><p>${weeksStr} weeks from project kickoff, subject to timely client feedback and content availability.</p>`;
}

/**
 * If the HTML body contains an "Estimated Effort" heading but the content
 * until the next heading is empty, inject fallback effort/timeline HTML.
 * Used when the LLM leaves section 4/7 empty but total_hours is set.
 * Handles both <h1–h6> headings and <p><strong>...Estimated Effort...</strong></p> (from markdown).
 */
export function ensureEstimatedEffortSectionHtml(
  body: string,
  totalHours: number
): string {
  if (!body || totalHours <= 0) return body;

  // Match <h1>…</h1> through <h6>…</h6> or <p><strong>...Estimated Effort...</strong></p>
  const effortHeadingMatch =
    body.match(/<h[1-6][^>]*>.*?Estimated Effort.*?<\/h[1-6]>/i) ||
    body.match(/<p><strong>.*?Estimated Effort.*?<\/strong><\/p>/i);
  if (!effortHeadingMatch) return body;

  const headingBlock = effortHeadingMatch[0];
  const headingEndIndex = body.indexOf(headingBlock) + headingBlock.length;

  // Find next section: next <h1–h6> or <p><strong>N (numbered bold heading)
  const afterHeading = body.slice(headingEndIndex);
  const nextHeadingMatch =
    afterHeading.match(/<h[1-6][^>]*>/i) ||
    afterHeading.match(/<p><strong>\s*\d+\s+[A-Z]/i);
  const nextHeadingIndex = nextHeadingMatch
    ? headingEndIndex + nextHeadingMatch.index!
    : body.length;

  const between = body
    .slice(headingEndIndex, nextHeadingIndex)
    .replace(/<[^>]+>/g, '')
    .trim();
  if (between.length > 10) return body; // already has content

  const fallbackHtml = buildEffortFallbackHtml(totalHours);
  return (
    body.slice(0, headingEndIndex) +
    fallbackHtml +
    body.slice(nextHeadingIndex)
  );
}

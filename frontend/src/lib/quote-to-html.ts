/**
 * Quote Content to HTML Converter
 *
 * Converts a Quote's content (QuoteContent) into an HTML string suitable
 * for initializing a Tiptap editor. Handles both structured QuoteContent
 * (with deliverables, scope, etc.) and markdown-only content where the
 * entire AI response lives in executive_summary.
 */

import { isMarkdownOnlyContent } from '@/lib/quote-normalizer';
import type { Quote, QuoteContent } from '@/types';

/**
 * Detect if a numbered line (e.g. "1. Project Overview") is actually a
 * section heading rather than an ordered list item.
 *
 * Heuristics (matching the MarkdownBody preview logic):
 * - The text after the number starts with a capital letter and looks
 *   like a title (mostly words, may contain &, commas)
 * - The NEXT non-empty line is NOT another numbered item (headings are
 *   followed by paragraphs or bullets, not more numbered items)
 */
function isNumberedHeading(
  trimmed: string,
  lines: string[],
  currentIndex: number
): boolean {
  // Must match: digit(s) + dot + space + text starting with uppercase
  const match = trimmed.match(/^(\d+)\.\s+([A-Z].*)$/);
  if (!match) return false;

  // Exclude subsection patterns like "2.1 Title" (these are handled separately)
  if (/^\d+\.\d/.test(trimmed)) return false;

  // Look ahead: if the next non-empty line is also a numbered item with
  // consecutive numbering AND looks like a short list item, treat as list.
  // But if the next non-empty line is a paragraph, bullet, or heading, treat as heading.
  const currentNum = parseInt(match[1], 10);
  for (let j = currentIndex + 1; j < lines.length; j++) {
    const nextTrimmed = lines[j].trim();
    if (!nextTrimmed) continue; // skip blank lines

    // If next non-empty line is another numbered item with consecutive number
    const nextNumMatch = nextTrimmed.match(/^(\d+)\.\s+/);
    if (nextNumMatch) {
      const nextNum = parseInt(nextNumMatch[1], 10);
      // Consecutive numbering suggests a real ordered list
      if (nextNum === currentNum + 1) {
        // But only if both items look like short list entries, not section headers
        // Section headers typically have title-case text and are followed by content
        const currentText = match[2];
        // If current text is title-like (mostly capitalized words, no sentence-ending punctuation)
        // and is relatively short, it is more likely a heading
        const looksLikeTitle =
          /^[A-Z][A-Za-z\s&,/()-]+$/.test(currentText) &&
          currentText.length < 80;
        if (looksLikeTitle) return true;
        // Otherwise treat as ordered list
        return false;
      }
    }

    // Next line is a paragraph, bullet, heading, or separator -- this numbered
    // line is a section heading
    return true;
  }

  // No more lines after this -- treat as heading
  return true;
}

/**
 * Convert basic markdown patterns to HTML.
 * Handles the subset of markdown the AI typically generates:
 * headers, bold, italic, lists, links, horizontal rules.
 *
 * Importantly, detects numbered section headings (e.g. "1. Project Overview")
 * that would otherwise be misinterpreted as ordered list items.
 */
function markdownToHtml(markdown: string): string {
  let html = '';
  const lines = markdown.split('\n');
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (inList && listType) {
      html += `</${listType}>`;
      inList = false;
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line -- close any open list, skip
    if (!trimmed) {
      closeList();
      continue;
    }

    // Skip AI intro lines (these should not appear in the editor)
    if (
      trimmed.toLowerCase().startsWith("here's your") ||
      trimmed.toLowerCase().startsWith('here is your') ||
      trimmed.toLowerCase().includes('following the e2m standard') ||
      trimmed.toLowerCase().includes('professional project quote') ||
      trimmed.toLowerCase().startsWith('let me know if')
    ) {
      closeList();
      continue;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      closeList();
      html += '<hr>';
      continue;
    }

    // Markdown headings with optional numbered prefix: ## 1. Title, ### Title
    // Requires at least one space after the # sequence
    const markdownSectionMatch = trimmed.match(
      /^(#{1,4})\s+(?:\d+\.\s+)?(.+)$/
    );
    if (markdownSectionMatch) {
      closeList();
      const level = markdownSectionMatch[1].length;
      const text = formatInlineMarkdown(markdownSectionMatch[2]);
      html += `<h${level}>${text}</h${level}>`;
      continue;
    }

    // Subsection pattern: 2.1 English Website (number.number space Title)
    const subsectionMatch = trimmed.match(/^(\d+\.\d+)\s+(.+)$/);
    if (subsectionMatch) {
      closeList();
      const text = formatInlineMarkdown(subsectionMatch[2]);
      html += `<h3>${text}</h3>`;
      continue;
    }

    // Numbered line: could be a section heading OR an ordered list item
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      if (isNumberedHeading(trimmed, lines, i)) {
        // This is a section heading, not a list item
        closeList();
        const text = formatInlineMarkdown(numberedMatch[2]);
        html += `<h2>${text}</h2>`;
        continue;
      }

      // Genuine ordered list item
      if (!inList || listType !== 'ol') {
        closeList();
        html += '<ol>';
        inList = true;
        listType = 'ol';
      }
      html += `<li>${formatInlineMarkdown(numberedMatch[2])}</li>`;
      continue;
    }

    // Unordered list: - item or * item (but not ---)
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        closeList();
        html += '<ul>';
        inList = true;
        listType = 'ul';
      }
      html += `<li>${formatInlineMarkdown(ulMatch[1])}</li>`;
      continue;
    }

    // Regular paragraph
    closeList();
    html += `<p>${formatInlineMarkdown(trimmed)}</p>`;
  }

  closeList();
  return html;
}

/**
 * Convert inline markdown formatting to HTML.
 * Handles: **bold**, *italic*, `code`, [link](url)
 */
function formatInlineMarkdown(text: string): string {
  let result = text;

  // Bold: **text**
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic: *text* (but not already handled bold)
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Inline code: `text`
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links: [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return result;
}

/**
 * Escape HTML special characters to prevent XSS when inserting user text
 * into HTML strings.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convert structured QuoteContent to HTML for the Tiptap editor.
 * This produces clean, semantic HTML that Tiptap can parse and edit.
 */
function structuredContentToHtml(content: QuoteContent): string {
  let html = '';

  // Executive Summary
  if (content.executive_summary) {
    html += '<h1>Executive Summary</h1>';
    // The summary might contain newlines; split into paragraphs
    const paragraphs = content.executive_summary.split(/\n\n+/);
    paragraphs.forEach((p) => {
      const trimmed = p.trim();
      if (trimmed) {
        html += `<p>${escapeHtml(trimmed)}</p>`;
      }
    });
  }

  // Scope
  if (content.scope) {
    const hasIncluded = content.scope.included && content.scope.included.length > 0;
    const hasExcluded = content.scope.excluded && content.scope.excluded.length > 0;

    if (hasIncluded || hasExcluded) {
      html += '<h2>Scope</h2>';

      if (hasIncluded) {
        html += '<h3>Included</h3>';
        html += '<ul>';
        content.scope.included.forEach((item) => {
          html += `<li>${escapeHtml(item)}</li>`;
        });
        html += '</ul>';
      }

      if (hasExcluded) {
        html += '<h3>Excluded</h3>';
        html += '<ul>';
        content.scope.excluded.forEach((item) => {
          html += `<li>${escapeHtml(item)}</li>`;
        });
        html += '</ul>';
      }
    }
  }

  // Deliverables
  if (content.deliverables && content.deliverables.length > 0) {
    html += '<h2>Deliverables</h2>';

    // Group by category if categories exist.
    // The Deliverable type may or may not have a category field depending
    // on how it was normalized, so we access it via bracket notation safely.
    const grouped = content.deliverables.reduce(
      (acc, d) => {
        const cat = ((d as unknown) as Record<string, unknown>).category as string || 'General';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(d);
        return acc;
      },
      {} as Record<string, typeof content.deliverables>
    );

    Object.entries(grouped).forEach(([category, items]) => {
      if (Object.keys(grouped).length > 1 || category !== 'General') {
        html += `<h3>${escapeHtml(category)}</h3>`;
      }
      items.forEach((d) => {
        html += `<h3>${escapeHtml(d.name)}</h3>`;
        if (d.description) {
          html += `<p>${escapeHtml(d.description)}</p>`;
        }
        if (d.estimate) {
          html += `<p><strong>Estimated Hours:</strong> ${d.estimate.expected_hours} (${d.estimate.optimistic_hours} - ${d.estimate.pessimistic_hours})</p>`;
        }
      });
    });
  }

  // Assumptions
  if (content.assumptions && content.assumptions.length > 0) {
    html += '<h2>Assumptions</h2>';
    html += '<ul>';
    content.assumptions.forEach((item) => {
      html += `<li>${escapeHtml(item)}</li>`;
    });
    html += '</ul>';
  }

  // Risks
  if (content.risks && content.risks.length > 0) {
    html += '<h2>Risks &amp; Mitigation</h2>';
    content.risks.forEach((risk) => {
      html += `<h3>${escapeHtml(risk.description)}</h3>`;
      html += `<p><strong>Impact:</strong> ${escapeHtml(risk.impact)}</p>`;
      if (risk.mitigation) {
        html += `<p><strong>Mitigation:</strong> ${escapeHtml(risk.mitigation)}</p>`;
      }
    });
  }

  // Timeline
  if (content.timeline) {
    const hasStart = content.timeline.estimated_start;
    const hasEnd = content.timeline.estimated_end;
    const hasMilestones =
      content.timeline.milestones && content.timeline.milestones.length > 0;

    if (hasStart || hasEnd || hasMilestones) {
      html += '<h2>Timeline</h2>';

      if (hasStart && hasEnd) {
        html += `<p><strong>Duration:</strong> ${escapeHtml(content.timeline.estimated_start)} to ${escapeHtml(content.timeline.estimated_end)}</p>`;
      }

      if (hasMilestones) {
        html += '<h3>Key Milestones</h3>';
        html += '<ul>';
        content.timeline.milestones.forEach((m) => {
          html += `<li><strong>${escapeHtml(m.target_date)}</strong> - ${escapeHtml(m.name)}</li>`;
        });
        html += '</ul>';
      }
    }
  }

  // Totals summary
  if (content.totals && content.totals.total_expected_hours > 0) {
    html += '<h2>Summary</h2>';
    html += `<p><strong>Total Expected Hours:</strong> ${content.totals.total_expected_hours}</p>`;
  }

  return html;
}

/**
 * Detect if a string contains HTML tags (from Tiptap editor).
 * Used to decide whether content needs markdown-to-HTML conversion.
 */
export function isHtmlContent(content: string): boolean {
  return /^<(?:h[1-6]|p|ul|ol|li|strong|em|div|blockquote)\b/m.test(content);
}

/**
 * Convert a Quote's content to HTML suitable for the Tiptap editor.
 * Handles both structured QuoteContent and markdown-only content.
 *
 * @param quote - The Quote object with normalized content
 * @returns HTML string ready for Tiptap editor initialization
 */
export function quoteContentToHtml(quote: Quote): string {
  const content = quote.content;

  if (!content) {
    return '<p></p>';
  }

  // Early check: if executive_summary is already HTML (from a previous editor save),
  // return it directly. This prevents double-escaping when HTML content ends up
  // in the structured content path.
  const summary = content.executive_summary?.trim();
  if (summary && isHtmlContent(summary)) {
    return summary;
  }

  // Check if the content is markdown-only (full AI response in executive_summary)
  if (isMarkdownOnlyContent(content)) {
    if (!summary) {
      return '<p></p>';
    }

    // Convert markdown to HTML
    return markdownToHtml(summary);
  }

  // Structured content -- build HTML from sections
  return structuredContentToHtml(content);
}

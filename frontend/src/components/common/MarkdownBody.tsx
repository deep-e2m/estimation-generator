/**
 * MarkdownBody Component
 * Renders AI-generated quote content as a professional document.
 * 
 * Handles ACTUAL AI output format which includes:
 * - Markdown headers: ### 1. Title, #### 2.1 Subtitle
 * - Markdown bold: **text** for labels and emphasis
 * - Bullet lists: - item
 * - Separators: ---
 * - Intro text that should be hidden
 */

import React from 'react';

/**
 * Strip markdown bold markers from text
 */
function stripBold(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1');
}

/**
 * Parse inline formatting (bold) and return React nodes
 */
function parseInlineFormatting(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let rest = text;
  let i = 0;

  while (rest.length > 0) {
    // Bold: **text**
    const bold = /^\*\*([^*]+)\*\*/.exec(rest);
    if (bold) {
      parts.push(<strong key={`${keyPrefix}-b-${i++}`}>{bold[1]}</strong>);
      rest = rest.slice(bold[0].length);
      continue;
    }
    
    // Find next bold marker
    const nextBold = rest.indexOf('**');
    if (nextBold === -1) {
      parts.push(rest);
      break;
    }
    parts.push(rest.slice(0, nextBold));
    rest = rest.slice(nextBold);
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Detect line type from AI-generated content
 */
function getLineType(line: string, trimmed: string): {
  type: 'empty' | 'separator' | 'intro' | 'doc-title' | 'section-header' | 'subsection-header' | 'metadata' | 'bullet' | 'page-name' | 'paragraph';
  content: string;
  sectionNumber?: string;
} {
  // Empty line
  if (!trimmed) {
    return { type: 'empty', content: '' };
  }

  // Horizontal separator: --- or more
  if (/^-{3,}$/.test(trimmed)) {
    return { type: 'separator', content: '' };
  }

  // Skip intro lines (AI often adds these)
  if (
    trimmed.toLowerCase().startsWith("here's your") ||
    trimmed.toLowerCase().startsWith("here is your") ||
    trimmed.toLowerCase().includes('following the e2m standard') ||
    trimmed.toLowerCase().includes('professional project quote') ||
    trimmed.toLowerCase().startsWith('let me know if') ||
    // Hide boilerplate "not applicable" lines so empty sections don't show noise
    trimmed.toLowerCase().startsWith('not applicable for this project') ||
    trimmed.toLowerCase() === 'not applicable'
  ) {
    return { type: 'intro', content: '' };
  }

  // Document title: **Website Development Scope & Commercial Estimate**
  if (
    trimmed.includes('Scope & Commercial Estimate') ||
    trimmed.includes('Scope and Commercial Estimate') ||
    trimmed.includes('Commercial Estimate')
  ) {
    // Strip leading markdown heading markers (e.g. "# " or "## ")
    const withoutHashes = trimmed.replace(/^#{1,6}\s*/, '');
    return { type: 'doc-title', content: stripBold(withoutHashes) };
  }

  // Markdown section header: ### 1. Title or ### N. Title
  const markdownSectionMatch = trimmed.match(/^#{1,4}\s*(\d+)\.\s+(.+)$/);
  if (markdownSectionMatch) {
    return {
      type: 'section-header',
      content: stripBold(markdownSectionMatch[2]),
      sectionNumber: markdownSectionMatch[1],
    };
  }

  // Markdown subsection header: #### 2.1 Title or ### 2.1 Title
  const markdownSubsectionMatch = trimmed.match(/^#{1,4}\s*(\d+\.\d+)\s+(.+)$/);
  if (markdownSubsectionMatch) {
    return {
      type: 'subsection-header',
      content: stripBold(markdownSubsectionMatch[2]),
      sectionNumber: markdownSubsectionMatch[1],
    };
  }

  // Plain markdown header without numeric prefix, commonly used for
  // subsection-style labels like "#### WordPress Core Setup:"
  // Treat these as page/feature names so they get proper visual hierarchy.
  const plainHashHeaderMatch = trimmed.match(/^####\s+(.+)$/);
  if (plainHashHeaderMatch) {
    return {
      type: 'page-name',
      content: stripBold(plainHashHeaderMatch[1]),
    };
  }

  // Plain section header: 1. Project Overview (number at start, capital letter follows)
  const plainSectionMatch = trimmed.match(/^(\d+)\.\s+([A-Z][A-Za-z&\s,]+.*)$/);
  if (plainSectionMatch && !trimmed.match(/^\d+\.\d/)) {
    return {
      type: 'section-header',
      content: stripBold(plainSectionMatch[2]),
      sectionNumber: plainSectionMatch[1],
    };
  }

  // Plain subsection header: 2.1 English Website
  const plainSubsectionMatch = trimmed.match(/^(\d+\.\d+)\s+(.+)$/);
  if (plainSubsectionMatch) {
    return {
      type: 'subsection-header',
      content: stripBold(plainSubsectionMatch[2]),
      sectionNumber: plainSubsectionMatch[1],
    };
  }

  // Metadata lines: **Prepared for:** value or Prepared for: value
  // Also handles: **Platform:** value, **Date:** value, etc.
  const metadataPatterns = [
    /^\*\*(Prepared for|Prepared by|Date|Platform|Languages|Estimated Total Effort|Estimated Timeline|Client will provide|Plugins|Note)[:\s]*\*\*:?\s*(.*)$/i,
    /^\*\*(Prepared for|Prepared by|Date|Platform|Languages|Estimated Total Effort|Estimated Timeline)[:\s]*\*\*\s*(.*)$/i,
    /^(Prepared for|Prepared by|Date|Platform|Languages|Estimated Total Effort|Estimated Timeline|Client will provide|Plugins|Note):\s*(.*)$/i,
  ];
  
  for (const pattern of metadataPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const label = match[1];
      const value = match[2] ? stripBold(match[2]) : '';
      return { type: 'metadata', content: `${label}:|${value}` };
    }
  }

  // Bullet points: - item or * item
  if (/^[-*]\s/.test(trimmed)) {
    return { type: 'bullet', content: trimmed.slice(2) };
  }

  // Bold page/feature name: **Homepage** or **Dashboard**
  const boldOnlyMatch = trimmed.match(/^\*\*([^*]+)\*\*$/);
  if (boldOnlyMatch) {
    return { type: 'page-name', content: boldOnlyMatch[1] };
  }

  // Regular paragraph
  return { type: 'paragraph', content: trimmed };
}

/**
 * Parse a single line and return appropriate React element
 */
function parseLine(line: string, key: string): { node: React.ReactNode; type: string } | null {
  const trimmed = line.trim();
  const parsed = getLineType(line, trimmed);
  const { type, content } = parsed;

  switch (type) {
    case 'empty':
      return { node: <div key={key} className="md-spacer" />, type };

    case 'separator':
      return { node: <hr key={key} className="md-separator" />, type };

    case 'intro':
      // Skip intro lines entirely
      return null;

    case 'doc-title':
      return {
        node: (
          <h1 key={key} className="md-doc-title">
            {content}
          </h1>
        ),
        type,
      };

    case 'section-header':
      return {
        node: (
          <h2 key={key} className="md-section-header">
            {/* Number is rendered via CSS counter; content here is just the label */}
            <span className="md-section-number" />
            <span className="md-section-text">{parseInlineFormatting(content, key)}</span>
          </h2>
        ),
        type,
      };

    case 'subsection-header':
      return {
        node: (
          <h3 key={key} className="md-subsection-header">
            {/* Nested number (e.g. 2.1) via CSS counters */}
            <span className="md-subsection-number" />
            <span className="md-subsection-text">{parseInlineFormatting(content, key)}</span>
          </h3>
        ),
        type,
      };

    case 'metadata':
      const [label, value] = content.split('|');
      return {
        node: (
          <div key={key} className="md-metadata-row">
            <span className="md-metadata-label">{label}</span>
            <span className="md-metadata-value">{value || ''}</span>
          </div>
        ),
        type,
      };

    case 'bullet':
      return {
        node: (
          <li key={key} className="md-bullet-item">
            {parseInlineFormatting(content, key)}
          </li>
        ),
        type,
      };

    case 'page-name':
      return {
        node: (
          <h4 key={key} className="md-page-name">
            {content}
          </h4>
        ),
        type,
      };

    case 'paragraph':
    default:
      return {
        node: (
          <p key={key} className="md-paragraph">
            {parseInlineFormatting(content, key)}
          </p>
        ),
        type,
      };
  }
}

/**
 * Group consecutive elements (bullet lists, metadata blocks)
 */
function groupElements(elements: Array<{ node: React.ReactNode; type: string; key: string }>): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let currentBullets: React.ReactNode[] = [];
  let currentMetadata: React.ReactNode[] = [];
  let bulletKey = 0;
  let metadataKey = 0;

  const flushBullets = () => {
    if (currentBullets.length > 0) {
      result.push(
        <ul key={`bullet-list-${bulletKey++}`} className="md-bullet-list">
          {currentBullets}
        </ul>
      );
      currentBullets = [];
    }
  };

  const flushMetadata = () => {
    // Intentionally no-op: metadata (Prepared for/by, Date, Platform, etc.)
    // is now rendered in the document header, so we skip rendering it inside
    // the markdown body to avoid duplication.
    currentMetadata = [];
  };

  elements.forEach((el) => {
    if (el.type === 'bullet') {
      flushMetadata();
      currentBullets.push(el.node);
    } else if (el.type === 'metadata') {
      flushBullets();
      currentMetadata.push(el.node);
    } else {
      flushBullets();
      flushMetadata();
      result.push(el.node);
    }
  });

  // Flush remaining
  flushBullets();
  flushMetadata();

  return result;
}

/**
 * Main component - renders markdown content as professional document
 */
export function MarkdownBody({ content }: { content: string }) {
  const lines = content.split('\n');
  
  // Parse all lines, filtering out null (skipped) lines
  const parsedElements = lines
    .map((line, index) => {
      const result = parseLine(line, `md-${index}`);
      if (result === null) return null;
      return {
        node: result.node,
        type: result.type,
        key: `md-${index}`,
      };
    })
    .filter((el): el is { node: React.ReactNode; type: string; key: string } => el !== null);

  // Group consecutive elements (bullets, metadata)
  const groupedElements = groupElements(parsedElements);

  return (
    <div className="markdown-body md-document">
      {groupedElements}
    </div>
  );
}

export default MarkdownBody;

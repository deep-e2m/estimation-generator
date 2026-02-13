/**
 * Renders markdown-like content (headings, bold, lists) for quote/estimate body.
 * Used when backend returns content as a single markdown string.
 */

import React from 'react';

function parseLine(line: string, key: string): React.ReactNode {
  const trimmed = line.trim();
  if (!trimmed) return <br key={key} />;

  if (/^####\s/.test(trimmed)) {
    return <h4 key={key} className="text-sm font-semibold mt-3 mb-1">{trimmed.slice(5)}</h4>;
  }
  if (/^###\s/.test(trimmed)) {
    return <h3 key={key} className="text-base font-semibold mt-3 mb-1">{trimmed.slice(4)}</h3>;
  }
  if (/^##\s/.test(trimmed)) {
    return <h2 key={key} className="text-lg font-semibold mt-4 mb-2">{trimmed.slice(3)}</h2>;
  }
  if (/^#\s/.test(trimmed)) {
    return <h1 key={key} className="text-xl font-bold mt-4 mb-2">{trimmed.slice(2)}</h1>;
  }

  // Inline **bold**
  const parts: React.ReactNode[] = [];
  let rest = trimmed;
  let i = 0;
  while (rest.length > 0) {
    const bold = /^\*\*([^*]+)\*\*/.exec(rest);
    if (bold) {
      parts.push(<strong key={`${key}-b-${i++}`}>{bold[1]}</strong>);
      rest = rest.slice(bold[0].length);
      continue;
    }
    const nextBold = rest.indexOf('**');
    if (nextBold === -1) {
      parts.push(rest);
      break;
    }
    parts.push(rest.slice(0, nextBold));
    rest = rest.slice(nextBold);
  }

  if (/^[-*]\s/.test(trimmed)) {
    return (
      <li key={key} className="ml-4 list-disc">
        {parts}
      </li>
    );
  }
  if (/^\d+\.\s/.test(trimmed)) {
    return (
      <li key={key} className="ml-4 list-decimal">
        {parts}
      </li>
    );
  }

  return (
    <p key={key} className="mb-2 leading-relaxed text-gray-700">
      {parts}
    </p>
  );
}

export function MarkdownBody({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="markdown-body prose prose-sm max-w-none">
      {lines.map((line, index) => parseLine(line, `md-${index}`))}
    </div>
  );
}

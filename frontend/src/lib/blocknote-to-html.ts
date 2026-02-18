/**
 * Detect BlockNote JSON and convert to HTML for preview/export.
 * BlockNote document is a JSON array of blocks with type, content (array of inline items), props.
 * Inline items can have styles: bold, italic, underline, strike, code (preserved in HTML).
 */

export function isBlockNoteJson(content: string): boolean {
  if (!content?.trim()) return false;
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && 'type' in parsed[0] && 'content' in parsed[0];
  } catch {
    return false;
  }
}

/** Inline content item: text with optional styles (bold, italic, etc.) */
interface InlineItem {
  type?: string;
  text?: string;
  styles?: Record<string, unknown>;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convert BlockNote inline content array to HTML, preserving bold, italic, underline, strike, code.
 */
function inlineContentToHtml(content: InlineItem[]): string {
  const items = content ?? [];
  const parts: string[] = [];
  for (const c of items) {
    if (!c || c.type !== 'text' || typeof c.text !== 'string') continue;
    const styles = (c.styles ?? {}) as Record<string, boolean | string>;
    let inner = escapeHtml(c.text);
    if (styles.code) inner = `<code>${inner}</code>`;
    if (styles.bold) inner = `<strong>${inner}</strong>`;
    if (styles.italic) inner = `<em>${inner}</em>`;
    if (styles.underline) inner = `<u>${inner}</u>`;
    if (styles.strike) inner = `<s>${inner}</s>`;
    parts.push(inner);
  }
  return parts.join('');
}

function blockContentToHtml(block: { content?: InlineItem[] }): string {
  return inlineContentToHtml(block.content ?? []);
}

/**
 * Convert BlockNote JSON string to HTML string for safe use in dangerouslySetInnerHTML or export.
 * Preserves inline formatting (bold, italic, underline, strike, code) so editor and preview/export stay in sync.
 */
export function blocknoteJsonToHtml(content: string): string {
  if (!content?.trim()) return content;
  let blocks: Array<{ type?: string; content?: InlineItem[]; props?: { level?: number } }>;
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!Array.isArray(parsed)) return content;
    blocks = parsed as Array<{ type?: string; content?: InlineItem[]; props?: { level?: number } }>;
  } catch {
    return content;
  }
  const out: string[] = [];
  for (const blk of blocks) {
    if (!blk || typeof blk !== 'object') continue;
    const type = blk.type ?? 'paragraph';
    const innerHtml = blockContentToHtml(blk);
    if (!innerHtml.trim() && type !== 'heading') continue;
    if (type === 'heading') {
      const level = Math.min(6, Math.max(1, blk.props?.level ?? 1));
      out.push(`<h${level}>${innerHtml || ' '}</h${level}>`);
    } else if (type === 'bulletListItem') {
      out.push(`<li>${innerHtml || ' '}</li>`);
    } else {
      out.push(`<p>${innerHtml || ' '}</p>`);
    }
  }
  // Wrap consecutive <li> in <ul>
  const htmlParts: string[] = [];
  let j = 0;
  while (j < out.length) {
    if (out[j].startsWith('<li>')) {
      htmlParts.push('<ul>');
      while (j < out.length && out[j].startsWith('<li>')) {
        htmlParts.push(out[j]);
        j++;
      }
      htmlParts.push('</ul>');
    } else {
      htmlParts.push(out[j]);
      j++;
    }
  }
  return htmlParts.join('\n');
}

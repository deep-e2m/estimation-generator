/**
 * Converts estimation_outcomes (key-value) into a structured BlockNote document
 * so the editor shows proper headings, paragraphs, and bullet lists instead of
 * flat "key: value" lines.
 *
 * Keeps the key-value contract; only the presentation in the editor is structured.
 */

import {
  ESTIMATION_OUTCOMES_KEYS,
  ESTIMATION_OUTCOMES_LABELS,
} from '@/constants/estimation-outcomes';
import type { EstimationOutcomes } from '@/types';

/** Inline content item (BlockNote format) */
const inline = (text: string) => [{ type: 'text' as const, text: text || ' ', styles: {} }];

/** BlockNote-compatible block: content is array of inline items */
export interface BlockNoteBlockLike {
  id: string;
  type: 'heading' | 'paragraph' | 'bulletListItem';
  content: Array<{ type: 'text'; text: string; styles: Record<string, unknown> }>;
  props?: { textColor?: string; backgroundColor?: string; textAlignment?: string; level?: number };
  children?: unknown[];
}

/** Line starts with - or * or • followed by space */
const BULLET_PREFIX = /^[-*•]\s+/;

/** Inline " - " used as list separator (e.g. "Item1. - Item2. - Item3" on one line) */
const INLINE_BULLET_SEP = /\s+-\s+/;

/**
 * Parse a section value string into block content: paragraphs (split by blank
 * lines) and bullet list items (lines starting with - or * or •, or split from
 * a single line containing multiple " - " list items).
 */
function valueToBlocks(value: string, blockIdPrefix: string): BlockNoteBlockLike[] {
  const blocks: BlockNoteBlockLike[] = [];
  const trimmed = (value || '').trim();
  if (!trimmed) return blocks;

  // Split by double newline for paragraph groups
  const groups = trimmed.split(/\n\n+/);
  let index = 0;

  for (const group of groups) {
    const lines = group.split(/\n/).map((l) => l.trimEnd());
    const bulletLines: string[] = [];
    const otherLines: string[] = [];

    for (const line of lines) {
      const bulletMatch = line.match(BULLET_PREFIX);
      if (bulletMatch) {
        bulletLines.push(line.replace(BULLET_PREFIX, '').trim() || ' ');
      } else if (line.includes(' - ') && (line.match(INLINE_BULLET_SEP) || []).length >= 2) {
        // Single line with multiple " - " list items (e.g. "Home: x. - Cart: y. - Payment: z.")
        const parts = line.split(INLINE_BULLET_SEP).map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 3) {
          const [first, ...rest] = parts;
          if (first) otherLines.push(first);
          bulletLines.push(...rest);
        } else {
          otherLines.push(line);
        }
      } else {
        otherLines.push(line);
      }
    }

    // If we have a mix, emit non-bullet as paragraph then bullets
    if (otherLines.length > 0) {
      const paraText = otherLines.join('\n').trim() || ' ';
      blocks.push({
        id: `${blockIdPrefix}-p-${index}`,
        type: 'paragraph',
        content: inline(paraText),
        props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
        children: [],
      });
      index += 1;
    }
    for (const item of bulletLines) {
      blocks.push({
        id: `${blockIdPrefix}-b-${index}`,
        type: 'bulletListItem',
        content: inline(item),
        props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
        children: [],
      });
      index += 1;
    }
  }

  return blocks;
}

/**
 * Convert estimation_outcomes (key-value) into an array of BlockNote blocks:
 * for each section key, a heading (level 1) plus paragraphs and bullet items
 * derived from the value text.
 */
export function estimationOutcomesToBlockNoteBlocks(
  outcomes: EstimationOutcomes
): BlockNoteBlockLike[] {
  if (!outcomes || typeof outcomes !== 'object') return [];

  const result: BlockNoteBlockLike[] = [];
  let blockIndex = 0;

  for (const key of ESTIMATION_OUTCOMES_KEYS) {
    const value = outcomes[key];
    if (value == null) continue;

    const label = ESTIMATION_OUTCOMES_LABELS[key] ?? key;
    const sectionId = `section-${blockIndex}`;
    blockIndex += 1;

    // Section heading (level 1)
    result.push({
      id: `${sectionId}-h`,
      type: 'heading',
      content: inline(label),
      props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left', level: 1 },
      children: [],
    });

    const contentBlocks = valueToBlocks(String(value).trim(), sectionId);
    for (const b of contentBlocks) {
      result.push(b);
    }
  }

  return result;
}

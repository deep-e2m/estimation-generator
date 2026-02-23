"""
BlockNote document format utilities.

Converts between section key-value content (from LLM) and BlockNote JSON
(array of blocks) for storage and editing. Also converts BlockNote JSON to HTML
for export (PDF/DOCX).
"""

import html
import json
import re
from typing import Any

# Section keys and labels used when converting LLM output to BlockNote (display order).
BLOCKNOTE_SECTION_KEYS = [
    "project_overview",
    "website_structure",
    "development_approach",
    "estimated_effort_timeline",
    "assumptions",
    "exclusions",
]

BLOCKNOTE_SECTION_LABELS: dict[str, str] = {
    "project_overview": "Project Overview",
    "website_structure": "Website Structure & Page Scope",
    "development_approach": "Development Approach",
    "estimated_effort_timeline": "Estimated Effort & Timeline",
    "assumptions": "Assumptions & Client Responsibilities",
    "exclusions": "Exclusions",
}

BULLET_PREFIX = re.compile(r"^[-*•]\s+")
INLINE_BULLET_SEP = re.compile(r"\s+-\s+")
# Match **bold** (non-greedy) so we can split and convert to BlockNote bold style
_BOLD_PATTERN = re.compile(r"\*\*(.+?)\*\*")


def _parse_inline_markdown(text: str) -> list[dict[str, Any]]:
    """
    Parse text that may contain **bold** markdown into BlockNote inline content.
    Asterisks are removed; bold segments get styles.bold = True so no stars are visible.
    """
    t = (text or "").strip() or " "
    parts = _BOLD_PATTERN.split(t)
    if len(parts) == 1 and not _BOLD_PATTERN.search(t):
        return [{"type": "text", "text": t, "styles": {}}]
    result: list[dict[str, Any]] = []
    for i, part in enumerate(parts):
        if not part:
            continue
        # Odd-indexed parts are the captured groups inside **...**
        styles: dict[str, Any] = {"bold": True} if i % 2 == 1 else {}
        result.append({"type": "text", "text": part, "styles": styles})
    return result if result else [{"type": "text", "text": " ", "styles": {}}]


def _inline_content(text: str) -> list[dict[str, Any]]:
    """BlockNote inline content array from plain text (with **bold** parsed)."""
    return _parse_inline_markdown(text)


def _value_to_blocks(value: str, block_id_prefix: str) -> list[dict[str, Any]]:
    """Parse a section value into BlockNote blocks (paragraphs and bullet items)."""
    blocks: list[dict[str, Any]] = []
    trimmed = (value or "").strip()
    if not trimmed:
        return blocks

    index = 0
    for group in re.split(r"\n\n+", trimmed):
        lines = [ln.rstrip() for ln in group.split("\n")]
        bullet_lines: list[str] = []
        other_lines: list[str] = []

        for line in lines:
            if BULLET_PREFIX.match(line):
                bullet_lines.append(BULLET_PREFIX.sub("", line).strip() or " ")
            elif line.count(" - ") >= 2 and INLINE_BULLET_SEP.findall(line):
                parts = [p.strip() for p in INLINE_BULLET_SEP.split(line) if p.strip()]
                if len(parts) >= 3:
                    other_lines.append(parts[0])
                    bullet_lines.extend(parts[1:])
                else:
                    other_lines.append(line)
            else:
                other_lines.append(line)

        if other_lines:
            para_text = "\n".join(other_lines).strip() or " "
            blocks.append({
                "id": f"{block_id_prefix}-p-{index}",
                "type": "paragraph",
                "props": {"textColor": "default", "backgroundColor": "default", "textAlignment": "left"},
                "content": _inline_content(para_text),
                "children": [],
            })
            index += 1
        for item in bullet_lines:
            blocks.append({
                "id": f"{block_id_prefix}-b-{index}",
                "type": "bulletListItem",
                "props": {"textColor": "default", "backgroundColor": "default", "textAlignment": "left"},
                "content": _inline_content(item),
                "children": [],
            })
            index += 1

    return blocks


def outcomes_dict_to_blocknote_json(outcomes: dict[str, Any]) -> str:
    """
    Convert LLM estimation_outcomes (key -> string value) into BlockNote JSON string.

    Produces an array of blocks with headings and paragraph/bullet content
    matching the frontend BlockNote format. Stored content will be this JSON string.
    """
    result: list[dict[str, Any]] = []
    block_index = 0

    for key in BLOCKNOTE_SECTION_KEYS:
        value = outcomes.get(key)
        if value is None:
            continue
        label = BLOCKNOTE_SECTION_LABELS.get(key, key)
        section_id = f"section-{block_index}"
        block_index += 1

        result.append({
            "id": f"{section_id}-h",
            "type": "heading",
            "props": {
                "textColor": "default",
                "backgroundColor": "default",
                "textAlignment": "left",
                "level": 1,
            },
            "content": _inline_content(label),
            "children": [],
        })

        for blk in _value_to_blocks(str(value).strip(), section_id):
            result.append(blk)

    return json.dumps(result)


# Match markdown headings: # or ## etc. followed by space and heading text.
_HEADING_LINE_RE = re.compile(r"^#+\s+(.+)$")


def markdown_sections_to_blocknote_json(markdown: str) -> str:
    """
    Parse markdown into sections by # headings and build a BlockNote JSON document.

    Used when conversational refinement returns full updated markdown (updated_content).
    The system rebuilds the BlockNote document from it so add/remove/reorder sections
    are all supported. Each line matching ^#+\\s+(.+)$ starts a new section; content
    until the next heading is the section body. Section order is preserved.
    """
    if not markdown or not markdown.strip():
        return json.dumps([])

    lines = markdown.strip().split("\n")
    sections: list[tuple[str, str]] = []  # (heading_text, body)
    current_heading: str | None = None
    current_body: list[str] = []

    for line in lines:
        heading_match = _HEADING_LINE_RE.match(line.strip())
        if heading_match:
            heading_text = heading_match.group(1).strip()
            if current_heading is not None:
                body = "\n".join(current_body).strip()
                sections.append((current_heading, body))
            current_heading = heading_text
            current_body = []
        else:
            current_body.append(line)

    if current_heading is not None:
        body = "\n".join(current_body).strip()
        sections.append((current_heading, body))

    result: list[dict[str, Any]] = []
    for idx, (heading_text, body_str) in enumerate(sections):
        section_id = f"section-{idx}"
        result.append({
            "id": f"{section_id}-h",
            "type": "heading",
            "props": {
                "textColor": "default",
                "backgroundColor": "default",
                "textAlignment": "left",
                "level": 1,
            },
            "content": _inline_content(heading_text or " "),
            "children": [],
        })
        for blk in _value_to_blocks(body_str, section_id):
            result.append(blk)

    return json.dumps(result)


def is_blocknote_json(content: str) -> bool:
    """Return True if content looks like a BlockNote document (JSON array of block objects)."""
    if not content or not content.strip():
        return False
    try:
        parsed = json.loads(content)
    except (TypeError, ValueError):
        return False
    if not isinstance(parsed, list) or len(parsed) == 0:
        return False
    first = parsed[0]
    return isinstance(first, dict) and "type" in first and "content" in first


def apply_blocknote_text_replacements(
    content: str,
    replacements: list[dict[str, str]],
) -> str:
    """
    Apply a list of old -> new text replacements to all text nodes in a BlockNote document.

    Used when conversational refinement returns text_replacements (e.g. theme name/URL,
    hours in body) so the estimate body stays in sync with the LLM's changes.
    """
    if not is_blocknote_json(content) or not replacements:
        return content

    try:
        blocks = json.loads(content)
    except (TypeError, ValueError):
        return content

    if not isinstance(blocks, list):
        return content

    for blk in blocks:
        if not isinstance(blk, dict):
            continue
        content_items = blk.get("content")
        if not isinstance(content_items, list):
            continue
        for item in content_items:
            if not isinstance(item, dict) or item.get("type") != "text":
                continue
            text = str(item.get("text") or "")
            for r in replacements:
                old_s = r.get("old") or ""
                new_s = r.get("new") or ""
                if old_s and old_s in text:
                    text = text.replace(old_s, new_s, 1)
            if text != str(item.get("text") or ""):
                item["text"] = text

    try:
        return json.dumps(blocks)
    except TypeError:
        return content


def _inline_content_to_html(content: list[Any]) -> str:
    """
    Convert BlockNote inline content array to HTML, preserving bold, italic, underline, strike, code.
    """
    parts: list[str] = []
    for item in content or []:
        if not isinstance(item, dict) or item.get("type") != "text":
            continue
        raw = str(item.get("text") or "")
        escaped = html.escape(raw)
        styles = item.get("styles") if isinstance(item.get("styles"), dict) else {}
        if styles.get("code"):
            escaped = f"<code>{escaped}</code>"
        if styles.get("bold"):
            escaped = f"<strong>{escaped}</strong>"
        if styles.get("italic"):
            escaped = f"<em>{escaped}</em>"
        if styles.get("underline"):
            escaped = f"<u>{escaped}</u>"
        if styles.get("strike"):
            escaped = f"<s>{escaped}</s>"
        parts.append(escaped)
    return "".join(parts)


def blocknote_json_to_html(content: str) -> str:
    """
    Convert BlockNote JSON document to HTML. If content is not BlockNote JSON, return as-is.
    Preserves inline formatting (bold, italic, underline, strike, code) so export matches the editor.
    """
    if not content or not content.strip():
        return content
    try:
        blocks = json.loads(content)
    except (TypeError, ValueError):
        return content
    if not isinstance(blocks, list):
        return content

    out: list[str] = []
    for blk in blocks:
        if not isinstance(blk, dict):
            continue
        block_type = blk.get("type") or "paragraph"
        inner_html = _inline_content_to_html(blk.get("content") or [])
        if not inner_html.strip() and block_type != "heading":
            continue
        inner_html = inner_html or " "
        if block_type == "heading":
            level = 1
            if isinstance(blk.get("props"), dict) and "level" in blk["props"]:
                level = max(1, min(6, int(blk["props"]["level"]) or 1))
            out.append(f"<h{level}>{inner_html}</h{level}>")
        elif block_type == "bulletListItem":
            out.append(f"<li>{inner_html}</li>")
        else:
            out.append(f"<p>{inner_html}</p>")

    # Wrap consecutive <li> in <ul>
    html_parts: list[str] = []
    i = 0
    while i < len(out):
        if out[i].startswith("<li>"):
            html_parts.append("<ul>")
            while i < len(out) and out[i].startswith("<li>"):
                html_parts.append(out[i])
                i += 1
            html_parts.append("</ul>")
        else:
            html_parts.append(out[i])
            i += 1

    return "\n".join(html_parts)


def update_blocknote_total_hours(content: str, new_total_hours: float) -> str:
    """
    Update the "Total Hours" text inside a BlockNote JSON document.

    This is used when conversational refinement changes the numeric
    estimation time (e.g. from 180h to 210h) so that we can keep the
    BlockNote layout exactly as-is and only adjust the numbers.

    The function:
    - Detects when content is valid BlockNote JSON
    - Locates the "Estimated Effort & Timeline" section
    - Rewrites any inline "Total Hours: X" occurrences to the new value
    - ALSO normalizes lines like "Estimated Total Effort: 180-200 hours"
      so they reflect the new total hours
    """
    if not is_blocknote_json(content):
        return content

    try:
        blocks = json.loads(content)
    except (TypeError, ValueError):
        return content

    if not isinstance(blocks, list):
        return content

    # Match section by containing "estimated effort" so "7. Estimated Effort & Timeline" is found
    effort_section_key = "estimated effort"

    total_hours_re = re.compile(r"(Total Hours\s*:\s*)([0-9]+(?:\.[0-9]+)?)", re.IGNORECASE)
    # Match any "X hours" / "X-YYY hours" style phrase so that both
    # "Estimated Total Effort: 180-200 hours" and "50 hours. Estimated Timeline..."
    # get synchronized with the numeric total.
    hours_phrase_re = re.compile(
        r"([0-9]+(?:\.[0-9]+)?(?:\s*[-–]\s*[0-9]+(?:\.[0-9]+)?)?)\s*(hours?|hrs?)\b",
        re.IGNORECASE,
    )

    # Use a clean string (no trailing zeros) for human-facing text
    numeric = float(new_total_hours)
    new_value = f"{numeric:.2f}"
    new_effort_value = (
        str(int(numeric)) if numeric.is_integer() else f"{numeric:.2f}".rstrip("0").rstrip(".")
    )

    in_estimated_section = False

    for blk in blocks:
        if not isinstance(blk, dict):
            continue

        # Track when we are inside the "Estimated Effort & Timeline" section
        # (heading may be "Estimated Effort & Timeline" or "7. Estimated Effort & Timeline")
        if blk.get("type") == "heading":
            heading_text_parts = []
            for item in blk.get("content") or []:
                if isinstance(item, dict) and item.get("type") == "text":
                    heading_text_parts.append(str(item.get("text") or ""))
            heading_text = " ".join(heading_text_parts).strip()
            in_estimated_section = effort_section_key in heading_text.lower()
            continue

        if not in_estimated_section:
            continue

        # Within the section: rewrite "Total Hours: X" and "X hours" phrases.
        # Build full block text so we catch hours split across inline items (e.g. bold "120" + " hours").
        content_items = blk.get("content")
        if not isinstance(content_items, list):
            continue

        full_text = "".join(
            str(item.get("text") or "")
            for item in content_items
            if isinstance(item, dict) and item.get("type") == "text"
        )

        # First try "Total Hours: X" on full block text; if matched, update the item containing the number
        total_mo = total_hours_re.search(full_text)
        if total_mo:
            old_num = total_mo.group(2)
            for item in content_items:
                if not isinstance(item, dict) or item.get("type") != "text":
                    continue
                t = str(item.get("text") or "")
                if old_num in t:
                    item["text"] = total_hours_re.sub(rf"\1{new_value}", t, count=1)
                    break

        # Then try "X hours" / "X-YYY hours" on full block text; if matched, update the item containing the number
        hours_mo = hours_phrase_re.search(full_text)
        if hours_mo:
            old_phrase = hours_mo.group(1)  # e.g. "120" or "180-200"
            for item in content_items:
                if not isinstance(item, dict) or item.get("type") != "text":
                    continue
                text = str(item.get("text") or "")
                if old_phrase not in text:
                    continue
                # Same item has full "X hours" -> use regex; number in this item and " hours" elsewhere -> replace number only
                updated_text = hours_phrase_re.sub(
                    rf"{new_effort_value} \2",
                    text,
                    count=1,
                )
                if updated_text == text:
                    updated_text = text.replace(old_phrase, new_effort_value, 1)
                if updated_text != text:
                    item["text"] = updated_text
                break

        # Per-item fallback: apply replacements when the full phrase is in a single item
        for item in content_items:
            if not isinstance(item, dict) or item.get("type") != "text":
                continue
            text = str(item.get("text") or "")
            updated_text = total_hours_re.sub(rf"\1{new_value}", text)
            updated_text = hours_phrase_re.sub(
                rf"{new_effort_value} \2",
                updated_text,
                count=1,
            )
            if updated_text != text:
                item["text"] = updated_text

    try:
        return json.dumps(blocks)
    except TypeError:
        return content

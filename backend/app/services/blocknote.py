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


def _inline_content(text: str) -> list[dict[str, Any]]:
    """BlockNote inline content array from plain text."""
    t = (text or "").strip() or " "
    return [{"type": "text", "text": t, "styles": {}}]


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

    target_heading = BLOCKNOTE_SECTION_LABELS.get("estimated_effort_timeline", "").strip()
    if not target_heading:
        return content

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
        if blk.get("type") == "heading":
            heading_text_parts = []
            for item in blk.get("content") or []:
                if isinstance(item, dict) and item.get("type") == "text":
                    heading_text_parts.append(str(item.get("text") or ""))
            heading_text = " ".join(heading_text_parts).strip()
            in_estimated_section = heading_text.lower() == target_heading.lower()
            continue

        if not in_estimated_section:
            continue

        # Within the section: rewrite any "Total Hours: X" occurrences
        content_items = blk.get("content")
        if not isinstance(content_items, list):
            continue

        for item in content_items:
            if not isinstance(item, dict) or item.get("type") != "text":
                continue
            text = str(item.get("text") or "")
            updated_text = total_hours_re.sub(rf"\1{new_value}", text)

            # Also normalize any "X hours" / "X-YYY hours" style phrases so that
            # when users change the estimation time via chat, the narrative
            # sentence (e.g. "50 hours. Estimated Timeline: 6–8 weeks.") stays
            # in sync with the updated total hours shown in the header/top bar.
            updated_text = hours_phrase_re.sub(
                rf"{new_effort_value} \2",
                updated_text,
                count=1,  # only first hours phrase per line to avoid over-updating
            )

            if updated_text != text:
                item["text"] = updated_text

    try:
        return json.dumps(blocks)
    except TypeError:
        return content

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

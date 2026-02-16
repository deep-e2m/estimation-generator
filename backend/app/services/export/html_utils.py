"""
HTML content detection and parsing utilities for export services.

This module provides functions to detect whether quote content is HTML
(from the Tiptap rich-text editor) or plain markdown (from AI generation),
and to parse HTML content into structured data suitable for DOCX/PDF export.

The Tiptap editor outputs clean, semantic HTML using standard tags:
<h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <u>, <s>,
<blockquote>, <pre>, <code>, <br>, <table>, <tr>, <td>, <th>.
"""

import logging
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Content format detection
# ---------------------------------------------------------------------------


def is_html_content(content: str) -> bool:
    """
    Detect whether content is HTML (from Tiptap editor) vs plain markdown/text.

    Uses a heuristic approach: checks for the presence of common semantic
    HTML tags that Tiptap produces. Markdown content may contain angle
    brackets in code blocks or comparisons, so we specifically look for
    known HTML element patterns rather than any ``<`` character.

    Args:
        content: The raw content string to inspect.

    Returns:
        True if the content appears to be HTML, False otherwise.
    """
    if not content or not content.strip():
        return False

    # Pattern matches opening tags for elements Tiptap emits.
    # We require a word boundary after the tag name to avoid false
    # positives like ``<-- comment`` or ``< 5``.
    html_tag_pattern = re.compile(
        r"<(?:h[1-6]|p|ul|ol|li|strong|em|u|s|blockquote|pre|code|table|tr|td|th|br|div|span)\b",
        re.IGNORECASE,
    )
    return bool(html_tag_pattern.search(content))


def detect_content_format(content: str) -> str:
    """
    Return the content format as a string label.

    Args:
        content: The raw content string.

    Returns:
        ``'html'`` if the content is HTML, ``'markdown'`` otherwise.
    """
    return "html" if is_html_content(content) else "markdown"


# ---------------------------------------------------------------------------
# HTML sanitisation
# ---------------------------------------------------------------------------

# Allowed HTML tags from Tiptap's semantic output.
ALLOWED_TAGS: set[str] = {
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr",
    "ul", "ol", "li",
    "strong", "b", "em", "i", "u", "s", "del", "strike",
    "blockquote", "pre", "code",
    "table", "thead", "tbody", "tr", "td", "th",
    "div", "span",
    "a", "img",
    "sub", "sup",
}

# Allowed attributes per tag (minimal surface).
ALLOWED_ATTRIBUTES: dict[str, set[str]] = {
    "a": {"href", "title", "target", "rel"},
    "img": {"src", "alt", "title", "width", "height"},
    "td": {"colspan", "rowspan"},
    "th": {"colspan", "rowspan"},
    "p": {"style"},
    "h1": {"style"},
    "h2": {"style"},
    "h3": {"style"},
    "span": {"style"},
    "div": {"style"},
}

# Only allow these CSS properties inside ``style`` attributes.
ALLOWED_CSS_PROPERTIES: set[str] = {
    "text-align",
    "color",
    "background-color",
    "font-weight",
    "font-style",
    "text-decoration",
}


def sanitize_html(html_content: str) -> str:
    """
    Sanitize HTML content to prevent XSS while preserving Tiptap formatting.

    This function strips disallowed tags and attributes from the HTML
    string. It does **not** depend on ``bleach``; instead it uses a
    lightweight allow-list approach built on Python's ``html.parser``.

    Args:
        html_content: Untrusted HTML string from the client.

    Returns:
        Sanitized HTML string safe for storage and rendering.
    """
    if not html_content:
        return html_content

    sanitizer = _HTMLSanitizer()
    sanitizer.feed(html_content)
    return sanitizer.get_output()


class _HTMLSanitizer(HTMLParser):
    """
    A streaming HTML sanitizer that keeps only allowed tags and attributes.

    Disallowed tags have their inner text preserved (tags are stripped, not
    the content between them). ``<script>`` and ``<style>`` tags and their
    entire contents are removed.
    """

    # Tags whose *content* should be dropped entirely.
    _DROP_CONTENT_TAGS = {"script", "style"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._output: list[str] = []
        self._drop_depth: int = 0  # depth inside a drop-content tag

    def get_output(self) -> str:
        return "".join(self._output)

    # -- handler overrides --

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        tag_lower = tag.lower()

        if tag_lower in self._DROP_CONTENT_TAGS:
            self._drop_depth += 1
            return

        if self._drop_depth > 0:
            return

        if tag_lower not in ALLOWED_TAGS:
            # Strip the tag but keep rendering content inside it.
            return

        safe_attrs = self._filter_attributes(tag_lower, attrs)
        attr_str = ""
        if safe_attrs:
            parts = []
            for name, value in safe_attrs:
                if value is None:
                    parts.append(f" {name}")
                else:
                    escaped_value = value.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")
                    parts.append(f' {name}="{escaped_value}"')
            attr_str = "".join(parts)

        if tag_lower in {"br", "hr", "img"}:
            self._output.append(f"<{tag_lower}{attr_str} />")
        else:
            self._output.append(f"<{tag_lower}{attr_str}>")

    def handle_endtag(self, tag: str) -> None:
        tag_lower = tag.lower()

        if tag_lower in self._DROP_CONTENT_TAGS:
            self._drop_depth = max(0, self._drop_depth - 1)
            return

        if self._drop_depth > 0:
            return

        if tag_lower not in ALLOWED_TAGS:
            return

        if tag_lower not in {"br", "hr", "img"}:
            self._output.append(f"</{tag_lower}>")

    def handle_data(self, data: str) -> None:
        if self._drop_depth > 0:
            return
        self._output.append(data)

    def handle_entityref(self, name: str) -> None:
        if self._drop_depth > 0:
            return
        self._output.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        if self._drop_depth > 0:
            return
        self._output.append(f"&#{name};")

    # -- internal helpers --

    def _filter_attributes(
        self, tag: str, attrs: list[tuple[str, Optional[str]]]
    ) -> list[tuple[str, Optional[str]]]:
        """Return only the attributes that are on the allow-list for *tag*."""
        allowed = ALLOWED_ATTRIBUTES.get(tag, set())
        if not allowed:
            return []

        safe: list[tuple[str, Optional[str]]] = []
        for name, value in attrs:
            name_lower = name.lower()
            if name_lower not in allowed:
                continue

            # Special handling for ``style`` attribute.
            if name_lower == "style" and value:
                value = self._sanitize_css(value)
                if not value:
                    continue

            # Block javascript: URLs in href / src.
            if name_lower in ("href", "src") and value:
                stripped = value.strip().lower()
                if stripped.startswith("javascript:") or stripped.startswith("data:text/html"):
                    continue

            safe.append((name_lower, value))
        return safe

    @staticmethod
    def _sanitize_css(style_value: str) -> str:
        """Strip CSS properties not on the allow-list."""
        declarations = style_value.split(";")
        safe_parts: list[str] = []
        for decl in declarations:
            decl = decl.strip()
            if not decl:
                continue
            if ":" not in decl:
                continue
            prop = decl.split(":")[0].strip().lower()
            if prop in ALLOWED_CSS_PROPERTIES:
                safe_parts.append(decl)
        return "; ".join(safe_parts)


# ---------------------------------------------------------------------------
# HTML to structured data parsing
# ---------------------------------------------------------------------------


@dataclass
class ParsedSection:
    """
    A parsed section extracted from HTML content.

    Attributes:
        title: The section heading text.
        level: Heading level (1-6).
        content_html: Raw HTML of the section body (everything between
            this heading and the next heading of the same or higher level).
        content_text: Plain-text version of the section body.
        items: List of extracted bullet/numbered items (if the section
            contains a list).
    """

    title: str
    level: int = 2
    content_html: str = ""
    content_text: str = ""
    items: list[str] = field(default_factory=list)


class HTMLContentParser:
    """
    Parse HTML content from the Tiptap editor into structured sections.

    This enables the DOCX export service to map HTML sections back into
    the same structured document format used for markdown content.
    """

    def __init__(self, html_content: str) -> None:
        self._html = html_content
        self._sections: list[ParsedSection] = []
        self._parsed = False

    def parse(self) -> list[ParsedSection]:
        """
        Parse the HTML into a list of ``ParsedSection`` objects.

        Returns:
            Ordered list of sections found in the HTML.
        """
        if self._parsed:
            return self._sections

        self._sections = self._split_by_headings(self._html)
        self._parsed = True
        return self._sections

    # -- public helpers --

    def get_section_by_title(self, *title_patterns: str) -> Optional[ParsedSection]:
        """
        Find the first section whose title matches any of the given patterns
        (case-insensitive substring match).
        """
        if not self._parsed:
            self.parse()

        for section in self._sections:
            title_lower = section.title.lower()
            for pattern in title_patterns:
                if pattern.lower() in title_lower:
                    return section
        return None

    def get_all_text(self) -> str:
        """Return the full plain-text rendering of the HTML."""
        return strip_html_tags(self._html)

    # -- internal --

    @staticmethod
    def _split_by_headings(html: str) -> list[ParsedSection]:
        """
        Split HTML content at heading boundaries.

        Each heading starts a new section; everything up to the next
        heading (or end of document) becomes that section's body.
        """
        # Match heading tags h1-h6 with their content.
        heading_pattern = re.compile(
            r"<(h[1-6])\b[^>]*>(.*?)</\1>",
            re.IGNORECASE | re.DOTALL,
        )

        sections: list[ParsedSection] = []
        last_end = 0

        matches = list(heading_pattern.finditer(html))

        # If there are no headings, treat the entire content as one section.
        if not matches:
            text = strip_html_tags(html).strip()
            if text:
                sections.append(
                    ParsedSection(
                        title="Content",
                        level=1,
                        content_html=html,
                        content_text=text,
                        items=extract_list_items(html),
                    )
                )
            return sections

        # Content before the first heading (preamble).
        preamble_html = html[: matches[0].start()].strip()
        if preamble_html:
            preamble_text = strip_html_tags(preamble_html).strip()
            if preamble_text:
                sections.append(
                    ParsedSection(
                        title="Introduction",
                        level=1,
                        content_html=preamble_html,
                        content_text=preamble_text,
                    )
                )

        for i, match in enumerate(matches):
            tag = match.group(1).lower()
            level = int(tag[1])
            heading_text = strip_html_tags(match.group(2)).strip()

            # Body = everything from end of this heading tag to start of next heading.
            body_start = match.end()
            body_end = matches[i + 1].start() if i + 1 < len(matches) else len(html)
            body_html = html[body_start:body_end].strip()
            body_text = strip_html_tags(body_html).strip()

            sections.append(
                ParsedSection(
                    title=heading_text,
                    level=level,
                    content_html=body_html,
                    content_text=body_text,
                    items=extract_list_items(body_html),
                )
            )

        return sections


# ---------------------------------------------------------------------------
# Low-level HTML utility functions
# ---------------------------------------------------------------------------


def strip_html_tags(html: str) -> str:
    """
    Remove all HTML tags and return plain text.

    Handles common entities (``&amp;``, ``&lt;``, ``&gt;``, ``&quot;``,
    ``&nbsp;``) and collapses excessive whitespace.

    Args:
        html: An HTML string.

    Returns:
        Plain text with tags removed.
    """
    if not html:
        return ""

    # Replace block-level closing tags with newlines so paragraphs separate.
    text = re.sub(r"</(?:p|div|h[1-6]|li|tr|blockquote|pre)>", "\n", html, flags=re.IGNORECASE)

    # Replace <br> / <br/> with newlines.
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)

    # Strip remaining tags.
    text = re.sub(r"<[^>]+>", "", text)

    # Decode common entities.
    entity_map = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&apos;": "'",
        "&nbsp;": " ",
        "&#39;": "'",
    }
    for entity, char in entity_map.items():
        text = text.replace(entity, char)

    # Collapse runs of whitespace on a single line.
    text = re.sub(r"[ \t]+", " ", text)
    # Collapse multiple blank lines.
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def extract_list_items(html: str) -> list[str]:
    """
    Extract text content from ``<li>`` elements in the HTML.

    Args:
        html: An HTML fragment potentially containing ``<ul>`` / ``<ol>`` lists.

    Returns:
        List of plain-text strings, one per ``<li>`` element.
    """
    if not html:
        return []

    li_pattern = re.compile(r"<li\b[^>]*>(.*?)</li>", re.IGNORECASE | re.DOTALL)
    items: list[str] = []
    for match in li_pattern.finditer(html):
        text = strip_html_tags(match.group(1)).strip()
        if text:
            items.append(text)
    return items


def extract_table_rows(html: str) -> list[list[str]]:
    """
    Extract table data from ``<table>`` HTML.

    Args:
        html: An HTML fragment containing a ``<table>`` element.

    Returns:
        A list of rows, where each row is a list of cell text values.
    """
    if not html:
        return []

    row_pattern = re.compile(r"<tr\b[^>]*>(.*?)</tr>", re.IGNORECASE | re.DOTALL)
    cell_pattern = re.compile(r"<(?:td|th)\b[^>]*>(.*?)</(?:td|th)>", re.IGNORECASE | re.DOTALL)

    rows: list[list[str]] = []
    for row_match in row_pattern.finditer(html):
        cells: list[str] = []
        for cell_match in cell_pattern.finditer(row_match.group(1)):
            cells.append(strip_html_tags(cell_match.group(1)).strip())
        if cells:
            rows.append(cells)
    return rows


def html_to_text_with_formatting(html: str) -> list[dict[str, Any]]:
    """
    Parse inline HTML into a list of text runs with formatting metadata.

    Each run is a dict with keys:
      - ``text``: The text content of the run.
      - ``bold``: Whether the text is bold.
      - ``italic``: Whether the text is italic.
      - ``underline``: Whether the text is underlined.
      - ``strikethrough``: Whether the text has a strikethrough.

    This is used by the DOCX service to apply ``python-docx`` run-level
    formatting when adding paragraph content.

    Args:
        html: An inline HTML fragment (e.g., the content of a ``<p>`` tag).

    Returns:
        Ordered list of text-run dicts.
    """
    if not html:
        return []

    parser = _InlineHTMLParser()
    parser.feed(html)
    return parser.runs


class _InlineHTMLParser(HTMLParser):
    """Parse inline HTML into formatted text runs."""

    _BOLD_TAGS = {"strong", "b"}
    _ITALIC_TAGS = {"em", "i"}
    _UNDERLINE_TAGS = {"u"}
    _STRIKE_TAGS = {"s", "del", "strike"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.runs: list[dict[str, Any]] = []
        self._bold_depth = 0
        self._italic_depth = 0
        self._underline_depth = 0
        self._strike_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        tag = tag.lower()
        if tag in self._BOLD_TAGS:
            self._bold_depth += 1
        elif tag in self._ITALIC_TAGS:
            self._italic_depth += 1
        elif tag in self._UNDERLINE_TAGS:
            self._underline_depth += 1
        elif tag in self._STRIKE_TAGS:
            self._strike_depth += 1
        elif tag == "br":
            self.runs.append({
                "text": "\n",
                "bold": False,
                "italic": False,
                "underline": False,
                "strikethrough": False,
            })

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in self._BOLD_TAGS:
            self._bold_depth = max(0, self._bold_depth - 1)
        elif tag in self._ITALIC_TAGS:
            self._italic_depth = max(0, self._italic_depth - 1)
        elif tag in self._UNDERLINE_TAGS:
            self._underline_depth = max(0, self._underline_depth - 1)
        elif tag in self._STRIKE_TAGS:
            self._strike_depth = max(0, self._strike_depth - 1)

    def handle_data(self, data: str) -> None:
        if not data:
            return
        self.runs.append({
            "text": data,
            "bold": self._bold_depth > 0,
            "italic": self._italic_depth > 0,
            "underline": self._underline_depth > 0,
            "strikethrough": self._strike_depth > 0,
        })

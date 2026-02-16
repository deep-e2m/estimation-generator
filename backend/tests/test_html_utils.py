"""
Tests for HTML content detection, sanitization, and parsing utilities.

Covers:
- is_html_content / detect_content_format
- sanitize_html (XSS prevention)
- HTMLContentParser (section extraction)
- strip_html_tags
- extract_list_items / extract_table_rows
- html_to_text_with_formatting
"""

import pytest

from app.services.export.html_utils import (
    HTMLContentParser,
    detect_content_format,
    extract_list_items,
    extract_table_rows,
    html_to_text_with_formatting,
    is_html_content,
    sanitize_html,
    strip_html_tags,
)


# =============================================================================
# is_html_content / detect_content_format
# =============================================================================


class TestIsHtmlContent:
    """Tests for HTML content detection."""

    def test_plain_markdown_returns_false(self) -> None:
        content = "# Executive Summary\n\nThis is a markdown quote.\n\n- Item 1\n- Item 2"
        assert is_html_content(content) is False

    def test_html_with_heading_returns_true(self) -> None:
        content = "<h1>Executive Summary</h1><p>This is an HTML quote.</p>"
        assert is_html_content(content) is True

    def test_html_with_paragraph_returns_true(self) -> None:
        content = "<p>Just a paragraph of text.</p>"
        assert is_html_content(content) is True

    def test_html_with_list_returns_true(self) -> None:
        content = "<ul><li>Item one</li><li>Item two</li></ul>"
        assert is_html_content(content) is True

    def test_html_with_inline_formatting_returns_true(self) -> None:
        content = "<p>This has <strong>bold</strong> and <em>italic</em> text.</p>"
        assert is_html_content(content) is True

    def test_empty_string_returns_false(self) -> None:
        assert is_html_content("") is False

    def test_whitespace_only_returns_false(self) -> None:
        assert is_html_content("   \n\t  ") is False

    def test_angle_brackets_in_text_no_false_positive(self) -> None:
        content = "The value is < 5 and > 2. Use array<T> for generics."
        assert is_html_content(content) is False

    def test_detect_content_format_html(self) -> None:
        assert detect_content_format("<h1>Title</h1>") == "html"

    def test_detect_content_format_markdown(self) -> None:
        assert detect_content_format("# Title") == "markdown"


# =============================================================================
# sanitize_html
# =============================================================================


class TestSanitizeHtml:
    """Tests for HTML sanitization (XSS prevention)."""

    def test_preserves_allowed_tags(self) -> None:
        html = "<h1>Title</h1><p><strong>Bold</strong> and <em>italic</em></p>"
        result = sanitize_html(html)
        assert "<h1>" in result
        assert "<strong>" in result
        assert "<em>" in result

    def test_strips_script_tag(self) -> None:
        html = '<p>Hello</p><script>alert("XSS")</script><p>World</p>'
        result = sanitize_html(html)
        assert "<script>" not in result
        assert "alert" not in result
        assert "<p>Hello</p>" in result
        assert "<p>World</p>" in result

    def test_strips_style_tag(self) -> None:
        html = "<style>body { display: none; }</style><p>Content</p>"
        result = sanitize_html(html)
        assert "<style>" not in result
        assert "display: none" not in result
        assert "<p>Content</p>" in result

    def test_strips_onclick_attribute(self) -> None:
        html = '<p onclick="alert(1)">Click me</p>'
        result = sanitize_html(html)
        assert "onclick" not in result
        assert "<p>" in result
        assert "Click me" in result

    def test_strips_javascript_href(self) -> None:
        html = '<a href="javascript:alert(1)">Link</a>'
        result = sanitize_html(html)
        assert "javascript:" not in result

    def test_preserves_safe_href(self) -> None:
        html = '<a href="https://example.com">Link</a>'
        result = sanitize_html(html)
        assert 'href="https://example.com"' in result

    def test_strips_unknown_tags_preserves_text(self) -> None:
        html = "<p>Before</p><iframe src='evil.com'>inside</iframe><p>After</p>"
        result = sanitize_html(html)
        assert "<iframe" not in result
        assert "inside" in result  # Text content preserved
        assert "<p>Before</p>" in result

    def test_allows_text_align_style(self) -> None:
        html = '<p style="text-align: center">Centered</p>'
        result = sanitize_html(html)
        assert "text-align: center" in result

    def test_strips_dangerous_css(self) -> None:
        html = '<p style="position: absolute; z-index: 9999">Evil</p>'
        result = sanitize_html(html)
        assert "position" not in result
        assert "z-index" not in result

    def test_empty_input(self) -> None:
        assert sanitize_html("") == ""
        assert sanitize_html(None) is None

    def test_preserves_br_tags(self) -> None:
        html = "<p>Line one<br>Line two</p>"
        result = sanitize_html(html)
        assert "<br />" in result or "<br>" in result


# =============================================================================
# strip_html_tags
# =============================================================================


class TestStripHtmlTags:
    """Tests for HTML tag stripping."""

    def test_strips_all_tags(self) -> None:
        html = "<h1>Title</h1><p>Some <strong>bold</strong> text.</p>"
        result = strip_html_tags(html)
        assert "<h1>" not in result
        assert "<strong>" not in result
        assert "Title" in result
        assert "bold" in result

    def test_preserves_newlines_between_blocks(self) -> None:
        html = "<p>Paragraph one</p><p>Paragraph two</p>"
        result = strip_html_tags(html)
        assert "Paragraph one" in result
        assert "Paragraph two" in result

    def test_handles_br_tags(self) -> None:
        html = "Line one<br/>Line two"
        result = strip_html_tags(html)
        assert "Line one" in result
        assert "Line two" in result

    def test_decodes_entities(self) -> None:
        html = "5 &gt; 3 &amp; 2 &lt; 4"
        result = strip_html_tags(html)
        assert "5 > 3 & 2 < 4" in result

    def test_empty_input(self) -> None:
        assert strip_html_tags("") == ""
        assert strip_html_tags(None) == ""


# =============================================================================
# extract_list_items
# =============================================================================


class TestExtractListItems:
    """Tests for list item extraction."""

    def test_extracts_unordered_list(self) -> None:
        html = "<ul><li>First item</li><li>Second item</li><li>Third item</li></ul>"
        items = extract_list_items(html)
        assert items == ["First item", "Second item", "Third item"]

    def test_extracts_ordered_list(self) -> None:
        html = "<ol><li>Step one</li><li>Step two</li></ol>"
        items = extract_list_items(html)
        assert items == ["Step one", "Step two"]

    def test_strips_inner_formatting(self) -> None:
        html = "<ul><li><strong>Bold</strong> item</li></ul>"
        items = extract_list_items(html)
        assert items == ["Bold item"]

    def test_empty_input(self) -> None:
        assert extract_list_items("") == []
        assert extract_list_items(None) == []

    def test_no_lists(self) -> None:
        html = "<p>Just a paragraph</p>"
        assert extract_list_items(html) == []


# =============================================================================
# extract_table_rows
# =============================================================================


class TestExtractTableRows:
    """Tests for table extraction."""

    def test_extracts_simple_table(self) -> None:
        html = """
        <table>
            <tr><th>Task</th><th>Hours</th></tr>
            <tr><td>Frontend</td><td>40</td></tr>
            <tr><td>Backend</td><td>60</td></tr>
        </table>
        """
        rows = extract_table_rows(html)
        assert len(rows) == 3
        assert rows[0] == ["Task", "Hours"]
        assert rows[1] == ["Frontend", "40"]
        assert rows[2] == ["Backend", "60"]

    def test_empty_input(self) -> None:
        assert extract_table_rows("") == []

    def test_no_tables(self) -> None:
        html = "<p>No table here</p>"
        assert extract_table_rows(html) == []


# =============================================================================
# html_to_text_with_formatting
# =============================================================================


class TestHtmlToTextWithFormatting:
    """Tests for inline formatting extraction."""

    def test_plain_text(self) -> None:
        runs = html_to_text_with_formatting("Hello world")
        assert len(runs) == 1
        assert runs[0]["text"] == "Hello world"
        assert runs[0]["bold"] is False
        assert runs[0]["italic"] is False

    def test_bold_text(self) -> None:
        runs = html_to_text_with_formatting("Normal <strong>bold</strong> text")
        assert any(r["text"] == "bold" and r["bold"] is True for r in runs)
        assert any(r["text"] == "Normal " and r["bold"] is False for r in runs)

    def test_italic_text(self) -> None:
        runs = html_to_text_with_formatting("Normal <em>italic</em> text")
        assert any(r["text"] == "italic" and r["italic"] is True for r in runs)

    def test_nested_formatting(self) -> None:
        runs = html_to_text_with_formatting("<strong><em>bold italic</em></strong>")
        assert any(
            r["text"] == "bold italic" and r["bold"] is True and r["italic"] is True
            for r in runs
        )

    def test_underline(self) -> None:
        runs = html_to_text_with_formatting("<u>underlined</u>")
        assert any(r["text"] == "underlined" and r["underline"] is True for r in runs)

    def test_strikethrough(self) -> None:
        runs = html_to_text_with_formatting("<s>struck</s>")
        assert any(r["text"] == "struck" and r["strikethrough"] is True for r in runs)

    def test_empty_input(self) -> None:
        assert html_to_text_with_formatting("") == []
        assert html_to_text_with_formatting(None) == []

    def test_br_produces_newline(self) -> None:
        runs = html_to_text_with_formatting("Line one<br>Line two")
        texts = [r["text"] for r in runs]
        assert "\n" in texts


# =============================================================================
# HTMLContentParser
# =============================================================================


class TestHTMLContentParser:
    """Tests for structured HTML section parsing."""

    def test_parses_sections_by_headings(self) -> None:
        html = """
        <h1>Executive Summary</h1>
        <p>This is the summary.</p>
        <h2>Scope</h2>
        <p>The scope of work includes:</p>
        <ul><li>Item A</li><li>Item B</li></ul>
        <h2>Assumptions</h2>
        <ul><li>Assumption 1</li><li>Assumption 2</li></ul>
        """
        parser = HTMLContentParser(html)
        sections = parser.parse()

        assert len(sections) >= 3
        assert sections[0].title == "Executive Summary"
        assert sections[0].level == 1
        assert "summary" in sections[0].content_text.lower()

        assert sections[1].title == "Scope"
        assert sections[1].level == 2
        assert "Item A" in sections[1].items[0]

        assert sections[2].title == "Assumptions"
        assert len(sections[2].items) == 2

    def test_get_section_by_title(self) -> None:
        html = """
        <h2>Assumptions</h2>
        <ul><li>Client provides content</li></ul>
        <h2>Exclusions</h2>
        <ul><li>Hosting costs</li></ul>
        """
        parser = HTMLContentParser(html)
        parser.parse()

        assumptions = parser.get_section_by_title("assumption", "assumptions")
        assert assumptions is not None
        assert assumptions.title == "Assumptions"
        assert "Client provides content" in assumptions.items

        exclusions = parser.get_section_by_title("exclusion", "exclusions")
        assert exclusions is not None
        assert "Hosting costs" in exclusions.items

    def test_no_headings_returns_single_section(self) -> None:
        html = "<p>Just some text without headings.</p>"
        parser = HTMLContentParser(html)
        sections = parser.parse()

        assert len(sections) == 1
        assert sections[0].title == "Content"
        assert "without headings" in sections[0].content_text

    def test_empty_content(self) -> None:
        parser = HTMLContentParser("")
        sections = parser.parse()
        assert sections == []

    def test_get_all_text(self) -> None:
        html = "<h1>Title</h1><p><strong>Bold</strong> text</p>"
        parser = HTMLContentParser(html)
        text = parser.get_all_text()
        assert "Title" in text
        assert "Bold" in text
        assert "text" in text
        assert "<" not in text

    def test_preamble_before_first_heading(self) -> None:
        html = "<p>Preamble paragraph</p><h1>First Section</h1><p>Body</p>"
        parser = HTMLContentParser(html)
        sections = parser.parse()

        assert sections[0].title == "Introduction"
        assert "Preamble" in sections[0].content_text
        assert sections[1].title == "First Section"

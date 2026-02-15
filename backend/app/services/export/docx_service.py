"""
DOCX export service for generating professional quote documents.

This module provides functionality to export quotes as professionally
formatted Microsoft Word documents with proper styling, branding,
and structured content.

Supports two content formats:
- **Markdown/plain text** (from AI generation) -- the original format.
- **HTML** (from the Tiptap inline editor) -- added for the inline
  editing feature.  HTML is detected automatically via
  ``html_utils.is_html_content`` and parsed into the same DOCX
  structures using ``HTMLContentParser``.
"""

import io
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
from docx.shared import Inches, Pt, RGBColor
from docx.table import Table

from app.services.export.html_utils import (
    HTMLContentParser,
    extract_list_items,
    extract_table_rows,
    html_to_text_with_formatting,
    is_html_content,
    strip_html_tags,
)

logger = logging.getLogger(__name__)


@dataclass
class QuoteExportData:
    """
    Data container for quote export.

    Contains all the information needed to generate a professional
    quote document.

    Attributes:
        title: The quote title.
        client_name: Name of the client (extracted from project or metadata).
        project_name: Name of the project.
        requirements: Original requirements text.
        content: Full quote content from LLM.
        total_hours: Total estimated hours.
        total_cost: Total estimated cost.
        platform: Target platform.
        complexity: Project complexity level.
        created_at: When the quote was created.
        creator_name: Name of the quote creator.
        breakdown: Hour breakdown by phase/task (from metadata).
        assumptions: List of assumptions (from metadata).
        exclusions: List of exclusions (from metadata).
        extra_metadata: Additional metadata.
    """

    title: str
    client_name: str
    project_name: str
    requirements: str
    content: str
    total_hours: Decimal
    total_cost: Decimal
    platform: str
    complexity: str
    created_at: datetime
    creator_name: Optional[str] = None
    breakdown: Optional[list[dict[str, Any]]] = None
    assumptions: Optional[list[str]] = None
    exclusions: Optional[list[str]] = None
    extra_metadata: Optional[dict[str, Any]] = None


class DocxExportService:
    """
    Service for generating professional DOCX documents from quotes.

    This service creates well-formatted Microsoft Word documents
    with consistent branding, professional styling, and structured
    content following a standard proposal format.

    It transparently handles both markdown (AI-generated) and HTML
    (Tiptap editor) content by detecting the format at runtime and
    dispatching to the appropriate parsing logic.

    Example:
        ```python
        service = DocxExportService()
        docx_bytes = service.generate_quote_document(quote_data)
        ```
    """

    # Company branding constants
    COMPANY_NAME = "E2M Solutions"
    COMPANY_TAGLINE = "Digital Excellence Delivered"

    # Color scheme (E2M brand colors)
    PRIMARY_COLOR = RGBColor(0, 82, 147)  # Deep Blue
    SECONDARY_COLOR = RGBColor(41, 128, 185)  # Light Blue
    ACCENT_COLOR = RGBColor(46, 204, 113)  # Green for highlights
    TEXT_COLOR = RGBColor(51, 51, 51)  # Dark gray for text
    HEADER_BG_COLOR = "0052930"  # Hex for table headers

    # Font settings
    FONT_NAME = "Calibri"
    FONT_NAME_HEADING = "Calibri Light"

    def __init__(self) -> None:
        """Initialize the DOCX export service."""
        self._document: Optional[Document] = None

    def generate_quote_document(self, data: QuoteExportData) -> bytes:
        """
        Generate a professional DOCX document for a quote.

        Args:
            data: QuoteExportData containing all quote information.

        Returns:
            bytes: The generated DOCX document as bytes.

        Raises:
            ValueError: If required data is missing.
            Exception: If document generation fails.
        """
        logger.info("Generating DOCX document for quote: %s", data.title)

        try:
            # Create new document
            self._document = Document()

            # Set up document styles
            self._setup_styles()

            # Set document properties
            self._set_document_properties(data)

            # Build document sections
            self._add_header(data)
            self._add_title_page(data)
            self._add_project_overview(data)
            self._add_scope_of_work(data)
            self._add_estimated_hours(data)
            self._add_timeline(data)
            self._add_assumptions(data)
            self._add_exclusions(data)
            self._add_terms_and_conditions()
            self._add_footer()

            # Save to bytes
            buffer = io.BytesIO()
            self._document.save(buffer)
            buffer.seek(0)

            logger.info("DOCX document generated successfully")
            return buffer.getvalue()

        except Exception as e:
            logger.error("Failed to generate DOCX document: %s", str(e))
            raise

    # =========================================================================
    # Style setup
    # =========================================================================

    def _setup_styles(self) -> None:
        """Set up custom document styles."""
        if self._document is None:
            return

        styles = self._document.styles

        # Modify Normal style
        normal_style = styles["Normal"]
        normal_font = normal_style.font
        normal_font.name = self.FONT_NAME
        normal_font.size = Pt(11)
        normal_font.color.rgb = self.TEXT_COLOR
        normal_para = normal_style.paragraph_format
        normal_para.space_after = Pt(8)
        normal_para.line_spacing_rule = WD_LINE_SPACING.SINGLE

        # Modify Heading 1
        h1_style = styles["Heading 1"]
        h1_font = h1_style.font
        h1_font.name = self.FONT_NAME_HEADING
        h1_font.size = Pt(24)
        h1_font.bold = True
        h1_font.color.rgb = self.PRIMARY_COLOR
        h1_para = h1_style.paragraph_format
        h1_para.space_before = Pt(24)
        h1_para.space_after = Pt(12)

        # Modify Heading 2
        h2_style = styles["Heading 2"]
        h2_font = h2_style.font
        h2_font.name = self.FONT_NAME_HEADING
        h2_font.size = Pt(18)
        h2_font.bold = True
        h2_font.color.rgb = self.PRIMARY_COLOR
        h2_para = h2_style.paragraph_format
        h2_para.space_before = Pt(18)
        h2_para.space_after = Pt(8)

        # Modify Heading 3
        h3_style = styles["Heading 3"]
        h3_font = h3_style.font
        h3_font.name = self.FONT_NAME_HEADING
        h3_font.size = Pt(14)
        h3_font.bold = True
        h3_font.color.rgb = self.SECONDARY_COLOR
        h3_para = h3_style.paragraph_format
        h3_para.space_before = Pt(12)
        h3_para.space_after = Pt(6)

        # Create custom style for table header
        try:
            table_header_style = styles.add_style(
                "TableHeader", WD_STYLE_TYPE.PARAGRAPH
            )
            table_header_font = table_header_style.font
            table_header_font.name = self.FONT_NAME
            table_header_font.size = Pt(11)
            table_header_font.bold = True
            table_header_font.color.rgb = RGBColor(255, 255, 255)
        except ValueError:
            # Style already exists
            pass

        # Create custom style for emphasis
        try:
            emphasis_style = styles.add_style("CustomEmphasis", WD_STYLE_TYPE.PARAGRAPH)
            emphasis_font = emphasis_style.font
            emphasis_font.name = self.FONT_NAME
            emphasis_font.size = Pt(11)
            emphasis_font.italic = True
            emphasis_font.color.rgb = self.SECONDARY_COLOR
        except ValueError:
            pass

    # =========================================================================
    # Document metadata
    # =========================================================================

    def _set_document_properties(self, data: QuoteExportData) -> None:
        """Set document metadata properties."""
        if self._document is None:
            return

        core_props = self._document.core_properties
        core_props.author = self.COMPANY_NAME
        core_props.title = f"Proposal - {data.title}"
        core_props.subject = f"Project Proposal for {data.client_name}"
        core_props.keywords = f"{data.platform}, proposal, quote, {data.complexity}"
        core_props.category = "Proposal"
        core_props.comments = f"Generated by {self.COMPANY_NAME} Estimation Tool"

    # =========================================================================
    # Header / Footer
    # =========================================================================

    def _add_header(self, data: QuoteExportData) -> None:
        """Add company header to the document."""
        if self._document is None:
            return

        section = self._document.sections[0]
        header = section.header

        # Create header table for alignment
        header_table = header.add_table(rows=1, cols=2, width=Inches(6.5))
        header_table.autofit = False

        # Left cell - Company name
        left_cell = header_table.cell(0, 0)
        left_para = left_cell.paragraphs[0]
        left_run = left_para.add_run(self.COMPANY_NAME)
        left_run.font.name = self.FONT_NAME_HEADING
        left_run.font.size = Pt(14)
        left_run.font.bold = True
        left_run.font.color.rgb = self.PRIMARY_COLOR

        # Add tagline
        tagline_para = left_cell.add_paragraph()
        tagline_run = tagline_para.add_run(self.COMPANY_TAGLINE)
        tagline_run.font.name = self.FONT_NAME
        tagline_run.font.size = Pt(9)
        tagline_run.font.italic = True
        tagline_run.font.color.rgb = self.SECONDARY_COLOR

        # Right cell - Date
        right_cell = header_table.cell(0, 1)
        right_para = right_cell.paragraphs[0]
        right_para.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        date_run = right_para.add_run(data.created_at.strftime("%B %d, %Y"))
        date_run.font.name = self.FONT_NAME
        date_run.font.size = Pt(10)
        date_run.font.color.rgb = self.TEXT_COLOR

        # Add separator line
        header.add_paragraph().add_run("_" * 85).font.color.rgb = self.PRIMARY_COLOR

    def _add_footer(self) -> None:
        """Add document footer."""
        if self._document is None:
            return

        section = self._document.sections[0]
        footer = section.footer

        footer_para = footer.paragraphs[0]
        footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

        footer_run = footer_para.add_run(
            f"{self.COMPANY_NAME} | Confidential Proposal | "
        )
        footer_run.font.name = self.FONT_NAME
        footer_run.font.size = Pt(9)
        footer_run.font.color.rgb = self.TEXT_COLOR

    # =========================================================================
    # Title page
    # =========================================================================

    def _add_title_page(self, data: QuoteExportData) -> None:
        """Add title page with proposal information."""
        if self._document is None:
            return

        # Main title
        title_para = self._document.add_paragraph()
        title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        title_para.paragraph_format.space_before = Pt(72)
        title_para.paragraph_format.space_after = Pt(24)

        title_run = title_para.add_run("PROJECT PROPOSAL")
        title_run.font.name = self.FONT_NAME_HEADING
        title_run.font.size = Pt(36)
        title_run.font.bold = True
        title_run.font.color.rgb = self.PRIMARY_COLOR

        # Subtitle with client name
        subtitle_para = self._document.add_paragraph()
        subtitle_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        subtitle_para.paragraph_format.space_after = Pt(48)

        subtitle_text = f"Proposal for {data.client_name}"
        subtitle_run = subtitle_para.add_run(subtitle_text)
        subtitle_run.font.name = self.FONT_NAME_HEADING
        subtitle_run.font.size = Pt(24)
        subtitle_run.font.color.rgb = self.SECONDARY_COLOR

        # Project title
        project_para = self._document.add_paragraph()
        project_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        project_para.paragraph_format.space_after = Pt(48)

        project_run = project_para.add_run(data.title)
        project_run.font.name = self.FONT_NAME
        project_run.font.size = Pt(16)
        project_run.font.italic = True
        project_run.font.color.rgb = self.TEXT_COLOR

        # Prepared by section
        prepared_para = self._document.add_paragraph()
        prepared_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        prepared_para.paragraph_format.space_before = Pt(48)

        prepared_run = prepared_para.add_run("Prepared by:")
        prepared_run.font.name = self.FONT_NAME
        prepared_run.font.size = Pt(12)
        prepared_run.font.color.rgb = self.TEXT_COLOR

        company_para = self._document.add_paragraph()
        company_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

        company_run = company_para.add_run(self.COMPANY_NAME)
        company_run.font.name = self.FONT_NAME_HEADING
        company_run.font.size = Pt(16)
        company_run.font.bold = True
        company_run.font.color.rgb = self.PRIMARY_COLOR

        # Creator name if available
        if data.creator_name:
            creator_para = self._document.add_paragraph()
            creator_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

            creator_run = creator_para.add_run(data.creator_name)
            creator_run.font.name = self.FONT_NAME
            creator_run.font.size = Pt(12)
            creator_run.font.color.rgb = self.TEXT_COLOR

        # Date
        date_para = self._document.add_paragraph()
        date_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        date_para.paragraph_format.space_before = Pt(24)

        date_run = date_para.add_run(data.created_at.strftime("%B %d, %Y"))
        date_run.font.name = self.FONT_NAME
        date_run.font.size = Pt(12)
        date_run.font.color.rgb = self.TEXT_COLOR

        # Page break
        self._document.add_page_break()

    # =========================================================================
    # Project overview
    # =========================================================================

    def _add_project_overview(self, data: QuoteExportData) -> None:
        """Add project overview section."""
        if self._document is None:
            return

        self._document.add_heading("Project Overview", level=1)

        # Project summary table
        table = self._document.add_table(rows=5, cols=2)
        table.style = "Table Grid"
        self._style_info_table(table)

        # Populate table
        rows_data = [
            ("Project Name", data.project_name),
            ("Client", data.client_name),
            ("Platform", data.platform.replace("_", " ").title()),
            ("Complexity", data.complexity.title()),
            ("Total Estimated Hours", f"{data.total_hours:,.1f} hours"),
        ]

        for i, (label, value) in enumerate(rows_data):
            table.cell(i, 0).text = label
            table.cell(i, 1).text = str(value)

            # Style label cell
            label_para = table.cell(i, 0).paragraphs[0]
            label_run = label_para.runs[0]
            label_run.font.bold = True
            label_run.font.color.rgb = self.PRIMARY_COLOR

        # Add spacing after table
        self._document.add_paragraph()

        # Add requirements summary
        self._document.add_heading("Client Requirements", level=2)

        # Clean and add requirements text
        requirements_text = self._clean_text(data.requirements)
        req_para = self._document.add_paragraph(requirements_text)
        req_para.paragraph_format.left_indent = Inches(0.25)

    # =========================================================================
    # Scope of work -- supports both markdown and HTML content
    # =========================================================================

    def _add_scope_of_work(self, data: QuoteExportData) -> None:
        """
        Add scope of work section parsed from content.

        Automatically detects whether ``data.content`` is HTML (from the
        Tiptap editor) or markdown (from AI generation) and delegates
        to the appropriate parsing path.
        """
        if self._document is None:
            return

        self._document.add_heading("Scope of Work", level=1)

        content = data.content

        if is_html_content(content):
            self._add_scope_of_work_from_html(content)
        else:
            self._add_scope_of_work_from_markdown(content)

    def _add_scope_of_work_from_markdown(self, content: str) -> None:
        """Original markdown-based scope of work rendering."""
        scope_sections = self._extract_scope_sections_markdown(content)

        if scope_sections:
            for section_title, section_content in scope_sections:
                self._document.add_heading(section_title, level=2)
                self._add_formatted_content_markdown(section_content)
        else:
            self._add_formatted_content_markdown(content)

    def _add_scope_of_work_from_html(self, content: str) -> None:
        """
        Render scope of work from HTML content produced by the Tiptap editor.

        Parses the HTML into sections using ``HTMLContentParser`` and
        converts each section into formatted DOCX elements (headings,
        paragraphs with inline formatting, lists, tables).
        """
        parser = HTMLContentParser(content)
        sections = parser.parse()

        if not sections:
            # Fallback: render the plain text.
            plain = strip_html_tags(content).strip()
            if plain:
                self._add_formatted_content_markdown(plain)
            return

        for section in sections:
            # Add the section heading (map HTML heading levels).
            # Level 1 in HTML becomes level 2 in the DOCX since the
            # "Scope of Work" heading is already level 1.
            docx_level = min(section.level + 1, 3)
            if section.title and section.title != "Content":
                self._document.add_heading(section.title, level=docx_level)

            # Render the section body as formatted DOCX content.
            if section.content_html:
                self._add_formatted_content_html(section.content_html)

    # =========================================================================
    # Formatted content rendering
    # =========================================================================

    def _add_formatted_content(self, content: str) -> None:
        """
        Add formatted content to the document.

        Auto-detects HTML vs markdown and dispatches accordingly.

        Args:
            content: Text content to format (markdown or HTML).
        """
        if is_html_content(content):
            self._add_formatted_content_html(content)
        else:
            self._add_formatted_content_markdown(content)

    def _add_formatted_content_markdown(self, content: str) -> None:
        """
        Add formatted content from markdown/plain-text to the document.

        Handles bullet points, numbered lists, and paragraphs.
        This is the original implementation, preserved for backward
        compatibility with AI-generated markdown content.

        Args:
            content: Markdown/plain-text content to format.
        """
        if self._document is None:
            return

        lines = content.split("\n")
        current_para = None

        for line in lines:
            line = line.strip()

            if not line:
                current_para = None
                continue

            # Check for bullet points
            if line.startswith(("-", "*", "+")):
                bullet_text = line.lstrip("-*+ ").strip()
                para = self._document.add_paragraph(bullet_text, style="List Bullet")
                para.paragraph_format.left_indent = Inches(0.5)

            # Check for numbered lists
            elif re.match(r"^\d+\.", line):
                number_text = re.sub(r"^\d+\.\s*", "", line)
                para = self._document.add_paragraph(number_text, style="List Number")
                para.paragraph_format.left_indent = Inches(0.5)

            # Check for sub-headers (markdown style)
            elif line.startswith("##"):
                header_text = line.lstrip("#").strip()
                self._document.add_heading(header_text, level=3)

            # Regular paragraph
            else:
                if current_para is None:
                    current_para = self._document.add_paragraph()

                if current_para.text:
                    current_para.add_run(" ")
                current_para.add_run(line)

    def _add_formatted_content_html(self, html_content: str) -> None:
        """
        Add formatted content from HTML to the DOCX document.

        Parses the HTML element-by-element and creates corresponding
        python-docx objects:
        - ``<h1>``-``<h3>`` -> ``add_heading``
        - ``<p>`` -> ``add_paragraph`` with inline formatting runs
        - ``<ul>/<ol>`` -> ``List Bullet`` / ``List Number`` style
        - ``<blockquote>`` -> indented italic paragraph
        - ``<table>`` -> ``add_table``
        - ``<pre><code>`` -> code-block paragraph

        Args:
            html_content: HTML fragment to render.
        """
        if self._document is None:
            return

        # Process top-level block elements with regex-based splitting.
        # This avoids a full DOM dependency while handling Tiptap's
        # predictably clean output.
        self._render_html_blocks(html_content)

    def _render_html_blocks(self, html: str) -> None:
        """
        Walk through top-level HTML block elements and render each one.

        Args:
            html: An HTML fragment.
        """
        if not html or not html.strip():
            return

        # Match top-level block elements.  Tiptap produces a flat
        # sequence of <p>, <h1>-<h6>, <ul>, <ol>, <blockquote>,
        # <pre>, <table>, etc.
        block_pattern = re.compile(
            r"<(h[1-6]|p|ul|ol|blockquote|pre|table|div)\b[^>]*>(.*?)</\1>",
            re.IGNORECASE | re.DOTALL,
        )

        last_end = 0
        for match in block_pattern.finditer(html):
            # Any plain text between block elements (rare in Tiptap output).
            gap_text = strip_html_tags(html[last_end:match.start()]).strip()
            if gap_text:
                self._document.add_paragraph(gap_text)

            tag = match.group(1).lower()
            inner = match.group(2)

            if tag.startswith("h") and len(tag) == 2 and tag[1].isdigit():
                level = int(tag[1])
                heading_text = strip_html_tags(inner).strip()
                if heading_text:
                    # Cap at level 3 for DOCX (levels 1-3 are styled).
                    self._document.add_heading(heading_text, level=min(level, 3))

            elif tag == "p":
                self._add_paragraph_with_inline_formatting(inner)

            elif tag == "ul":
                self._add_html_list(inner, ordered=False)

            elif tag == "ol":
                self._add_html_list(inner, ordered=True)

            elif tag == "blockquote":
                self._add_html_blockquote(inner)

            elif tag == "pre":
                self._add_html_code_block(inner)

            elif tag == "table":
                self._add_html_table(inner)

            elif tag == "div":
                # Div is a generic container; recurse into its contents.
                self._render_html_blocks(inner)

            last_end = match.end()

        # Trailing text after the last block element.
        trailing = strip_html_tags(html[last_end:]).strip()
        if trailing:
            self._document.add_paragraph(trailing)

    # -- HTML element renderers --

    def _add_paragraph_with_inline_formatting(self, inner_html: str) -> None:
        """
        Add a paragraph with bold/italic/underline/strikethrough runs.

        Args:
            inner_html: The inner HTML of a ``<p>`` element.
        """
        if self._document is None:
            return

        runs = html_to_text_with_formatting(inner_html)
        if not runs:
            return

        # Skip empty paragraphs.
        combined_text = "".join(r["text"] for r in runs).strip()
        if not combined_text:
            return

        para = self._document.add_paragraph()

        # Check for text-align in the original HTML.
        align_match = re.search(r'text-align:\s*(center|right|justify)', inner_html, re.IGNORECASE)
        if align_match:
            align_val = align_match.group(1).lower()
            if align_val == "center":
                para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            elif align_val == "right":
                para.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            elif align_val == "justify":
                para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

        for run_data in runs:
            text = run_data["text"]
            if not text:
                continue
            run = para.add_run(text)
            if run_data.get("bold"):
                run.font.bold = True
            if run_data.get("italic"):
                run.font.italic = True
            if run_data.get("underline"):
                run.font.underline = True
            if run_data.get("strikethrough"):
                run.font.strike = True

    def _add_html_list(self, inner_html: str, ordered: bool = False) -> None:
        """
        Add a bullet or numbered list from HTML ``<ul>``/``<ol>`` content.

        Args:
            inner_html: The inner HTML of the list element.
            ordered: True for numbered list, False for bullet list.
        """
        if self._document is None:
            return

        style = "List Number" if ordered else "List Bullet"
        items = extract_list_items(inner_html)

        for item_text in items:
            para = self._document.add_paragraph(item_text, style=style)
            para.paragraph_format.left_indent = Inches(0.5)

    def _add_html_blockquote(self, inner_html: str) -> None:
        """
        Add a blockquote as an indented, italic paragraph.

        Args:
            inner_html: The inner HTML of the ``<blockquote>`` element.
        """
        if self._document is None:
            return

        text = strip_html_tags(inner_html).strip()
        if not text:
            return

        para = self._document.add_paragraph()
        para.paragraph_format.left_indent = Inches(0.5)
        run = para.add_run(text)
        run.font.italic = True
        run.font.color.rgb = self.SECONDARY_COLOR

    def _add_html_code_block(self, inner_html: str) -> None:
        """
        Add a code block as a monospace paragraph.

        Args:
            inner_html: The inner HTML of the ``<pre>`` element.
        """
        if self._document is None:
            return

        # Strip <code> wrapper if present.
        code_content = re.sub(r"</?code[^>]*>", "", inner_html, flags=re.IGNORECASE)
        text = strip_html_tags(code_content).strip()
        if not text:
            return

        para = self._document.add_paragraph()
        para.paragraph_format.left_indent = Inches(0.25)
        run = para.add_run(text)
        run.font.name = "Consolas"
        run.font.size = Pt(9)

    def _add_html_table(self, inner_html: str) -> None:
        """
        Add an HTML table to the DOCX document.

        Args:
            inner_html: The inner HTML of the ``<table>`` element.
        """
        if self._document is None:
            return

        rows_data = extract_table_rows(inner_html)
        if not rows_data:
            return

        num_cols = max(len(row) for row in rows_data)
        table = self._document.add_table(rows=0, cols=num_cols)
        table.style = "Table Grid"

        for i, row_cells in enumerate(rows_data):
            row = table.add_row()
            for j, cell_text in enumerate(row_cells):
                if j < num_cols:
                    row.cells[j].text = cell_text

            # Style the first row as a header.
            if i == 0:
                for j in range(num_cols):
                    self._style_table_header_cell(row.cells[j])

    # =========================================================================
    # Section extraction -- markdown path (original)
    # =========================================================================

    def _extract_scope_sections_markdown(
        self, content: str
    ) -> list[tuple[str, str]]:
        """
        Extract structured sections from markdown quote content.

        Args:
            content: Raw quote content (markdown).

        Returns:
            List of (section_title, section_content) tuples.
        """
        sections = []

        # Common section patterns
        section_patterns = [
            r"(?:^|\n)#+\s*(.+?)(?:\n)([\s\S]*?)(?=(?:\n#+\s*|\Z))",
            r"(?:^|\n)\*\*(.+?)\*\*(?:\n)([\s\S]*?)(?=(?:\n\*\*|\Z))",
            r"(?:^|\n)(\d+\.\s*.+?)(?:\n)([\s\S]*?)(?=(?:\n\d+\.\s*|\Z))",
        ]

        for pattern in section_patterns:
            matches = re.findall(pattern, content, re.MULTILINE)
            if matches:
                for title, body in matches:
                    title = title.strip().strip("#").strip("*").strip()
                    body = body.strip()
                    if title and body:
                        sections.append((title, body))
                break

        return sections

    # Keep the original name as an alias so any external callers still work.
    _extract_scope_sections = _extract_scope_sections_markdown

    # =========================================================================
    # Estimated hours
    # =========================================================================

    def _add_estimated_hours(self, data: QuoteExportData) -> None:
        """Add estimated hours section with breakdown table."""
        if self._document is None:
            return

        self._document.add_heading("Estimated Hours", level=1)

        # Add breakdown table if available
        if data.breakdown:
            self._add_hours_breakdown_table(data.breakdown, data.total_hours)
        else:
            # Generate breakdown from content if not available
            breakdown = self._extract_hours_breakdown(data.content)
            if breakdown:
                self._add_hours_breakdown_table(breakdown, data.total_hours)
            else:
                # Simple summary
                para = self._document.add_paragraph()
                para.add_run("Total Estimated Hours: ").font.bold = True
                para.add_run(f"{data.total_hours:,.1f} hours")

        # Add cost summary if available
        if data.total_cost and data.total_cost > 0:
            self._document.add_paragraph()
            cost_para = self._document.add_paragraph()
            cost_para.add_run("Estimated Project Cost: ").font.bold = True
            cost_run = cost_para.add_run(f"${data.total_cost:,.2f}")
            cost_run.font.color.rgb = self.ACCENT_COLOR
            cost_run.font.bold = True

    def _add_hours_breakdown_table(
        self,
        breakdown: list[dict[str, Any]],
        total_hours: Decimal,
    ) -> None:
        """
        Add a formatted hours breakdown table.

        Args:
            breakdown: List of task/phase dictionaries with hours.
            total_hours: Total hours for the project.
        """
        if self._document is None:
            return

        # Create table with headers
        table = self._document.add_table(rows=1, cols=3)
        table.style = "Table Grid"
        table.alignment = WD_TABLE_ALIGNMENT.CENTER

        # Set column widths
        table.columns[0].width = Inches(3.5)
        table.columns[1].width = Inches(1.5)
        table.columns[2].width = Inches(1.5)

        # Header row
        header_cells = table.rows[0].cells
        headers = ["Phase/Task", "Hours", "Percentage"]

        for i, header in enumerate(headers):
            cell = header_cells[i]
            cell.text = header
            self._style_table_header_cell(cell)

        # Data rows
        for item in breakdown:
            row_cells = table.add_row().cells

            # Get task name and hours
            task_name = item.get("task") or item.get("phase") or item.get("name", "")
            hours = item.get("hours", 0)

            # Calculate percentage
            percentage = (
                (Decimal(str(hours)) / total_hours * 100) if total_hours > 0 else 0
            )

            row_cells[0].text = str(task_name)
            row_cells[1].text = f"{hours:,.1f}"
            row_cells[2].text = f"{percentage:.1f}%"

            # Center align hours and percentage
            row_cells[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
            row_cells[2].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER

        # Total row
        total_row = table.add_row().cells
        total_row[0].text = "TOTAL"
        total_row[0].paragraphs[0].runs[0].font.bold = True
        total_row[1].text = f"{total_hours:,.1f}"
        total_row[1].paragraphs[0].runs[0].font.bold = True
        total_row[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        total_row[2].text = "100%"
        total_row[2].paragraphs[0].runs[0].font.bold = True
        total_row[2].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER

    def _extract_hours_breakdown(self, content: str) -> list[dict[str, Any]]:
        """
        Extract hours breakdown from content text.

        Handles both markdown/plain-text and HTML content. For HTML,
        first checks for ``<table>`` elements with hours data, then
        falls back to the plain-text regex extraction on stripped text.

        Args:
            content: Quote content text (markdown or HTML).

        Returns:
            List of dictionaries with task and hours.
        """
        if is_html_content(content):
            breakdown = self._extract_hours_breakdown_from_html(content)
            if breakdown:
                return breakdown
            # Fall back to plain-text extraction on stripped HTML.
            content = strip_html_tags(content)

        return self._extract_hours_breakdown_from_text(content)

    def _extract_hours_breakdown_from_html(self, html: str) -> list[dict[str, Any]]:
        """
        Extract hours from HTML ``<table>`` elements.

        Looks for tables whose rows contain a text column and a numeric
        hours column.

        Args:
            html: HTML content.

        Returns:
            List of task/hours dicts, or empty list if none found.
        """
        table_rows = extract_table_rows(html)
        if not table_rows:
            return []

        breakdown: list[dict[str, Any]] = []
        hours_pattern = re.compile(r"(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)?", re.IGNORECASE)

        for row in table_rows:
            if len(row) < 2:
                continue

            task_name = row[0].strip()
            # Skip header-like rows and total rows.
            if not task_name or task_name.lower() in ("phase/task", "task", "phase", "item", "total"):
                continue

            # Look for a numeric hours value in remaining cells.
            for cell in row[1:]:
                m = hours_pattern.match(cell.strip())
                if m:
                    hours_val = float(m.group(1))
                    if hours_val > 0:
                        breakdown.append({"task": task_name, "hours": hours_val})
                    break

        return breakdown

    def _extract_hours_breakdown_from_text(self, content: str) -> list[dict[str, Any]]:
        """
        Extract hours breakdown from plain-text content using regex.

        This is the original extraction logic.

        Args:
            content: Plain-text content.

        Returns:
            List of task/hours dicts.
        """
        breakdown: list[dict[str, Any]] = []

        patterns = [
            r"[-*]\s*(.+?):\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)",
            r"(.+?)(?:\s*[-:]\s*)(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)",
        ]

        for pattern in patterns:
            matches = re.findall(pattern, content, re.IGNORECASE | re.MULTILINE)
            if matches:
                for task, hours in matches:
                    task = task.strip().strip("-*").strip()
                    if task and not task.lower().startswith("total"):
                        breakdown.append({
                            "task": task,
                            "hours": float(hours),
                        })
                if breakdown:
                    break

        return breakdown

    # =========================================================================
    # Timeline
    # =========================================================================

    def _add_timeline(self, data: QuoteExportData) -> None:
        """Add project timeline section."""
        if self._document is None:
            return

        self._document.add_heading("Timeline", level=1)

        # Calculate estimated duration
        hours = float(data.total_hours)

        # Assume 6 productive hours per day, 5 days per week
        days = hours / 6
        weeks = days / 5

        timeline_para = self._document.add_paragraph()
        timeline_para.add_run("Estimated Project Duration: ").font.bold = True
        timeline_para.add_run(f"{weeks:.1f} weeks ({days:.0f} working days)")

        # Add timeline notes
        notes_para = self._document.add_paragraph()
        notes_para.paragraph_format.space_before = Pt(12)
        notes_para.add_run("Note: ").font.bold = True
        notes_para.add_run(
            "The timeline is an estimate based on the scope defined above. "
            "Actual duration may vary based on feedback cycles, "
            "requirement changes, and resource availability."
        )
        notes_para.paragraph_format.left_indent = Inches(0.25)

        # Complexity impact
        if data.complexity.lower() == "high":
            complexity_para = self._document.add_paragraph()
            complexity_para.paragraph_format.left_indent = Inches(0.25)
            complexity_run = complexity_para.add_run(
                "Due to the high complexity of this project, "
                "we recommend building in additional buffer time for "
                "testing and quality assurance."
            )
            complexity_run.font.italic = True
            complexity_run.font.color.rgb = self.SECONDARY_COLOR

    # =========================================================================
    # Assumptions
    # =========================================================================

    def _add_assumptions(self, data: QuoteExportData) -> None:
        """Add assumptions section."""
        if self._document is None:
            return

        self._document.add_heading("Assumptions", level=1)

        assumptions = data.assumptions or []

        # Extract assumptions from content if not provided
        if not assumptions:
            assumptions = self._extract_assumptions(data.content)

        # Add default assumptions if none found
        if not assumptions:
            assumptions = [
                "Client will provide all necessary content (text, images, branding assets) in a timely manner",
                "Client will designate a single point of contact for project communication",
                "Feedback and approvals will be provided within 2 business days",
                "Development environment and hosting will be set up prior to project start",
                "Third-party integrations have available API documentation",
            ]

        intro_para = self._document.add_paragraph(
            "This proposal is based on the following assumptions:"
        )
        intro_para.paragraph_format.space_after = Pt(8)

        for assumption in assumptions:
            para = self._document.add_paragraph(assumption, style="List Bullet")
            para.paragraph_format.left_indent = Inches(0.5)

    def _extract_assumptions(self, content: str) -> list[str]:
        """
        Extract assumptions from content text.

        Handles both markdown and HTML formats.

        Args:
            content: Quote content text.

        Returns:
            List of assumption strings.
        """
        if is_html_content(content):
            return self._extract_section_list_items_from_html(
                content,
                "assumption", "assumptions", "presume", "assuming",
            )

        return self._extract_assumptions_from_markdown(content)

    def _extract_assumptions_from_markdown(self, content: str) -> list[str]:
        """
        Extract assumptions from markdown content.

        Args:
            content: Markdown content.

        Returns:
            List of assumption strings.
        """
        assumptions: list[str] = []

        pattern = r"(?:assumptions?|presume|assuming)[:\s]*\n((?:[-*]\s*.+\n?)+)"
        match = re.search(pattern, content, re.IGNORECASE)

        if match:
            items_text = match.group(1)
            items = re.findall(r"[-*]\s*(.+)", items_text)
            assumptions = [item.strip() for item in items if item.strip()]

        return assumptions

    # =========================================================================
    # Exclusions
    # =========================================================================

    def _add_exclusions(self, data: QuoteExportData) -> None:
        """Add exclusions/out of scope section."""
        if self._document is None:
            return

        self._document.add_heading("Out of Scope", level=1)

        exclusions = data.exclusions or []

        # Extract exclusions from content if not provided
        if not exclusions:
            exclusions = self._extract_exclusions(data.content)

        # Add default exclusions if none found
        if not exclusions:
            exclusions = [
                "Content creation and copywriting (unless specified)",
                "Stock photography and graphics licensing",
                "Ongoing maintenance and support (covered under separate agreement)",
                "Server hosting and domain registration costs",
                "Changes to scope after project approval",
            ]

        intro_para = self._document.add_paragraph(
            "The following items are not included in this proposal:"
        )
        intro_para.paragraph_format.space_after = Pt(8)

        for exclusion in exclusions:
            para = self._document.add_paragraph(exclusion, style="List Bullet")
            para.paragraph_format.left_indent = Inches(0.5)

    def _extract_exclusions(self, content: str) -> list[str]:
        """
        Extract exclusions from content text.

        Handles both markdown and HTML formats.

        Args:
            content: Quote content text.

        Returns:
            List of exclusion strings.
        """
        if is_html_content(content):
            return self._extract_section_list_items_from_html(
                content,
                "exclusion", "exclusions", "not included", "out of scope",
            )

        return self._extract_exclusions_from_markdown(content)

    def _extract_exclusions_from_markdown(self, content: str) -> list[str]:
        """
        Extract exclusions from markdown content.

        Args:
            content: Markdown content.

        Returns:
            List of exclusion strings.
        """
        exclusions: list[str] = []

        pattern = r"(?:exclusions?|not included|out of scope)[:\s]*\n((?:[-*]\s*.+\n?)+)"
        match = re.search(pattern, content, re.IGNORECASE)

        if match:
            items_text = match.group(1)
            items = re.findall(r"[-*]\s*(.+)", items_text)
            exclusions = [item.strip() for item in items if item.strip()]

        return exclusions

    # =========================================================================
    # Shared HTML section extraction helper
    # =========================================================================

    def _extract_section_list_items_from_html(
        self, html_content: str, *title_keywords: str
    ) -> list[str]:
        """
        Find a section in HTML by heading keywords and return its list items.

        Used for extracting assumptions and exclusions from HTML content.

        Args:
            html_content: Full HTML content string.
            *title_keywords: Keywords to match against section heading text
                (case-insensitive substring match).

        Returns:
            List of plain-text items from the matched section's ``<ul>``/``<ol>``.
        """
        parser = HTMLContentParser(html_content)
        section = parser.get_section_by_title(*title_keywords)

        if section and section.items:
            return section.items

        return []

    # =========================================================================
    # Terms and conditions
    # =========================================================================

    def _add_terms_and_conditions(self) -> None:
        """Add terms and conditions section."""
        if self._document is None:
            return

        self._document.add_heading("Terms and Conditions", level=1)

        terms = [
            {
                "title": "Validity",
                "content": "This proposal is valid for 30 days from the date of issue.",
            },
            {
                "title": "Payment Terms",
                "content": (
                    "50% deposit required to commence work. "
                    "Remaining 50% due upon project completion and before final delivery."
                ),
            },
            {
                "title": "Change Requests",
                "content": (
                    "Any changes to the agreed scope will be evaluated and quoted separately. "
                    "Changes may affect the project timeline and cost."
                ),
            },
            {
                "title": "Intellectual Property",
                "content": (
                    "Upon full payment, all custom code and deliverables become the property "
                    "of the client. Third-party components remain under their respective licenses."
                ),
            },
            {
                "title": "Confidentiality",
                "content": (
                    "Both parties agree to maintain confidentiality of any proprietary "
                    "information shared during the project."
                ),
            },
        ]

        for term in terms:
            self._document.add_heading(term["title"], level=2)
            para = self._document.add_paragraph(term["content"])
            para.paragraph_format.left_indent = Inches(0.25)

    # =========================================================================
    # Table styling helpers
    # =========================================================================

    def _style_table_header_cell(self, cell) -> None:
        """
        Apply header styling to a table cell.

        Args:
            cell: The table cell to style.
        """
        # Set background color
        shading = parse_xml(
            f'<w:shd {nsdecls("w")} w:fill="{self.HEADER_BG_COLOR}"/>'
        )
        cell._tc.get_or_add_tcPr().append(shading)

        # Style text
        for para in cell.paragraphs:
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                run.font.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                run.font.name = self.FONT_NAME

    def _style_info_table(self, table: Table) -> None:
        """
        Apply styling to an information table.

        Args:
            table: The table to style.
        """
        # Set column widths
        table.columns[0].width = Inches(2)
        table.columns[1].width = Inches(4)

        # Style all cells
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    para.paragraph_format.space_before = Pt(4)
                    para.paragraph_format.space_after = Pt(4)
                    for run in para.runs:
                        run.font.name = self.FONT_NAME
                        run.font.size = Pt(11)

    # =========================================================================
    # Text utilities
    # =========================================================================

    def _clean_text(self, text: str) -> str:
        """
        Clean and normalize text for document.

        Handles both markdown formatting and HTML tags.

        Args:
            text: Raw text to clean.

        Returns:
            Cleaned text.
        """
        if is_html_content(text):
            return strip_html_tags(text).strip()

        # Remove excessive whitespace
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"[ \t]+", " ", text)

        # Remove markdown formatting
        text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
        text = re.sub(r"__(.+?)__", r"\1", text)
        text = re.sub(r"\*(.+?)\*", r"\1", text)
        text = re.sub(r"_(.+?)_", r"\1", text)
        text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)

        return text.strip()


# Singleton instance
_docx_export_service: Optional[DocxExportService] = None


def get_docx_export_service() -> DocxExportService:
    """
    Get or create the DOCX export service instance.

    Returns:
        DocxExportService: The service instance.
    """
    global _docx_export_service
    if _docx_export_service is None:
        _docx_export_service = DocxExportService()
    return _docx_export_service

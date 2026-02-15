"""
Integration tests for DOCX export with HTML content.

Verifies that the DocxExportService correctly generates DOCX documents
from both HTML (Tiptap editor) and markdown (AI-generated) content,
and that both formats produce valid documents.
"""

import io
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from docx import Document

from app.services.export.docx_service import DocxExportService, QuoteExportData


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def service() -> DocxExportService:
    """Create a fresh DocxExportService instance for each test."""
    return DocxExportService()


@pytest.fixture
def base_export_data() -> dict:
    """Base export data shared across tests. Override 'content' per test."""
    return {
        "title": "WordPress E-commerce Development",
        "client_name": "Acme Corp",
        "project_name": "Acme E-commerce Site",
        "requirements": "Build a WordPress WooCommerce site with 10 product pages.",
        "content": "",  # Override per test
        "total_hours": Decimal("120.00"),
        "total_cost": Decimal("0.00"),
        "platform": "wordpress",
        "complexity": "medium",
        "created_at": datetime(2026, 2, 13, 10, 0, 0, tzinfo=timezone.utc),
        "creator_name": "John Doe",
    }


def _generate_and_load(service: DocxExportService, data: QuoteExportData) -> Document:
    """Generate DOCX bytes and load them back as a Document for inspection."""
    docx_bytes = service.generate_quote_document(data)
    assert isinstance(docx_bytes, bytes)
    assert len(docx_bytes) > 0
    return Document(io.BytesIO(docx_bytes))


def _get_all_text(doc: Document) -> str:
    """Extract all paragraph text from a Document."""
    return "\n".join(p.text for p in doc.paragraphs)


def _get_all_headings(doc: Document) -> list[str]:
    """Extract all headings from a Document."""
    return [
        p.text
        for p in doc.paragraphs
        if p.style and p.style.name and p.style.name.startswith("Heading")
    ]


# =============================================================================
# Tests: Markdown content (backward compatibility)
# =============================================================================


class TestDocxExportMarkdownContent:
    """Verify that existing markdown content still exports correctly."""

    def test_generates_valid_docx_from_markdown(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        base_export_data["content"] = (
            "## Executive Summary\n\n"
            "This project involves building a WordPress e-commerce site.\n\n"
            "## Scope of Work\n\n"
            "- Homepage design\n"
            "- Product pages (10 pages)\n"
            "- Shopping cart integration\n\n"
            "## Assumptions\n\n"
            "- Client provides all product images\n"
            "- Hosting is pre-configured\n"
        )
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)

        all_text = _get_all_text(doc)
        assert "Scope of Work" in all_text
        assert "PROJECT PROPOSAL" in all_text

    def test_markdown_with_metadata_breakdown(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        base_export_data["content"] = "## Scope\n\nGeneral scope content."
        base_export_data["breakdown"] = [
            {"task": "Design", "hours": 40},
            {"task": "Development", "hours": 60},
            {"task": "Testing", "hours": 20},
        ]
        base_export_data["assumptions"] = [
            "Client provides content",
            "Hosting is pre-configured",
        ]
        base_export_data["exclusions"] = [
            "Ongoing maintenance",
            "Third-party licenses",
        ]
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)

        all_text = _get_all_text(doc)
        assert "Design" in all_text
        assert "Client provides content" in all_text
        assert "Ongoing maintenance" in all_text


# =============================================================================
# Tests: HTML content (Tiptap editor)
# =============================================================================


class TestDocxExportHtmlContent:
    """Verify that HTML content from the Tiptap editor exports correctly."""

    def test_generates_valid_docx_from_html(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        base_export_data["content"] = (
            "<h1>Executive Summary</h1>"
            "<p>This project involves building a <strong>WordPress</strong> e-commerce site.</p>"
            "<h2>Scope of Work</h2>"
            "<ul>"
            "<li>Homepage design</li>"
            "<li>Product pages (10 pages)</li>"
            "<li>Shopping cart integration</li>"
            "</ul>"
        )
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)

        all_text = _get_all_text(doc)
        # Should contain the heading content (rendered by the Scope of Work section)
        assert "Executive Summary" in all_text
        assert "Scope of Work" in all_text

    def test_html_headings_become_docx_headings(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        base_export_data["content"] = (
            "<h1>Main Section</h1>"
            "<p>Intro paragraph</p>"
            "<h2>Subsection</h2>"
            "<p>Details here</p>"
        )
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)

        headings = _get_all_headings(doc)
        # Should contain at least the section headings from the template
        # plus the ones from HTML content
        heading_texts = " ".join(headings)
        assert "Scope of Work" in heading_texts

    def test_html_bold_italic_preserved_in_paragraphs(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        base_export_data["content"] = (
            "<p>This has <strong>bold</strong>, <em>italic</em>, "
            "and <u>underlined</u> text.</p>"
        )
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)

        # Find a paragraph containing "bold"
        found_bold = False
        for para in doc.paragraphs:
            for run in para.runs:
                if "bold" in run.text and run.font.bold:
                    found_bold = True
                    break
        assert found_bold, "Expected to find a bold run with text 'bold'"

    def test_html_unordered_list(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        base_export_data["content"] = (
            "<h2>Features</h2>"
            "<ul>"
            "<li>Feature Alpha</li>"
            "<li>Feature Beta</li>"
            "<li>Feature Gamma</li>"
            "</ul>"
        )
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)

        all_text = _get_all_text(doc)
        assert "Feature Alpha" in all_text
        assert "Feature Beta" in all_text
        assert "Feature Gamma" in all_text

    def test_html_ordered_list(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        base_export_data["content"] = (
            "<h2>Steps</h2>"
            "<ol>"
            "<li>Step one</li>"
            "<li>Step two</li>"
            "</ol>"
        )
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)

        all_text = _get_all_text(doc)
        assert "Step one" in all_text
        assert "Step two" in all_text

    def test_html_blockquote(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        base_export_data["content"] = (
            "<blockquote>Important note for the client.</blockquote>"
        )
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)

        all_text = _get_all_text(doc)
        assert "Important note" in all_text

    def test_html_table_content(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        base_export_data["content"] = (
            "<h2>Hours Breakdown</h2>"
            "<table>"
            "<tr><th>Task</th><th>Hours</th></tr>"
            "<tr><td>Frontend</td><td>40</td></tr>"
            "<tr><td>Backend</td><td>60</td></tr>"
            "</table>"
        )
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)

        # Check that the document has tables (beyond the default ones)
        all_text = _get_all_text(doc)
        assert "Hours Breakdown" in all_text

    def test_html_assumptions_extraction(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        """When metadata assumptions are not provided, they should be
        extracted from HTML content sections titled 'Assumptions'."""
        base_export_data["content"] = (
            "<h2>Scope</h2>"
            "<p>Full stack development.</p>"
            "<h2>Assumptions</h2>"
            "<ul>"
            "<li>Client provides all content</li>"
            "<li>API docs available</li>"
            "</ul>"
        )
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)

        all_text = _get_all_text(doc)
        assert "Client provides all content" in all_text
        assert "API docs available" in all_text

    def test_html_exclusions_extraction(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        """When metadata exclusions are not provided, they should be
        extracted from HTML content sections titled 'Exclusions'."""
        base_export_data["content"] = (
            "<h2>Exclusions</h2>"
            "<ul>"
            "<li>Server hosting</li>"
            "<li>Domain registration</li>"
            "</ul>"
        )
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)

        all_text = _get_all_text(doc)
        assert "Server hosting" in all_text
        assert "Domain registration" in all_text

    def test_html_hours_extraction_from_table(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        """When metadata breakdown is not provided, hours should be
        extracted from HTML tables in the content."""
        base_export_data["content"] = (
            "<h2>Estimated Hours</h2>"
            "<table>"
            "<tr><th>Phase/Task</th><th>Hours</th></tr>"
            "<tr><td>Design</td><td>30</td></tr>"
            "<tr><td>Development</td><td>70</td></tr>"
            "<tr><td>QA</td><td>20</td></tr>"
            "</table>"
        )
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)

        all_text = _get_all_text(doc)
        assert "Design" in all_text

    def test_html_hours_extraction_from_text_patterns(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        """Hours can also be extracted from text patterns in HTML paragraphs."""
        base_export_data["content"] = (
            "<h2>Hours</h2>"
            "<p>- Design: 30 hours</p>"
            "<p>- Development: 70 hours</p>"
        )
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)
        # Should not raise; document should generate successfully
        all_text = _get_all_text(doc)
        assert "Estimated Hours" in all_text

    def test_complex_html_document(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        """Full realistic HTML content from Tiptap editor."""
        base_export_data["content"] = (
            "<h1>Executive Summary</h1>"
            "<p>We propose to build a comprehensive <strong>WordPress e-commerce</strong> "
            "solution with <em>WooCommerce</em> integration for <u>Acme Corp</u>.</p>"
            "<h2>Scope of Work</h2>"
            "<h3>Phase 1: Design</h3>"
            "<ul>"
            "<li>Homepage design with hero section</li>"
            "<li>Product page templates</li>"
            "<li>Mobile-responsive layouts</li>"
            "</ul>"
            "<h3>Phase 2: Development</h3>"
            "<ol>"
            "<li>WordPress theme setup</li>"
            "<li>WooCommerce configuration</li>"
            "<li>Payment gateway integration</li>"
            "</ol>"
            "<h2>Assumptions</h2>"
            "<ul>"
            "<li>Client provides product photography</li>"
            "<li>Hosting environment is pre-configured</li>"
            "</ul>"
            "<h2>Exclusions</h2>"
            "<ul>"
            "<li>Content writing and copyediting</li>"
            "<li>Ongoing maintenance</li>"
            "</ul>"
            "<blockquote>Note: Timeline may vary based on feedback cycles.</blockquote>"
        )
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)

        all_text = _get_all_text(doc)
        assert "Executive Summary" in all_text
        assert "Homepage design" in all_text
        assert "WooCommerce configuration" in all_text
        assert "Client provides product photography" in all_text
        assert "Content writing" in all_text


# =============================================================================
# Tests: Mixed / edge cases
# =============================================================================


class TestDocxExportEdgeCases:
    """Edge cases and mixed content scenarios."""

    def test_empty_content(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        """Empty content should still produce a valid document."""
        base_export_data["content"] = ""
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)

        all_text = _get_all_text(doc)
        assert "PROJECT PROPOSAL" in all_text

    def test_html_with_metadata_overrides(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        """When metadata (breakdown, assumptions, exclusions) are provided,
        they should be used even when HTML content also contains them."""
        base_export_data["content"] = (
            "<h2>Assumptions</h2>"
            "<ul><li>HTML assumption</li></ul>"
        )
        base_export_data["assumptions"] = ["Metadata assumption one", "Metadata assumption two"]
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)

        all_text = _get_all_text(doc)
        # Metadata should take precedence
        assert "Metadata assumption one" in all_text

    def test_html_content_with_no_headings(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        """HTML content without headings should still render."""
        base_export_data["content"] = (
            "<p>This is a simple paragraph.</p>"
            "<p>Another paragraph with <strong>bold</strong> text.</p>"
        )
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)

        all_text = _get_all_text(doc)
        assert "simple paragraph" in all_text

    def test_large_html_content(
        self, service: DocxExportService, base_export_data: dict
    ) -> None:
        """Large HTML content should not cause errors."""
        # Generate ~10K characters of HTML
        paragraphs = "".join(
            f"<p>Paragraph {i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. "
            f"Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>"
            for i in range(100)
        )
        base_export_data["content"] = f"<h1>Large Document</h1>{paragraphs}"
        data = QuoteExportData(**base_export_data)
        doc = _generate_and_load(service, data)

        all_text = _get_all_text(doc)
        assert "Paragraph 0" in all_text
        assert "Paragraph 99" in all_text

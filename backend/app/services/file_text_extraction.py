"""
Extract plain text from uploaded files (PDF, DOCX, TXT, MD) for use in estimation brief.
"""

import io
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def extract_text_from_file(content: bytes, filename: str, content_type: str | None = None) -> str | None:
    """
    Extract plain text from file content.

    Supports: .txt, .md, .pdf, .docx.
    Returns None if extraction fails or format is not supported.
    """
    if not content:
        return None
    ext = (Path(filename or "").suffix or "").lower()
    if content_type and "/" in content_type:
        # Prefer extension for ambiguous types
        if not ext and "pdf" in content_type:
            ext = ".pdf"
        elif not ext and "word" in content_type or "docx" in content_type:
            ext = ".docx"

    try:
        if ext in (".txt", ".md", ".markdown"):
            return content.decode("utf-8", errors="replace").strip() or None
        if ext == ".pdf":
            return _extract_pdf(content)
        if ext in (".docx", ".doc"):
            return _extract_docx(content)
    except Exception as e:
        logger.warning("Text extraction failed for %s: %s", filename, e)
    return None


def _extract_pdf(content: bytes) -> str | None:
    """Extract text from PDF using pypdf."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        parts = []
        for page in reader.pages:
            t = page.extract_text()
            if t and t.strip():
                parts.append(t.strip())
        return "\n\n".join(parts) if parts else None
    except Exception as e:
        logger.warning("PDF extraction failed: %s", e)
        return None


def _extract_docx(content: bytes) -> str | None:
    """Extract text from DOCX using python-docx."""
    try:
        from docx import Document as DocxDocument
        doc = DocxDocument(io.BytesIO(content))
        parts = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(parts) if parts else None
    except Exception as e:
        logger.warning("DOCX extraction failed: %s", e)
        return None

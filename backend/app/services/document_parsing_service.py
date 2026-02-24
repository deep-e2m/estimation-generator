"""
Document parsing with vision fallback for estimation briefs.

Extracts text from uploaded requirement documents. Uses library extraction
for text (PDF, DOCX, TXT, MD) and OpenRouter vision for:
- PDF pages with little or no extractable text (e.g. scanned pages, image-heavy)
- Standalone image files (PNG, JPG, etc.) as requirement attachments
"""

import base64
import io
import logging
from pathlib import Path

from app.services.ai.llm_service import get_llm_service
from app.services.file_text_extraction import extract_text_from_file

logger = logging.getLogger(__name__)

# Extensions we can describe via vision when they are standalone images
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
# Min chars per PDF page to skip vision (use text only)
PDF_PAGE_TEXT_MIN = 50


def _image_to_base64_jpeg(image_bytes: bytes, mime_or_ext: str = "") -> str:
    """Return base64 string for image bytes (JPEG preferred for vision API)."""
    return base64.b64encode(image_bytes).decode("ascii")


async def extract_text_with_vision(
    content: bytes,
    filename: str,
    content_type: str | None = None,
) -> str | None:
    """
    Extract plain text from file content, using vision for images and low-text PDF pages.

    - TXT, MD, DOCX: same as extract_text_from_file (sync path).
    - PDF: extract text per page; for pages with very little text, render page to image
      and run vision to extract/describe. Combined result is returned.
    - Image files (PNG, JPG, etc.): run vision to extract text and describe content.

    Returns None if parsing fails or format is not supported.
    """
    if not content:
        return None
    ext = (Path(filename or "").suffix or "").lower()
    if content_type and "/" in content_type and not ext:
        if "pdf" in content_type:
            ext = ".pdf"
        elif "word" in content_type or "docx" in content_type:
            ext = ".docx"
        elif "image" in content_type:
            ext = ".png"

    # Pure text and DOCX: use existing sync extraction
    if ext in (".txt", ".md", ".markdown"):
        return content.decode("utf-8", errors="replace").strip() or None
    if ext in (".docx", ".doc"):
        return extract_text_from_file(content, filename, content_type)

    # Standalone image: vision only
    if ext in IMAGE_EXTS:
        try:
            b64 = _image_to_base64_jpeg(content, content_type or "")
            llm = get_llm_service()
            text = await llm.describe_document_image(b64, is_standalone_image=True)
            return text or None
        except Exception as e:
            logger.warning("Vision extraction failed for image %s: %s", filename, e)
            return None

    # PDF: text extraction + vision for low-text pages
    if ext == ".pdf":
        return await _extract_pdf_with_vision(content, filename)

    return None


async def _extract_pdf_with_vision(content: bytes, filename: str) -> str | None:
    """Extract text from PDF; use vision for pages with little text."""
    try:
        from pypdf import PdfReader
    except ImportError:
        logger.warning("pypdf not available for PDF extraction")
        return None

    try:
        reader = PdfReader(io.BytesIO(content))
        pages = reader.pages
        if not pages:
            return None
    except Exception as e:
        logger.warning("PDF open failed for %s: %s", filename, e)
        return None

    parts: list[tuple[int, str]] = []
    pages_needing_vision: list[int] = []

    for i, page in enumerate(pages):
        try:
            t = page.extract_text()
            text = (t or "").strip()
            if len(text) >= PDF_PAGE_TEXT_MIN:
                parts.append((i + 1, text))
            else:
                pages_needing_vision.append(i)
        except Exception as e:
            logger.debug("PDF page %s text extraction failed: %s", i + 1, e)
            pages_needing_vision.append(i)

    # Render low-text pages to images and run vision
    if pages_needing_vision:
        try:
            from pdf2image import convert_from_bytes
        except ImportError:
            logger.warning("pdf2image not installed; skipping vision fallback for PDF pages")
        else:
            try:
                images = convert_from_bytes(content, first_page=1, last_page=len(pages))
                llm = get_llm_service()
                for idx in pages_needing_vision:
                    if idx < len(images):
                        img = images[idx]
                        buf = io.BytesIO()
                        img.save(buf, format="PNG")
                        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
                        try:
                            page_text = await llm.describe_document_image(b64, is_standalone_image=False)
                            if page_text and page_text.strip():
                                parts.append((idx + 1, page_text.strip()))
                        except Exception as e:
                            logger.warning("Vision failed for PDF page %s: %s", idx + 1, e)
            except Exception as e:
                logger.warning("pdf2image failed for %s: %s", filename, e)

    if not parts:
        return None
    parts.sort(key=lambda x: x[0])
    return "\n\n".join(f"[Page {p}] {t}" for p, t in parts)

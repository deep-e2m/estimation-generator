"""
File upload API.

Supports uploading supporting/requirement documents. When category is 'requirements',
creates a Document with document_type=REQUIREMENTS and extracts plain text using
library extraction (PDF/DOCX/TXT/MD) and OpenRouter vision for images and low-text
PDF pages, so quote generation can use it in the project brief.
"""

import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.api.dependencies import ActiveUser, DbSession, get_project_with_access
from app.models.document import Document, DocumentType
from app.services.document_parsing_service import extract_text_with_vision

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files", tags=["Files"])

# Allowed extensions for requirement documents (text + vision parsing)
REQUIREMENT_EXTS = {
    ".pdf", ".docx", ".doc", ".txt", ".md",
    ".png", ".jpg", ".jpeg", ".gif", ".webp",
}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB


class FileUploadResponse(BaseModel):
    """Response shape compatible with frontend FileRecord."""

    id: str
    filename: str
    original_filename: str | None = None
    content_type: str
    file_size: int
    storage_provider: str = "database"
    download_url: str
    thumbnail_url: str | None = None
    project_id: str | None = None
    uploaded_by: dict | None = None
    created_at: str


class FileUploadDataResponse(BaseModel):
    """API wrapper: success + data."""

    success: bool = True
    data: FileUploadResponse


@router.post(
    "/upload",
    response_model=FileUploadDataResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a file",
    description="Upload a file for a project. When category is 'requirements', creates a requirement document and extracts text for estimation.",
    responses={
        201: {"description": "File uploaded and (if requirements) document created"},
        400: {"description": "Invalid file or project"},
        404: {"description": "Project not found"},
    },
)
async def upload_file(
    current_user: ActiveUser,
    db: DbSession,
    file: UploadFile = File(..., description="File to upload"),
    project_id: str = Form(..., description="Project UUID"),
    category: str = Form("requirements", description="Category: requirements, reference, or export"),
):
    """Upload a file. For category=requirements, creates a Document with extracted plain_text."""
    try:
        pid = UUID(project_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project_id")

    await get_project_with_access(pid, current_user, db)

    filename = file.filename or "document"
    ext = (Path(filename).suffix or "").lower()
    if category == "requirements" and ext not in REQUIREMENT_EXTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"For requirements, allowed types are: {', '.join(REQUIREMENT_EXTS)}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum size ({MAX_FILE_SIZE // (1024*1024)}MB)",
        )

    plain_text = await extract_text_with_vision(content, filename, file.content_type)
    title = (Path(filename).stem or filename)[:500]
    document = Document(
        project_id=pid,
        title=title,
        content=None,
        plain_text=plain_text,
        document_type=DocumentType.REQUIREMENTS,
        created_by=current_user.id,
        last_edited_by=current_user.id,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)
    logger.info(
        "Requirement document created: id=%s, title=%s, plain_text_len=%s",
        document.id,
        title,
        len(plain_text) if plain_text else 0,
    )
    created_at_iso = document.created_at.isoformat() if document.created_at else ""
    return FileUploadDataResponse(
        data=FileUploadResponse(
            id=str(document.id),
            filename=document.title,
            original_filename=filename,
            content_type=file.content_type or "application/octet-stream",
            file_size=len(content),
            storage_provider="database",
            download_url=f"/api/v1/projects/{pid}/documents/{document.id}",
            project_id=str(pid),
            uploaded_by={"id": str(current_user.id), "full_name": current_user.full_name or current_user.email},
            created_at=created_at_iso,
        )
    )

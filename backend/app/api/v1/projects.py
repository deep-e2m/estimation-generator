"""
Project API endpoints.

This module provides endpoints for project management including
CRUD operations, listing with pagination, and content quality check.
"""

import logging
from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from app.config import get_settings
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.api.dependencies import (
    ActiveUser,
    DbSession,
    api_error,
    get_project_with_access,
    get_project_with_owner_or_admin,
    get_project_with_permission,
)
from app.models.client import Client
from app.models.project_share import AccessLevel, ProjectShare
from app.models.document import Document, DocumentType
from app.models.project import Platform, Project, ProjectStatus
from app.models.quote import Quote
from app.models.audit_log import AuditLog, ActionOutcome
from app.models.user import User
from app.services import audit
from app.schemas.audit_log import AuditLogResponse, AuditLogsListResponse
from app.schemas.project import (
    CheckContentQualityData,
    CheckContentQualityRequest,
    CheckContentQualityResponse,
    ContentQualityFeedback,
    PaginationMeta,
    ProjectCreate,
    ProjectDataResponse,
    ProjectDeleteResponse,
    ProjectDetailDataResponse,
    ProjectDetailResponse,
    ProjectListData,
    ProjectListResponse,
    ProjectOwner,
    ProjectResponse,
    ProjectUpdate,
    ReferenceUrlPreviewData,
    ReferenceUrlPreviewResponse,
    ReferenceUrlSitePreviewData,
    ReferenceUrlSitePreviewResponse,
)
from app.services.ai.llm_service import get_llm_service
from app.services.reference_url_context import (
    REFERENCE_URLS_HEADER,
    build_reference_url_context,
)
from app.services.site_crawl_service import crawl_site
from app.services.url_extraction import extract_urls
from app.services.url_scraping_service import scrape_urls

logger = logging.getLogger(__name__)

router = APIRouter()


# Max combined document text length for quality check (avoid token overflow)
CONTENT_QUALITY_DOCUMENT_TEXT_CAP = 50_000


@router.post(
    "/check-content-quality",
    response_model=CheckContentQualityResponse,
    summary="Check project content quality",
    description="Evaluates project name, description, optional instructions, and optional document text (or requirement docs for a project) for estimation readiness. When documents are provided, form + document are evaluated together.",
    responses={
        200: {"description": "Content quality result"},
        401: {"description": "Not authenticated"},
        404: {"description": "Project not found (when project_id given)"},
        500: {"description": "Quality check failed"},
    },
)
async def check_content_quality(
    request: CheckContentQualityRequest,
    current_user: ActiveUser,
    db: DbSession,
) -> CheckContentQualityResponse:
    """
    Run AI check on project name, description, and optional instructions.
    When project_id is provided, load requirement documents and include their
    text. When document_text is provided, use it (merged with project docs).
    Returns overall_sufficient, score (0-100), per-field feedback, and
    suggested_improvements. No project is created; this is for validation only.
    """
    document_text = (request.document_text or "").strip()

    if request.project_id:
        await get_project_with_access(request.project_id, current_user, db)
        doc_query = (
            select(Document.plain_text)
            .where(
                Document.project_id == request.project_id,
                Document.document_type == DocumentType.REQUIREMENTS,
                Document.plain_text.isnot(None),
            )
            .order_by(Document.updated_at.desc())
            .limit(5)
        )
        doc_result = await db.execute(doc_query)
        doc_texts = [row[0].strip() for row in doc_result.fetchall() if row[0] and row[0].strip()]
        if doc_texts:
            combined_docs = "\n\n---\n\n".join(doc_texts)
            document_text = f"{document_text}\n\n---\n\n{combined_docs}".strip() if document_text else combined_docs

    if len(document_text) > CONTENT_QUALITY_DOCUMENT_TEXT_CAP:
        document_text = document_text[:CONTENT_QUALITY_DOCUMENT_TEXT_CAP] + "\n\n[... truncated for quality check ...]"

    # Reference URL context (scraped + vision) when ENABLE_URL_SCRAPING
    reference_url_context, _ = await build_reference_url_context(
        request.description,
        request.additional_instructions,
        document_text,
        document_plain_texts=[],
    )
    if reference_url_context:
        document_text = f"{document_text}\n\n{REFERENCE_URLS_HEADER}\n{reference_url_context}"
        if len(document_text) > CONTENT_QUALITY_DOCUMENT_TEXT_CAP:
            document_text = (
                document_text[:CONTENT_QUALITY_DOCUMENT_TEXT_CAP]
                + "\n\n[... truncated for quality check ...]"
            )

    try:
        llm_service = get_llm_service()
        result = await llm_service.check_content_quality(
            project_name=request.project_name,
            description=request.description,
            additional_instructions=request.additional_instructions,
            document_text=document_text or None,
        )
    except Exception as e:
        logger.exception("Content quality check failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "CONTENT_QUALITY_CHECK_FAILED",
                "message": "Unable to check content quality. Please try again.",
            },
        ) from e

    feedback = ContentQualityFeedback(
        project_name=result.get("feedback", {}).get("project_name", []),
        description=result.get("feedback", {}).get("description", []),
        additional_instructions=result.get("feedback", {}).get("additional_instructions", []),
    )
    data = CheckContentQualityData(
        overall_sufficient=result.get("overall_sufficient", False),
        score=result.get("score", 0),
        feedback=feedback,
        suggested_improvements=result.get("suggested_improvements", ""),
    )
    return CheckContentQualityResponse(success=True, data=data)


@router.get(
    "/{project_id}/reference-url-preview",
    response_model=ReferenceUrlPreviewResponse,
    summary="Preview scraped content for a reference URL",
    description="Scrapes the given URL (screenshot + body text) and returns the content used for estimation. Requires project access.",
    responses={
        200: {"description": "Scraped content and screenshot"},
        400: {"description": "Invalid or disallowed URL"},
        404: {"description": "Project not found"},
        503: {"description": "URL scraping is disabled"},
    },
)
async def reference_url_preview(
    project_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
    url: str = Query(..., min_length=1, max_length=2048, description="URL to scrape and preview"),
) -> ReferenceUrlPreviewResponse:
    """Scrape a single URL and return extracted text + screenshot for preview."""
    await get_project_with_access(project_id, current_user, db)

    settings = get_settings()
    if not settings.ENABLE_URL_SCRAPING:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "URL_SCRAPING_DISABLED",
                "message": "Reference URL scraping is disabled.",
            },
        )

    normalized = extract_urls(
        url.strip(),
        allowed_schemes=tuple(settings.ALLOWED_URL_SCHEMES),
        max_urls=1,
        reject_local_private=settings.is_production,
    )
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_URL",
                "message": "URL is not allowed (check scheme and host).",
            },
        )
    target_url = normalized[0]

    results = await scrape_urls(
        [target_url],
        timeout_per_url=settings.URL_SCRAPE_TIMEOUT_SEC,
        max_urls=1,
    )
    if not results:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "SCRAPE_FAILED", "message": "Scraping produced no result."},
        )
    r = results[0]
    return ReferenceUrlPreviewResponse(
        success=True,
        data=ReferenceUrlPreviewData(
            url=r.url,
            extracted_text=r.extracted_text or "",
            screenshot_base64=r.screenshot_base64,
            error=r.error,
        ),
    )


@router.get(
    "/{project_id}/reference-url-site-preview",
    response_model=ReferenceUrlSitePreviewResponse,
    summary="Preview full site (crawl + scrape all pages)",
    description="Discovers same-host pages from the seed URL (sitemap + links), then scrapes each page (screenshot + extracted text). Returns one screenshot and text per page.",
    responses={
        200: {"description": "Scraped content for each discovered page"},
        400: {"description": "Invalid or disallowed URL"},
        404: {"description": "Project not found"},
        503: {"description": "URL scraping or site crawl is disabled"},
    },
)
async def reference_url_site_preview(
    project_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
    url: str = Query(..., min_length=1, max_length=2048, description="Seed URL to crawl and scrape"),
) -> ReferenceUrlSitePreviewResponse:
    """Crawl site from seed URL, then scrape each discovered page; return list of screenshots + text (one per page)."""
    await get_project_with_access(project_id, current_user, db)

    settings = get_settings()
    if not settings.ENABLE_URL_SCRAPING:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "URL_SCRAPING_DISABLED",
                "message": "Reference URL scraping is disabled.",
            },
        )
    if not settings.SITE_CRAWL_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "SITE_CRAWL_DISABLED",
                "message": "Full-site crawl is disabled.",
            },
        )

    normalized = extract_urls(
        url.strip(),
        allowed_schemes=tuple(settings.ALLOWED_URL_SCHEMES),
        max_urls=1,
        reject_local_private=settings.is_production,
    )
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_URL",
                "message": "URL is not allowed (check scheme and host).",
            },
        )
    seed_url = normalized[0]

    urls_to_scrape = await crawl_site(
        seed_url,
        max_pages=settings.MAX_SITE_PAGES,
        depth=settings.SITE_CRAWL_DEPTH,
        timeout_sec=float(settings.SITE_CRAWL_TIMEOUT_SEC),
        allowed_schemes=tuple(settings.ALLOWED_URL_SCHEMES),
    )
    if not urls_to_scrape:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "CRAWL_FAILED", "message": "No URLs discovered from seed."},
        )

    results = await scrape_urls(
        urls_to_scrape,
        timeout_per_url=settings.URL_SCRAPE_TIMEOUT_SEC,
        max_urls=len(urls_to_scrape),
    )
    pages = [
        ReferenceUrlPreviewData(
            url=r.url,
            extracted_text=r.extracted_text or "",
            screenshot_base64=r.screenshot_base64,
            error=r.error,
        )
        for r in results
    ]
    return ReferenceUrlSitePreviewResponse(
        success=True,
        data=ReferenceUrlSitePreviewData(
            seed_url=seed_url,
            pages=pages,
        ),
    )


@router.post(
    "",
    response_model=ProjectDataResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project",
    description="Creates a new project for the authenticated user.",
    responses={
        201: {"description": "Project created successfully"},
        400: {"description": "Validation error"},
        401: {"description": "Not authenticated"},
    },
)
async def create_project(
    project_data: ProjectCreate,
    current_user: ActiveUser,
    db: DbSession,
) -> ProjectDataResponse:
    logger.info("Creating project: name=%s, user=%s", project_data.name, current_user.email)

    # Handle optional client selection
    client_id = None

    if project_data.new_client:
        # Create new client
        client = Client(
            name=project_data.new_client.name,
            email=project_data.new_client.email,
            created_by=current_user.id,
        )
        db.add(client)
        await db.flush()
        client_id = client.id
        logger.info("Created new client: id=%s, name=%s", client.id, client.name)
    elif project_data.client_id:
        # Validate existing client
        client_id = project_data.client_id
        client_query = select(Client).where(
            Client.id == client_id,
            Client.created_by == current_user.id,
        )
        client_result = await db.execute(client_query)
        client = client_result.scalar_one_or_none()

        if not client:
            raise api_error(
                status.HTTP_404_NOT_FOUND,
                "CLIENT_NOT_FOUND",
                "Client not found or access denied",
            )
        logger.info("Using existing client: id=%s, name=%s", client.id, client.name)
    else:
        logger.info("Creating project without client association")

    # Use explicit reference_urls if provided; otherwise extract from description and additional_instructions
    reference_urls = project_data.reference_urls or []
    if not reference_urls:
        settings = get_settings()
        reference_urls = extract_urls(
            project_data.description or "",
            project_data.additional_instructions or "",
            allowed_schemes=tuple(settings.ALLOWED_URL_SCHEMES),
            max_urls=settings.MAX_REFERENCE_URLS,
        )
        if reference_urls:
            logger.info("Auto-extracted %d reference URL(s) from project content", len(reference_urls))

    new_project = Project(
        name=project_data.name,
        description=project_data.description,
        additional_instructions=project_data.additional_instructions,
        reference_urls=reference_urls,
        platform=project_data.platform,
        status=ProjectStatus.ACTIVE,
        client_id=client_id,
        created_by=current_user.id,
    )

    db.add(new_project)
    await db.commit()

    # Re-fetch with eager-loaded relationships
    query = (
        select(Project)
        .options(selectinload(Project.client))
        .where(Project.id == new_project.id)
    )
    result = await db.execute(query)
    new_project = result.scalar_one()

    logger.info("Project created: id=%s, name=%s", new_project.id, new_project.name)

    # Audit log: project created
    try:
        await audit.log_action(
            db=db,
            actor_user_id=current_user.id,
            actor_role=current_user.role.value,
            action="project.created",
            outcome=ActionOutcome.SUCCESS,
            resource_type="project",
            resource_id=new_project.id,
            project_id=new_project.id,
            metadata={
                "name": new_project.name,
                "platform": new_project.platform.value if new_project.platform else None,
            },
        )
    except Exception as e:
        logger.error("Failed to log audit for project creation: %s", e)

    return ProjectDataResponse(
        success=True,
        data=new_project,
    )


@router.get(
    "",
    response_model=ProjectListResponse,
    summary="List user's projects",
    description="Returns a paginated list of projects for the authenticated user.",
    responses={
        200: {"description": "Projects retrieved successfully"},
        401: {"description": "Not authenticated"},
    },
)
async def list_projects(
    current_user: ActiveUser,
    db: DbSession,
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    status_filter: Optional[ProjectStatus] = Query(
        default=None, alias="status", description="Filter by project status"
    ),
    platform_filter: Optional[Platform] = Query(
        default=None, alias="platform", description="Filter by platform"
    ),
    search: Optional[str] = Query(
        default=None, max_length=100, description="Search in project name"
    ),
) -> ProjectListResponse:
    logger.debug(
        "Listing projects: user=%s, page=%d, limit=%d",
        current_user.email,
        page,
        limit,
    )

    # Build base query: own projects + shared projects; admin sees all
    base_query = (
        select(Project)
        .options(selectinload(Project.client))
    )
    if current_user.is_admin:
        pass  # no filter: admin sees all
    else:
        # Own projects OR projects shared with this user
        subq = select(ProjectShare.project_id).where(
            ProjectShare.shared_with_user_id == current_user.id
        )
        base_query = base_query.where(
            or_(
                Project.created_by == current_user.id,
                Project.id.in_(subq),
            )
        )

    # Apply filters
    if status_filter:
        base_query = base_query.where(Project.status == status_filter)
    if platform_filter:
        base_query = base_query.where(Project.platform == platform_filter)
    if search:
        base_query = base_query.where(Project.name.ilike(f"%{search}%"))

    # Get total count (with filters applied)
    count_subquery = base_query.with_only_columns(Project.id).subquery()
    total_result = await db.execute(select(func.count()).select_from(count_subquery))
    total_items = total_result.scalar() or 0

    # Calculate pagination (page-based, aligned with quotes endpoint)
    total_pages = ceil(total_items / limit) if total_items > 0 else 1
    offset = (page - 1) * limit

    # Apply ordering and page-based pagination
    paginated_query = (
        base_query
        .order_by(
            Project.updated_at.desc().nullsfirst(),
            Project.created_at.desc(),
        )
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(paginated_query)
    projects = list(result.scalars().all())

    # Batch-fetch quote counts instead of N+1 queries
    if projects:
        project_ids = [p.id for p in projects]
        quote_count_query = (
            select(Quote.project_id, func.count().label("cnt"))
            .where(Quote.project_id.in_(project_ids))
            .group_by(Quote.project_id)
        )
        quote_counts_result = await db.execute(quote_count_query)
        quote_counts = {row.project_id: row.cnt for row in quote_counts_result}
    else:
        quote_counts = {}

    project_responses = []
    for project in projects:
        project_response = ProjectResponse.model_validate(project)
        project_response.quotes_count = quote_counts.get(project.id, 0)
        project_response.owner_id = project.created_by
        project_responses.append(project_response)

    pagination = PaginationMeta(
        page=page,
        page_size=limit,
        total_items=total_items,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_previous=page > 1,
    )

    return ProjectListResponse(
        success=True,
        data=ProjectListData(
            data=project_responses,
            pagination=pagination,
        ),
    )


@router.get(
    "/{project_id}",
    response_model=ProjectDetailDataResponse,
    summary="Get project details",
    description="Returns detailed information about a specific project.",
    responses={
        200: {"description": "Project retrieved successfully"},
        401: {"description": "Not authenticated"},
        403: {"description": "Access denied"},
        404: {"description": "Project not found"},
    },
)
async def get_project(
    project_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
) -> ProjectDetailDataResponse:
    logger.debug("Getting project: id=%s, user=%s", project_id, current_user.email)

    project, my_access_level = await get_project_with_permission(
        project_id, current_user, db, AccessLevel.READ
    )

    # Get quote count
    quote_count_query = select(func.count()).where(Quote.project_id == project.id)
    quote_count_result = await db.execute(quote_count_query)
    quote_count = quote_count_result.scalar() or 0

    # Get requirements count from the latest quote's metadata
    requirements_count = 0
    latest_quote_query = (
        select(Quote)
        .where(Quote.project_id == project.id)
        .order_by(Quote.created_at.desc())
        .limit(1)
    )
    latest_quote_result = await db.execute(latest_quote_query)
    latest_quote = latest_quote_result.scalar_one_or_none()
    if latest_quote and latest_quote.extra_data:
        requirements_count = latest_quote.extra_data.get("requirements_count", 0)

    # Build owner from eagerly-loaded creator
    owner = ProjectOwner(
        id=project.creator.id,
        full_name=project.creator.full_name,
        email=project.creator.email,
        avatar_url=getattr(project.creator, 'avatar_url', None),
    ) if project.creator else ProjectOwner(
        id=project.created_by,
        full_name="Unknown",
        email="unknown@example.com",
        avatar_url=None,
    )

    # Build response with all required fields
    # Can't use model_validate(project) directly because 'owner' is required
    # but doesn't exist on the Project model
    detail_response = ProjectDetailResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        additional_instructions=project.additional_instructions,
        reference_urls=project.reference_urls if project.reference_urls is not None else None,
        platform=project.platform,
        status=project.status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        quotes_count=quote_count,
        client=project.client,
        owner=owner,
        my_access_level=my_access_level,
        team_members=[],
        target_completion_date=None,
        requirements_count=requirements_count,
    )

    return ProjectDetailDataResponse(
        success=True,
        data=detail_response,
    )


@router.put(
    "/{project_id}",
    response_model=ProjectDataResponse,
    summary="Update project",
    description="Updates an existing project.",
    responses={
        200: {"description": "Project updated successfully"},
        401: {"description": "Not authenticated"},
        403: {"description": "Access denied"},
        404: {"description": "Project not found"},
    },
)
async def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    current_user: ActiveUser,
    db: DbSession,
) -> ProjectDataResponse:
    logger.info("Updating project: id=%s, user=%s", project_id, current_user.email)

    project, _ = await get_project_with_permission(
        project_id, current_user, db, AccessLevel.EDIT_CONTENT
    )

    update_data = project_data.model_dump(exclude_unset=True)
    changes = list(update_data.keys())  # Track which fields changed
    for field, value in update_data.items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)

    logger.info("Project updated: id=%s", project.id)

    # Audit log: project updated
    try:
        await audit.log_action(
            db=db,
            actor_user_id=current_user.id,
            actor_role=current_user.role.value,
            action="project.updated",
            outcome=ActionOutcome.SUCCESS,
            resource_type="project",
            resource_id=project.id,
            project_id=project.id,
            metadata=audit.with_admin_bypass({"changes": changes}, project, current_user),
        )
    except Exception as e:
        logger.error("Failed to log audit for project update: %s", e)

    # Get quote count
    quote_count_query = select(func.count()).where(Quote.project_id == project.id)
    quote_count_result = await db.execute(quote_count_query)
    quote_count = quote_count_result.scalar() or 0

    project_response = ProjectResponse.model_validate(project)
    project_response.quotes_count = quote_count

    return ProjectDataResponse(
        success=True,
        data=project_response,
    )


@router.delete(
    "/{project_id}",
    response_model=ProjectDeleteResponse,
    summary="Delete project",
    description="Deletes a project and all associated quotes and chat messages.",
    responses={
        200: {"description": "Project deleted successfully"},
        401: {"description": "Not authenticated"},
        403: {"description": "Access denied"},
        404: {"description": "Project not found"},
    },
)
async def delete_project(
    project_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
) -> ProjectDeleteResponse:
    logger.info("Deleting project: id=%s, user=%s", project_id, current_user.email)

    project = await get_project_with_owner_or_admin(project_id, current_user, db)
    project_name = project.name

    await db.delete(project)
    await db.commit()

    logger.info("Project deleted: id=%s, name=%s", project_id, project_name)

    # Audit log: project deleted
    try:
        await audit.log_action(
            db=db,
            actor_user_id=current_user.id,
            actor_role=current_user.role.value,
            action="project.deleted",
            outcome=ActionOutcome.SUCCESS,
            resource_type="project",
            resource_id=project_id,
            project_id=project_id,
            metadata=audit.with_admin_bypass({"name": project_name}, project, current_user),
        )
    except Exception as e:
        logger.error("Failed to log audit for project deletion: %s", e)

    return ProjectDeleteResponse(
        success=True,
        data={"message": f"Project '{project_name}' deleted successfully"},
    )


@router.get("/{project_id}/activity", response_model=AuditLogsListResponse)
async def get_project_activity(
    project_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    per_page: int = Query(50, ge=1, le=100, description="Items per page"),
) -> AuditLogsListResponse:
    """
    Get activity log for a specific project.

    Only users with access to the project (owner, shared users, admin) can view.
    Returns logs ordered by timestamp descending (most recent first).
    """
    # Verify access (reuses existing helper which checks owner, shared users, admin)
    await get_project_with_access(project_id, current_user, db)

    logger.info(
        "User %s requested activity for project %s: page=%d, per_page=%d",
        current_user.email,
        project_id,
        page,
        per_page,
    )

    # Query audit logs filtered by project_id with user join
    query = (
        select(
            AuditLog,
            User.full_name,
            User.email,
        )
        .outerjoin(User, AuditLog.actor_user_id == User.id)
        .where(AuditLog.project_id == project_id)
        .order_by(AuditLog.timestamp.desc())
    )

    # Get total count
    count_query = select(func.count()).select_from(
        query.alias()
    )
    total = await db.scalar(count_query) or 0

    # Paginate
    offset = (page - 1) * per_page
    results = await db.execute(query.offset(offset).limit(per_page))
    rows = results.all()

    # Map to response
    logs = []
    for row in rows:
        audit_log = row[0]
        actor_name = row[1]
        actor_email = row[2]

        logs.append(
            AuditLogResponse(
                id=audit_log.id,
                actor_user_id=audit_log.actor_user_id,
                actor_role=audit_log.actor_role,
                actor_name=actor_name,
                actor_email=actor_email,
                action=audit_log.action,
                outcome=audit_log.outcome.value,
                resource_type=audit_log.resource_type,
                resource_id=audit_log.resource_id,
                project_id=audit_log.project_id,
                project_name=None,  # Not needed for project-scoped view
                timestamp=audit_log.timestamp,
                ip_address=audit_log.ip_address,
                metadata=audit_log.metadata_,
            )
        )

    total_pages = (total + per_page - 1) // per_page if total > 0 else 0

    return AuditLogsListResponse(
        success=True,
        data=logs,
        pagination=PaginationMeta(
            page=page,
            page_size=per_page,
            total_items=total,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        ),
    )

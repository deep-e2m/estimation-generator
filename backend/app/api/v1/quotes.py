"""
Quote API endpoints.

This module provides endpoints for quote management including
generation, CRUD operations, status management, and regeneration.
"""

import logging
import time
from datetime import datetime, timezone
from decimal import Decimal
from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.dependencies import ActiveUser, DbSession, api_error, get_project_with_access
from app.models.project import Project
from app.models.quote import Complexity, Quote, QuoteStatus
from app.schemas.project import PaginationMeta
from app.schemas.quote import (
    AnalysisMetadata,
    ChangeDescription,
    QuoteCreate,
    QuoteDataResponse,
    QuoteDeleteResponse,
    QuoteDetailDataResponse,
    QuoteDetailResponse,
    QuoteGenerateDataResponse,
    QuoteGenerateRequest,
    QuoteGenerationMetadata,
    QuoteGenerationResponse,
    QuoteListData,
    QuoteListResponse,
    QuoteRegenerateRequest,
    QuoteResponse,
    QuoteStatusUpdate,
    QuoteSummaryResponse,
    QuoteUpdate,
    RefineQuoteDataResponse,
    RefineQuoteRequest,
    RefineQuoteResponse,
)
from app.services.ai.llm_service import LLMService, get_llm_service
from app.services.ai.rag_service import RAGService, get_rag_service
from app.services.export.html_utils import is_html_content, sanitize_html
from app.services.quote_refinement_service import get_refinement_service

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Helper Functions
# =============================================================================


async def get_quote_with_access_check(
    quote_id: UUID,
    current_user,
    db,
    include_project: bool = False,
) -> Quote:
    """Get quote and verify user has access."""
    query = select(Quote).where(Quote.id == quote_id)
    if include_project:
        query = query.options(selectinload(Quote.project))

    result = await db.execute(query)
    quote = result.scalar_one_or_none()

    if quote is None:
        raise api_error(status.HTTP_404_NOT_FOUND, "QUOTE_NOT_FOUND", "Quote not found")

    if quote.created_by != current_user.id and not current_user.is_admin:
        raise api_error(status.HTTP_403_FORBIDDEN, "ACCESS_DENIED", "You don't have access to this quote")

    return quote


def extract_analysis_metadata(content: str, requirements: str, breakdown: list | None = None) -> AnalysisMetadata:
    """
    Extract analysis metadata from generated quote content.

    Parses the content to count requirements, tasks, sections, and pages.
    Requirements count is derived from the requirements text so it stays
    consistent between live analysis and project detail.
    """
    import re

    # Count requirements from the original requirements text (single source of truth)
    # 1) Explicit list items: bullets, numbered items
    req_list_patterns = [
        r'^\s*[-•*]\s+',  # Bullet points
        r'^\s*\d+[.)]\s+',  # Numbered items (1. 2) etc.)
    ]
    # 2) Lines that look like requirement phrases (keyword or substantial line)
    req_phrase_pattern = re.compile(
        r'(?:need|require|want|must|should|include|feature|page|section)\s+',
        re.IGNORECASE,
    )
    requirements_lines = [ln.strip() for ln in requirements.split('\n') if ln.strip()]
    requirements_count = 0
    for line in requirements_lines:
        if not line or line.startswith('#'):
            continue
        is_list_item = any(re.search(p, line) for p in req_list_patterns)
        is_requirement_phrase = len(line) > 15 and (req_phrase_pattern.search(line) or len(line) > 40)
        if is_list_item or is_requirement_phrase:
            requirements_count += 1
    # If no structured items found, treat each substantial non-empty line as one requirement
    if requirements_count == 0 and requirements_lines:
        requirements_count = sum(1 for ln in requirements_lines if len(ln) > 10 and not ln.startswith('#'))
    # When there was input but no lines matched, treat as one requirement
    if requirements.strip() and requirements_count == 0:
        requirements_count = 1

    # Count tasks from the breakdown if available, or from content
    tasks_count = 0
    if breakdown and isinstance(breakdown, list):
        tasks_count = len(breakdown)
    else:
        # Count from content - look for task-like patterns
        task_patterns = [
            r'^\s*[-•]\s+[A-Z]',  # Bullet items starting with capital
            r'^\d+\.\d+\s+',  # Subsection numbers like 2.1, 2.2
            r'(?:page|template|section|component|feature)\s*[:\-]',  # Task keywords
        ]
        content_lines = content.split('\n')
        for line in content_lines:
            for pattern in task_patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    tasks_count += 1
                    break
    
    # Ensure minimum tasks
    tasks_count = max(tasks_count, 5)
    
    # Count sections (numbered headers like "1.", "2.", etc.)
    section_pattern = r'^\s*\d+\.\s+[A-Z]'
    sections_count = len(re.findall(section_pattern, content, re.MULTILINE))
    sections_count = max(sections_count, 1)
    
    # Count pages mentioned
    page_patterns = [
        r'(?:homepage|home\s+page)',
        r'(?:about|contact|services?|portfolio|blog|faq)\s+page',
        r'(?:landing\s+page)',
        r'\(\d+\s+pages?\)',
        r'(?:core\s+pages?|inner\s+pages?)',
    ]
    pages_count = 0
    for pattern in page_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        pages_count += len(matches)
    
    # Try to extract explicit page count
    explicit_page_match = re.search(r'(\d+)\s+(?:core\s+)?pages?', content, re.IGNORECASE)
    if explicit_page_match:
        pages_count = max(pages_count, int(explicit_page_match.group(1)))
    
    pages_count = max(pages_count, 1)
    
    # Identify complexity factors and feature flags
    complexity_factors: list[str] = []

    # Multi-language support
    multi_lang_pattern = r'multi[- ]?language|bilingual|multilingual|wpml|polylang'
    has_multi_language = bool(re.search(multi_lang_pattern, content, re.IGNORECASE))
    if has_multi_language:
        complexity_factors.append("Multi-language support")

    # E-commerce
    if re.search(r'e[- ]?commerce|woocommerce|shop|cart|checkout', content, re.IGNORECASE):
        complexity_factors.append("E-commerce functionality")

    # Custom development
    if re.search(r'custom\s+(?:plugin|theme|development)', content, re.IGNORECASE):
        complexity_factors.append("Custom development")

    # Content migration
    if re.search(r'migration|migrate|transfer', content, re.IGNORECASE):
        complexity_factors.append("Content migration")

    # API / integrations
    if re.search(r'api|integration|third[- ]?party', content, re.IGNORECASE):
        complexity_factors.append("API/Integration work")

    # Interactive tools / calculators / embeds
    interactive_pattern = r'interactive|calculator|tool|embed'
    has_interactive_tools = bool(re.search(interactive_pattern, content, re.IGNORECASE))
    if has_interactive_tools:
        complexity_factors.append("Interactive tools")

    # SEO / analytics (check both requirements and generated content)
    seo_source = f"{requirements}\n{content}"
    seo_pattern = (
        r'\bseo\b|search engine|rank math|yoast|google analytics|ga4\b|analytics\b|schema markup|structured data'
    )
    has_seo = bool(re.search(seo_pattern, seo_source, re.IGNORECASE))
    if has_seo:
        complexity_factors.append("SEO and analytics")
    
    return AnalysisMetadata(
        requirements_count=requirements_count,
        tasks_count=tasks_count,
        sections_count=sections_count,
        pages_count=pages_count,
        complexity_factors=complexity_factors,
        has_multi_language=has_multi_language,
        has_interactive_tools=has_interactive_tools,
        has_seo=has_seo,
    )


# =============================================================================
# Quote Listing Endpoints
# =============================================================================


@router.get(
    "/quotes",
    response_model=QuoteListResponse,
    summary="List all quotes for current user",
    description="Returns a paginated list of all quotes created by the current user across all projects.",
    responses={
        200: {"description": "Quotes retrieved successfully"},
        401: {"description": "Not authenticated"},
    },
)
async def list_all_quotes(
    current_user: ActiveUser,
    db: DbSession,
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    sort_by: str = Query(default="created_at", description="Field to sort by"),
    sort_order: str = Query(default="desc", description="Sort order (asc/desc)"),
    status_filter: Optional[QuoteStatus] = Query(
        default=None, alias="status", description="Filter by quote status"
    ),
) -> QuoteListResponse:
    """
    List all quotes for the current user with pagination and sorting.

    Args:
        current_user: The authenticated user.
        db: Database session.
        page: Page number (1-indexed).
        limit: Number of items per page.
        sort_by: Field to sort by.
        sort_order: Sort order (asc/desc).
        status_filter: Optional status filter.

    Returns:
        QuoteListResponse: Paginated list of quotes.
    """
    # Build base query - get quotes created by current user
    base_query = select(Quote).where(Quote.created_by == current_user.id)

    if status_filter:
        base_query = base_query.where(Quote.status == status_filter)

    # Get total count
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total_items = total_result.scalar() or 0

    # Calculate pagination
    total_pages = ceil(total_items / limit) if total_items > 0 else 1
    offset = (page - 1) * limit

    # Determine sort column
    sort_column = Quote.created_at  # default
    if sort_by == "updated_at":
        sort_column = Quote.updated_at
    elif sort_by == "title":
        sort_column = Quote.title
    elif sort_by == "total_hours":
        sort_column = Quote.total_hours
    elif sort_by == "status":
        sort_column = Quote.status

    # Apply sorting
    if sort_order.lower() == "asc":
        sort_expression = sort_column.asc()
    else:
        sort_expression = sort_column.desc()

    # Fetch quotes with pagination and sorting (eager load project for project_name)
    paginated_query = (
        base_query
        .options(selectinload(Quote.project))
        .order_by(sort_expression)
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(paginated_query)
    quotes = result.scalars().all()

    quote_responses = [
        QuoteSummaryResponse(
            id=quote.id,
            quote_number=f"QT-{str(quote.id)[:8].upper()}",
            project_id=quote.project_id,
            project_name=quote.project.name if quote.project else None,
            title=quote.title,
            total_hours=quote.total_hours,
            platform=quote.platform,
            complexity=quote.complexity,
            status=quote.status,
            created_at=quote.created_at,
            updated_at=quote.updated_at,
        )
        for quote in quotes
    ]

    pagination = PaginationMeta(
        page=page,
        page_size=limit,
        total_items=total_items,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_previous=page > 1,
    )

    return QuoteListResponse(
        success=True,
        data=QuoteListData(
            quotes=quote_responses,
            pagination=pagination,
        ),
    )


# =============================================================================
# Quote Generation Endpoints
# =============================================================================


@router.post(
    "/projects/{project_id}/quotes",
    response_model=QuoteGenerateDataResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a new quote",
    description="Generates a new quote using LLM with optional RAG context. IMPORTANT: Only ONE estimate per project is allowed.",
    responses={
        201: {"description": "Quote generated successfully"},
        400: {"description": "Validation error or estimate already exists"},
        401: {"description": "Not authenticated"},
        403: {"description": "Access denied"},
        404: {"description": "Project not found"},
        500: {"description": "Quote generation failed"},
    },
)
async def generate_quote(
    project_id: UUID,
    request: QuoteGenerateRequest,
    current_user: ActiveUser,
    db: DbSession,
) -> QuoteGenerateDataResponse:
    """
    Generate a new quote using LLM.

    IMPORTANT: Only ONE estimate per project is allowed. Attempting to generate
    a second estimate will return an error. If a different estimate is required,
    create a new project.

    This endpoint:
    1. Verifies project exists and user has access
    2. Checks if project already has an estimate (enforces single estimate rule)
    3. Gets RAG context from knowledge base (if enabled)
    4. Generates quote using LLMService
    5. Saves quote to database (hours only - NO pricing)
    6. Returns quote with generation metadata

    Args:
        project_id: The project UUID.
        request: Quote generation request.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        QuoteGenerateDataResponse: Generated quote with metadata.
    """
    logger.info(
        "Generating quote: project_id=%s, user=%s, use_rag=%s",
        project_id,
        current_user.email,
        request.use_rag,
    )

    start_time = time.time()

    # Verify project access
    project = await get_project_with_access(project_id, current_user, db)

    # ENFORCE SINGLE ESTIMATE PER PROJECT (unless regenerate=True)
    # Check if project already has an estimate
    existing_quote_query = select(Quote).where(Quote.project_id == project_id)
    existing_result = await db.execute(existing_quote_query)
    existing_quote = existing_result.scalar_one_or_none()

    if existing_quote is not None:
        if request.regenerate:
            # Delete existing quote to allow regeneration
            logger.info(
                "Regenerating estimate: deleting existing quote_id=%s for project_id=%s",
                existing_quote.id,
                project_id,
            )
            await db.delete(existing_quote)
            await db.commit()
        else:
            logger.warning(
                "Attempted to create second estimate for project: project_id=%s, existing_quote=%s",
                project_id,
                existing_quote.id,
            )
            raise api_error(
                status.HTTP_400_BAD_REQUEST,
                "ESTIMATE_ALREADY_EXISTS",
                "This project already has an estimate. Only ONE estimate per project is allowed. Set regenerate=true to replace the existing estimate.",
            )

    # Get RAG context if enabled
    rag_context = None
    if request.use_rag:
        try:
            rag_service = get_rag_service()
            rag_context = await rag_service.build_rag_context(
                query=request.requirements,
                platform=project.platform.value,
                db_session=db,
            )
            logger.debug("RAG context built: %d characters", len(rag_context) if rag_context else 0)
        except Exception as e:
            logger.warning("Failed to get RAG context: %s", str(e))
            # Rollback to clear any failed transaction state
            await db.rollback()
            # Continue without RAG context

    # Generate quote using LLM (HOURS ONLY - NO PRICING)
    try:
        llm_service = get_llm_service()
        result = await llm_service.generate_quote(
            requirements=request.requirements,
            platform=project.platform.value,
            rag_context=rag_context,
            project_context=request.project_context,
            # NOTE: hourly_rate intentionally NOT passed - billing/pricing is out of scope
            # Pricing is handled by separate sales team
        )
    except Exception as e:
        logger.error("Quote generation failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "QUOTE_GENERATION_FAILED",
                "message": f"Failed to generate quote: {str(e)}",
            },
        )

    # Determine title
    title = request.title
    if not title and (request.requirements or "").strip():
        # Generate title from requirements (first 100 chars)
        req = request.requirements[:100].strip()
        title = req + ("..." if len(request.requirements) > 100 else "")
    if not title and request.project_context:
        title = (request.project_context.get("project_name") or "").strip()
    if not title:
        title = project.name or "Project Estimate"

    # Determine complexity
    complexity = Complexity.MEDIUM
    if result.total_hours:
        if result.total_hours < 20:
            complexity = Complexity.LOW
        elif result.total_hours > 80:
            complexity = Complexity.HIGH

    # Extract analysis metadata to get requirements count and feature flags
    analysis_metadata = extract_analysis_metadata(
        content=result.content,
        requirements=request.requirements,
        breakdown=result.breakdown,
    )

    # Create quote in database (HOURS ONLY - NO PRICING)
    # NOTE: total_cost is intentionally set to 0 - billing/pricing is out of scope
    # and handled by a separate sales team
    new_quote = Quote(
        project_id=project_id,
        title=title,
        content=result.content,
        requirements=request.requirements,
        total_hours=Decimal(str(result.total_hours or 0)),
        total_cost=Decimal("0"),  # Pricing is out of scope
        platform=project.platform.value,
        complexity=complexity,
        status=QuoteStatus.DRAFT,
        created_by=current_user.id,
        extra_data={
            "model_used": result.model_used,
            "tokens_used": result.tokens_used,
            "generation_cost": result.generation_cost,
            "rag_context_used": bool(rag_context),
            "breakdown": result.breakdown,
            "assumptions": result.assumptions,
            "exclusions": result.exclusions,
            "requirements_count": analysis_metadata.requirements_count,
            # Persist analysis snapshot and feature flags for dashboard / estimation UI
            "analysis": analysis_metadata.model_dump(),
            "feature_flags": {
                "multi_language": analysis_metadata.has_multi_language,
                "interactive_tools": analysis_metadata.has_interactive_tools,
                "seo": analysis_metadata.has_seo,
            },
        },
    )

    db.add(new_quote)
    await db.commit()
    await db.refresh(new_quote)

    generation_time_ms = int((time.time() - start_time) * 1000)

    logger.info(
        "Quote generated: id=%s, hours=%s, tokens=%d, time=%dms",
        new_quote.id,
        result.total_hours,
        result.tokens_used,
        generation_time_ms,
    )

    # Generate quote number from ID
    quote_number = f"QT-{str(new_quote.id)[:8].upper()}"

    return QuoteGenerateDataResponse(
        success=True,
        data=QuoteGenerationResponse(
            quote=QuoteResponse(
                id=new_quote.id,
                quote_number=quote_number,
                project_id=new_quote.project_id,
                title=new_quote.title,
                content=new_quote.content,
                content_format=new_quote.content_format,
                requirements=new_quote.requirements,
                total_hours=new_quote.total_hours,
                platform=new_quote.platform,
                complexity=new_quote.complexity,
                status=new_quote.status,
                created_by=new_quote.created_by,
                approved_by=new_quote.approved_by,
                approved_at=new_quote.approved_at,
                metadata=new_quote.extra_data,
                created_at=new_quote.created_at,
                updated_at=new_quote.updated_at,
            ),
            generation_metadata=QuoteGenerationMetadata(
                model_used=result.model_used,
                tokens_used=result.tokens_used,
                generation_cost=result.generation_cost,
                rag_context_used=bool(rag_context),
                generation_time_ms=generation_time_ms,
                analysis=analysis_metadata,
            ),
        ),
    )


# =============================================================================
# Quote CRUD Endpoints
# =============================================================================


@router.get(
    "/projects/{project_id}/quotes",
    response_model=QuoteListResponse,
    summary="List quotes for a project",
    description="Returns a paginated list of quotes for a specific project.",
    responses={
        200: {"description": "Quotes retrieved successfully"},
        401: {"description": "Not authenticated"},
        403: {"description": "Access denied"},
        404: {"description": "Project not found"},
    },
)
async def list_project_quotes(
    project_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    status_filter: Optional[QuoteStatus] = Query(
        default=None, alias="status", description="Filter by quote status"
    ),
) -> QuoteListResponse:
    """
    List quotes for a project with pagination.

    Args:
        project_id: The project UUID.
        current_user: The authenticated user.
        db: Database session.
        page: Page number (1-indexed).
        page_size: Number of items per page.
        status_filter: Optional status filter.

    Returns:
        QuoteListResponse: Paginated list of quotes.
    """
    # Verify project access
    await get_project_with_access(project_id, current_user, db)

    # Build base query
    base_query = select(Quote).where(Quote.project_id == project_id)

    if status_filter:
        base_query = base_query.where(Quote.status == status_filter)

    # Get total count
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total_items = total_result.scalar() or 0

    # Calculate pagination
    total_pages = ceil(total_items / page_size) if total_items > 0 else 1
    offset = (page - 1) * page_size

    # Fetch quotes with pagination
    paginated_query = (
        base_query
        .order_by(Quote.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )

    result = await db.execute(paginated_query)
    quotes = result.scalars().all()

    quote_responses = [
        QuoteSummaryResponse(
            id=quote.id,
            quote_number=f"QT-{str(quote.id)[:8].upper()}",
            project_id=quote.project_id,
            title=quote.title,
            total_hours=quote.total_hours,
            platform=quote.platform,
            complexity=quote.complexity,
            status=quote.status,
            created_at=quote.created_at,
            updated_at=quote.updated_at,
        )
        for quote in quotes
    ]

    pagination = PaginationMeta(
        page=page,
        page_size=page_size,
        total_items=total_items,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_previous=page > 1,
    )

    return QuoteListResponse(
        success=True,
        data=QuoteListData(
            quotes=quote_responses,
            pagination=pagination,
        ),
    )


@router.get(
    "/quotes/{quote_id}",
    response_model=QuoteDetailDataResponse,
    summary="Get quote details",
    description="Returns detailed information about a specific quote.",
    responses={
        200: {"description": "Quote retrieved successfully"},
        401: {"description": "Not authenticated"},
        403: {"description": "Access denied"},
        404: {"description": "Quote not found"},
    },
)
async def get_quote(
    quote_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
) -> QuoteDetailDataResponse:
    """
    Get quote details by ID.

    Args:
        quote_id: The quote UUID.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        QuoteDetailDataResponse: The quote details.
    """
    # Fetch quote with relationships
    query = (
        select(Quote)
        .options(
            selectinload(Quote.project),
            selectinload(Quote.creator),
            selectinload(Quote.approver),
        )
        .where(Quote.id == quote_id)
    )
    result = await db.execute(query)
    quote = result.scalar_one_or_none()

    if quote is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "QUOTE_NOT_FOUND",
                "message": "Quote not found",
            },
        )

    # Check access
    if quote.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ACCESS_DENIED",
                "message": "You don't have access to this quote",
            },
        )

    return QuoteDetailDataResponse(
        success=True,
        data=QuoteDetailResponse(
            id=quote.id,
            project_id=quote.project_id,
            title=quote.title,
            content=quote.content,
            content_format=quote.content_format,
            requirements=quote.requirements,
            total_hours=quote.total_hours,
            platform=quote.platform,
            complexity=quote.complexity,
            status=quote.status,
            created_by=quote.created_by,
            approved_by=quote.approved_by,
            approved_at=quote.approved_at,
            metadata=quote.extra_data,
            created_at=quote.created_at,
            updated_at=quote.updated_at,
            project_name=quote.project.name if quote.project else None,
            creator_name=quote.creator.full_name if quote.creator else None,
            approver_name=quote.approver.full_name if quote.approver else None,
        ),
    )


@router.put(
    "/quotes/{quote_id}",
    response_model=QuoteDataResponse,
    summary="Update quote",
    description="Updates an existing quote content.",
    responses={
        200: {"description": "Quote updated successfully"},
        400: {"description": "Cannot modify finalized quote"},
        401: {"description": "Not authenticated"},
        403: {"description": "Access denied"},
        404: {"description": "Quote not found"},
    },
)
async def update_quote(
    quote_id: UUID,
    quote_data: QuoteUpdate,
    current_user: ActiveUser,
    db: DbSession,
) -> QuoteDataResponse:
    """
    Update an existing quote.

    Only draft quotes can be updated. Published, approved, or rejected
    quotes cannot be modified.

    Args:
        quote_id: The quote UUID.
        quote_data: Quote update data.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        QuoteDataResponse: The updated quote.
    """
    logger.info("Updating quote: id=%s, user=%s", quote_id, current_user.email)

    quote = await get_quote_with_access_check(quote_id, current_user, db)

    # Check if quote can be modified
    if quote.status != QuoteStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "QUOTE_NOT_EDITABLE",
                "message": f"Cannot modify quote with status '{quote.status.value}'. Only draft quotes can be edited.",
            },
        )

    # Update fields
    update_data = quote_data.model_dump(exclude_unset=True)

    # Sanitize HTML content to prevent XSS.
    # The Tiptap editor sends HTML; we strip disallowed tags/attributes
    # before persisting.
    if "content" in update_data and update_data["content"]:
        raw_content = update_data["content"]
        if is_html_content(raw_content):
            update_data["content"] = sanitize_html(raw_content)
            # Auto-detect content_format if not explicitly provided.
            if "content_format" not in update_data or update_data["content_format"] is None:
                from app.models.quote import ContentFormat
                update_data["content_format"] = ContentFormat.HTML
            logger.debug(
                "Sanitized HTML content for quote %s (original length=%d, sanitized length=%d)",
                quote_id,
                len(raw_content),
                len(update_data["content"]),
            )
        else:
            # Plain markdown content -- set format explicitly if not provided.
            if "content_format" not in update_data or update_data["content_format"] is None:
                from app.models.quote import ContentFormat
                update_data["content_format"] = ContentFormat.MARKDOWN

    for field, value in update_data.items():
        setattr(quote, field, value)

    await db.commit()
    await db.refresh(quote)

    logger.info("Quote updated: id=%s", quote.id)

    return QuoteDataResponse(
        success=True,
        data=QuoteResponse(
            id=quote.id,
            quote_number=f"QT-{str(quote.id)[:8].upper()}",
            project_id=quote.project_id,
            title=quote.title,
            content=quote.content,
            content_format=quote.content_format,
            requirements=quote.requirements,
            total_hours=quote.total_hours,
            platform=quote.platform,
            complexity=quote.complexity,
            status=quote.status,
            created_by=quote.created_by,
            approved_by=quote.approved_by,
            approved_at=quote.approved_at,
            metadata=quote.extra_data,
            created_at=quote.created_at,
            updated_at=quote.updated_at,
        ),
    )


@router.put(
    "/quotes/{quote_id}/status",
    response_model=QuoteDataResponse,
    summary="Update quote status",
    description="Updates the status of a quote (draft -> published -> approved/rejected).",
    responses={
        200: {"description": "Quote status updated successfully"},
        400: {"description": "Invalid status transition"},
        401: {"description": "Not authenticated"},
        403: {"description": "Access denied"},
        404: {"description": "Quote not found"},
    },
)
async def update_quote_status(
    quote_id: UUID,
    status_data: QuoteStatusUpdate,
    current_user: ActiveUser,
    db: DbSession,
) -> QuoteDataResponse:
    """
    Update quote status.

    Valid transitions:
    - draft -> published
    - published -> approved
    - published -> rejected
    - draft -> approved (admin only)

    Args:
        quote_id: The quote UUID.
        status_data: New status.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        QuoteDataResponse: The updated quote.
    """
    logger.info(
        "Updating quote status: id=%s, new_status=%s, user=%s",
        quote_id,
        status_data.status.value,
        current_user.email,
    )

    quote = await get_quote_with_access_check(quote_id, current_user, db)
    new_status = status_data.status
    current_status = quote.status

    # Validate status transition
    valid_transitions = {
        QuoteStatus.DRAFT: [QuoteStatus.PUBLISHED, QuoteStatus.APPROVED],
        QuoteStatus.PUBLISHED: [QuoteStatus.APPROVED, QuoteStatus.REJECTED, QuoteStatus.DRAFT],
        QuoteStatus.APPROVED: [],  # Final state
        QuoteStatus.REJECTED: [QuoteStatus.DRAFT],  # Can revert to draft
    }

    if new_status not in valid_transitions.get(current_status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_STATUS_TRANSITION",
                "message": f"Cannot transition from '{current_status.value}' to '{new_status.value}'",
            },
        )

    # Update status
    quote.status = new_status

    # Set approval info if approving
    if new_status == QuoteStatus.APPROVED:
        quote.approved_by = current_user.id
        quote.approved_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(quote)

    logger.info("Quote status updated: id=%s, status=%s", quote.id, quote.status.value)

    return QuoteDataResponse(
        success=True,
        data=QuoteResponse(
            id=quote.id,
            quote_number=f"QT-{str(quote.id)[:8].upper()}",
            project_id=quote.project_id,
            title=quote.title,
            content=quote.content,
            content_format=quote.content_format,
            requirements=quote.requirements,
            total_hours=quote.total_hours,
            platform=quote.platform,
            complexity=quote.complexity,
            status=quote.status,
            created_by=quote.created_by,
            approved_by=quote.approved_by,
            approved_at=quote.approved_at,
            metadata=quote.extra_data,
            created_at=quote.created_at,
            updated_at=quote.updated_at,
        ),
    )


@router.delete(
    "/quotes/{quote_id}",
    response_model=QuoteDeleteResponse,
    summary="Delete quote",
    description="Deletes a quote.",
    responses={
        200: {"description": "Quote deleted successfully"},
        400: {"description": "Cannot delete approved quote"},
        401: {"description": "Not authenticated"},
        403: {"description": "Access denied"},
        404: {"description": "Quote not found"},
    },
)
async def delete_quote(
    quote_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
) -> QuoteDeleteResponse:
    """
    Delete a quote.

    Approved quotes cannot be deleted (archive them instead).

    Args:
        quote_id: The quote UUID.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        QuoteDeleteResponse: Deletion confirmation.
    """
    logger.info("Deleting quote: id=%s, user=%s", quote_id, current_user.email)

    quote = await get_quote_with_access_check(quote_id, current_user, db)

    # Prevent deletion of approved quotes
    if quote.status == QuoteStatus.APPROVED and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "QUOTE_DELETE_NOT_ALLOWED",
                "message": "Cannot delete an approved quote. Contact an administrator.",
            },
        )

    quote_title = quote.title

    await db.delete(quote)
    await db.commit()

    logger.info("Quote deleted: id=%s, title=%s", quote_id, quote_title)

    return QuoteDeleteResponse(
        success=True,
        data={"message": f"Quote '{quote_title}' deleted successfully"},
    )


# =============================================================================
# Quote Regeneration Endpoint
# =============================================================================


@router.post(
    "/quotes/{quote_id}/regenerate",
    response_model=QuoteGenerateDataResponse,
    summary="Regenerate quote",
    description="Regenerates a quote with optional feedback for refinement.",
    responses={
        200: {"description": "Quote regenerated successfully"},
        400: {"description": "Cannot regenerate finalized quote"},
        401: {"description": "Not authenticated"},
        403: {"description": "Access denied"},
        404: {"description": "Quote not found"},
        500: {"description": "Quote regeneration failed"},
    },
)
async def regenerate_quote(
    quote_id: UUID,
    request: QuoteRegenerateRequest,
    current_user: ActiveUser,
    db: DbSession,
) -> QuoteGenerateDataResponse:
    """
    Regenerate an existing quote.

    Uses the existing requirements and optionally incorporates
    feedback to refine the quote.

    Args:
        quote_id: The quote UUID.
        request: Regeneration request with optional feedback.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        QuoteGenerateDataResponse: Regenerated quote with metadata.
    """
    logger.info("Regenerating quote: id=%s, user=%s", quote_id, current_user.email)

    start_time = time.time()

    # Get quote with project
    quote = await get_quote_with_access_check(quote_id, current_user, db, include_project=True)

    # Check if quote can be regenerated
    if quote.status in [QuoteStatus.APPROVED, QuoteStatus.REJECTED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "QUOTE_NOT_REGENERATABLE",
                "message": f"Cannot regenerate quote with status '{quote.status.value}'",
            },
        )

    # Get RAG context if enabled
    rag_context = None
    if request.use_rag:
        try:
            rag_service = get_rag_service()
            rag_context = await rag_service.build_rag_context(
                query=quote.requirements,
                platform=quote.platform,
                db_session=db,
            )
        except Exception as e:
            logger.warning("Failed to get RAG context: %s", str(e))

    # Regenerate quote
    try:
        llm_service = get_llm_service()

        if request.feedback:
            # Refine with feedback
            result = await llm_service.refine_quote(
                original_quote=quote.content,
                feedback=request.feedback,
                requirements=quote.requirements,
            )
        else:
            # Full regeneration
            result = await llm_service.generate_quote(
                requirements=quote.requirements,
                platform=quote.platform,
                rag_context=rag_context,
            )
    except Exception as e:
        logger.error("Quote regeneration failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "QUOTE_REGENERATION_FAILED",
                "message": f"Failed to regenerate quote: {str(e)}",
            },
        )

    # Update quote
    quote.content = result.content
    quote.total_hours = Decimal(str(result.total_hours or quote.total_hours))
    quote.total_cost = Decimal("0")  # Cost not used

    # Recompute analysis on regenerated content so feature flags stay in sync
    analysis_metadata = extract_analysis_metadata(
        content=result.content,
        requirements=quote.requirements,
        breakdown=result.breakdown,
    )

    # Update extra_data
    existing_metadata = quote.extra_data or {}
    existing_metadata.update(
        {
            "model_used": result.model_used,
            "tokens_used": result.tokens_used,
            "generation_cost": result.generation_cost,
            "rag_context_used": bool(rag_context),
            "breakdown": result.breakdown,
            "assumptions": result.assumptions,
            "exclusions": result.exclusions,
            "regeneration_feedback": request.feedback,
            "regeneration_count": existing_metadata.get("regeneration_count", 0) + 1,
            "requirements_count": analysis_metadata.requirements_count,
            "analysis": analysis_metadata.model_dump(),
            "feature_flags": {
                "multi_language": analysis_metadata.has_multi_language,
                "interactive_tools": analysis_metadata.has_interactive_tools,
                "seo": analysis_metadata.has_seo,
            },
        }
    )
    quote.extra_data = existing_metadata

    await db.commit()
    await db.refresh(quote)

    generation_time_ms = int((time.time() - start_time) * 1000)

    logger.info(
        "Quote regenerated: id=%s, tokens=%d, time=%dms",
        quote.id,
        result.tokens_used,
        generation_time_ms,
    )

    return QuoteGenerateDataResponse(
        success=True,
        data=QuoteGenerationResponse(
            quote=QuoteResponse(
                id=quote.id,
                quote_number=f"QT-{str(quote.id)[:8].upper()}",
                project_id=quote.project_id,
                title=quote.title,
                content=quote.content,
                content_format=quote.content_format,
                requirements=quote.requirements,
                total_hours=quote.total_hours,
                platform=quote.platform,
                complexity=quote.complexity,
                status=quote.status,
                created_by=quote.created_by,
                approved_by=quote.approved_by,
                approved_at=quote.approved_at,
                metadata=quote.extra_data,
                created_at=quote.created_at,
                updated_at=quote.updated_at,
            ),
            generation_metadata=QuoteGenerationMetadata(
                model_used=result.model_used,
                tokens_used=result.tokens_used,
                generation_cost=result.generation_cost,
                rag_context_used=bool(rag_context),
                generation_time_ms=generation_time_ms,
                analysis=analysis_metadata,
            ),
        ),
    )


# =============================================================================
# Quote Refinement Endpoint
# =============================================================================


@router.post(
    "/projects/{project_id}/quotes/{quote_id}/refine",
    response_model=RefineQuoteDataResponse,
    summary="Refine quote conversationally",
    description="Applies conversational refinements to a quote using natural language.",
    responses={
        200: {"description": "Quote refined successfully"},
        400: {"description": "Cannot refine finalized quote"},
        401: {"description": "Not authenticated"},
        403: {"description": "Access denied"},
        404: {"description": "Quote not found"},
        500: {"description": "Quote refinement failed"},
    },
)
async def refine_quote(
    project_id: UUID,
    quote_id: UUID,
    request: RefineQuoteRequest,
    current_user: ActiveUser,
    db: DbSession,
) -> RefineQuoteDataResponse:
    """
    Refine a quote using natural language conversation.

    This endpoint allows users to make changes to quotes through
    natural language requests like:
    - "Increase the hours for login feature to 20"
    - "Add a new deliverable for password reset"
    - "Update the executive summary to mention mobile responsiveness"

    Args:
        project_id: The project UUID.
        quote_id: The quote UUID.
        request: Refinement request with natural language message.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        RefineQuoteDataResponse: Updated quote with changes applied.
    """
    logger.info(
        "Refining quote conversationally: project_id=%s, quote_id=%s, user=%s",
        project_id,
        quote_id,
        current_user.email,
    )

    # Verify project access
    await get_project_with_access(project_id, current_user, db)

    # Get quote
    quote = await get_quote_with_access_check(quote_id, current_user, db)

    # Verify quote belongs to project
    if quote.project_id != project_id:
        raise api_error(
            status.HTTP_404_NOT_FOUND,
            "QUOTE_NOT_FOUND",
            "Quote not found in this project",
        )

    # Check if quote can be refined
    if quote.status in [QuoteStatus.APPROVED, QuoteStatus.REJECTED]:
        raise api_error(
            status.HTTP_400_BAD_REQUEST,
            "QUOTE_NOT_REFINABLE",
            f"Cannot refine quote with status '{quote.status.value}'",
        )

    # Process refinement request
    try:
        refinement_service = get_refinement_service()
        updated_content, ai_message, changes = await refinement_service.refine_quote_conversational(
            quote=quote,
            user_message=request.message,
        )
    except Exception as e:
        logger.error("Quote refinement failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "QUOTE_REFINEMENT_FAILED",
                "message": f"Failed to refine quote: {str(e)}",
            },
        )

    # Update quote in database
    quote.content = updated_content

    # Recompute analysis on refined content to keep feature flags up to date
    breakdown_for_analysis = None
    if quote.extra_data:
        breakdown_for_analysis = quote.extra_data.get("breakdown")

    analysis_metadata = extract_analysis_metadata(
        content=updated_content,
        requirements=quote.requirements,
        breakdown=breakdown_for_analysis,
    )

    # Update extra_data to track refinement and analysis
    existing_metadata = quote.extra_data or {}
    refinement_history = existing_metadata.get("refinement_history", [])
    refinement_history.append(
        {
            "message": request.message,
            "ai_response": ai_message,
            "changes": [
                {
                    "section": change.section,
                    "change_type": change.change_type,
                    "description": change.description,
                }
                for change in changes
            ],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )
    existing_metadata["refinement_history"] = refinement_history
    existing_metadata["refinement_count"] = len(refinement_history)
    existing_metadata["requirements_count"] = analysis_metadata.requirements_count
    existing_metadata["analysis"] = analysis_metadata.model_dump()
    existing_metadata["feature_flags"] = {
        "multi_language": analysis_metadata.has_multi_language,
        "interactive_tools": analysis_metadata.has_interactive_tools,
        "seo": analysis_metadata.has_seo,
    }
    quote.extra_data = existing_metadata

    await db.commit()
    await db.refresh(quote)

    logger.info(
        "Quote refined successfully: quote_id=%s, changes=%d",
        quote.id,
        len(changes),
    )

    return RefineQuoteDataResponse(
        success=True,
        data=RefineQuoteResponse(
            updated_quote=QuoteResponse(
                id=quote.id,
                quote_number=f"QT-{str(quote.id)[:8].upper()}",
                project_id=quote.project_id,
                title=quote.title,
                content=quote.content,
                content_format=quote.content_format,
                requirements=quote.requirements,
                total_hours=quote.total_hours,
                platform=quote.platform,
                complexity=quote.complexity,
                status=quote.status,
                created_by=quote.created_by,
                approved_by=quote.approved_by,
                approved_at=quote.approved_at,
                metadata=quote.extra_data,
                created_at=quote.created_at,
                updated_at=quote.updated_at,
            ),
            ai_message=ai_message,
            changes_applied=changes,
        ),
    )


# =============================================================================
# Quote Export Endpoints
# =============================================================================


@router.post(
    "/projects/{project_id}/quotes/{quote_id}/export/docx",
    summary="Export quote as DOCX",
    description="Generates and downloads a professionally formatted DOCX document for the quote.",
    responses={
        200: {
            "description": "DOCX document generated successfully",
            "content": {
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {}
            },
        },
        401: {"description": "Not authenticated"},
        403: {"description": "Access denied"},
        404: {"description": "Project or quote not found"},
        500: {"description": "Document generation failed"},
    },
)
async def export_quote_docx(
    project_id: UUID,
    quote_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
):
    """
    Export a quote as a professionally formatted DOCX document.

    This endpoint generates a Microsoft Word document containing:
    - Company branding header
    - Title page with proposal information
    - Project overview
    - Scope of work
    - Estimated hours breakdown table
    - Timeline section
    - Assumptions
    - Exclusions/Out of scope
    - Terms and conditions

    Args:
        project_id: The project UUID.
        quote_id: The quote UUID.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        StreamingResponse: The DOCX file as a downloadable response.
    """
    from fastapi.responses import StreamingResponse
    import io

    from app.services.export.docx_service import (
        DocxExportService,
        QuoteExportData,
        get_docx_export_service,
    )

    logger.info(
        "Exporting quote as DOCX: project_id=%s, quote_id=%s, user=%s",
        project_id,
        quote_id,
        current_user.email,
    )

    # Verify project access
    project = await get_project_with_access(project_id, current_user, db)

    # Fetch quote with relationships
    query = (
        select(Quote)
        .options(
            selectinload(Quote.project),
            selectinload(Quote.creator),
        )
        .where(Quote.id == quote_id, Quote.project_id == project_id)
    )
    result = await db.execute(query)
    quote = result.scalar_one_or_none()

    if quote is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "QUOTE_NOT_FOUND",
                "message": "Quote not found in this project",
            },
        )

    # Check access
    if quote.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ACCESS_DENIED",
                "message": "You don't have access to this quote",
            },
        )

    # Extract metadata fields
    metadata = quote.extra_data or {}
    breakdown = metadata.get("breakdown", [])
    assumptions = metadata.get("assumptions", [])
    exclusions = metadata.get("exclusions", [])

    # Determine client name from project or metadata
    client_name = project.name
    if quote.extra_data and quote.extra_data.get("client_name"):
        client_name = quote.extra_data.get("client_name")

    # Prepare export data
    export_data = QuoteExportData(
        title=quote.title,
        client_name=client_name,
        project_name=project.name,
        requirements=quote.requirements,
        content=quote.content,
        total_hours=quote.total_hours,
        platform=quote.platform,
        complexity=quote.complexity.value,
        created_at=quote.created_at,
        creator_name=quote.creator.full_name if quote.creator else None,
        breakdown=breakdown if breakdown else None,
        assumptions=assumptions if assumptions else None,
        exclusions=exclusions if exclusions else None,
        extra_metadata=metadata,
    )

    # Generate DOCX document
    try:
        docx_service = get_docx_export_service()
        docx_bytes = docx_service.generate_quote_document(export_data)
    except Exception as e:
        logger.error("Failed to generate DOCX document: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "DOCX_GENERATION_FAILED",
                "message": f"Failed to generate DOCX document: {str(e)}",
            },
        )

    # Generate filename
    safe_title = "".join(
        c if c.isalnum() or c in (" ", "-", "_") else "_"
        for c in quote.title[:50]
    ).strip()
    filename = f"Proposal_{safe_title}_{quote.created_at.strftime('%Y%m%d')}.docx"

    logger.info("DOCX export completed: quote_id=%s, filename=%s", quote_id, filename)

    # Return as downloadable file
    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(docx_bytes)),
        },
    )


@router.post(
    "/projects/{project_id}/quotes/{quote_id}/export/pdf",
    summary="Export quote as PDF",
    description="Generates and downloads a professionally formatted PDF document for the quote.",
    responses={
        200: {
            "description": "PDF document generated successfully",
            "content": {
                "application/pdf": {}
            },
        },
        401: {"description": "Not authenticated"},
        403: {"description": "Access denied"},
        404: {"description": "Project or quote not found"},
        500: {"description": "PDF generation failed"},
    },
)
async def export_quote_pdf(
    project_id: UUID,
    quote_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
):
    """
    Export a quote as a branded PDF document.

    This endpoint renders a lightweight HTML representation of the quote
    (header, executive summary/body, and key metadata) and converts it
    to PDF using WeasyPrint.
    """
    from fastapi.responses import StreamingResponse
    import html as html_lib
    import io

    from weasyprint import HTML, CSS

    logger.info(
        "Exporting quote as PDF: project_id=%s, quote_id=%s, user=%s",
        project_id,
        quote_id,
        current_user.email,
    )

    # Verify project access
    project = await get_project_with_access(project_id, current_user, db)

    # Fetch quote with relationships
    query = (
        select(Quote)
        .options(
            selectinload(Quote.project),
            selectinload(Quote.creator),
        )
        .where(Quote.id == quote_id, Quote.project_id == project_id)
    )
    result = await db.execute(query)
    quote = result.scalar_one_or_none()

    if quote is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "QUOTE_NOT_FOUND",
                "message": "Quote not found in this project",
            },
        )

    # Check access
    if quote.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ACCESS_DENIED",
                "message": "You don't have access to this quote",
            },
        )

    metadata = quote.extra_data or {}

    client_name = project.name
    if metadata.get("client_name"):
        client_name = metadata["client_name"]

    # Determine body HTML
    raw_content = quote.content or ""
    if is_html_content(raw_content):
        body_html = raw_content
    else:
        # Simple markdown/plain-text to HTML: paragraphs split by blank lines
        paragraphs = [
            f"<p>{html_lib.escape(p.strip())}</p>"
            for p in raw_content.split("\n\n")
            if p.strip()
        ]
        body_html = "\n".join(paragraphs) or "<p>No content available.</p>"

    created_str = quote.created_at.strftime("%B %d, %Y")
    prepared_by = ""
    if quote.creator and getattr(quote.creator, "full_name", None):
        prepared_by = quote.creator.full_name

    title_text = quote.title or "Project Estimate"

    html_string = f"""
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Proposal - {title_text}</title>
    <style>
      @page {{
        margin: 1in;
      }}
      body {{
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
        color: #333333;
        font-size: 12px;
        line-height: 1.5;
      }}
      .header {{
        border-bottom: 2px solid #005293;
        padding-bottom: 8px;
        margin-bottom: 18px;
      }}
      .company-name {{
        font-size: 20px;
        font-weight: 700;
        color: #005293;
        margin: 0;
      }}
      .company-tagline {{
        font-size: 11px;
        color: #2980b9;
        margin: 2px 0 0 0;
      }}
      .meta {{
        margin-top: 8px;
        font-size: 11px;
        color: #555;
      }}
      .title {{
        font-size: 20px;
        font-weight: 600;
        margin: 12px 0 4px 0;
      }}
      .subtitle {{
        font-size: 14px;
        color: #555;
        margin: 0 0 12px 0;
      }}
      h1, h2, h3 {{
        color: #005293;
        margin-top: 18px;
        margin-bottom: 8px;
      }}
      h1 {{
        font-size: 18px;
      }}
      h2 {{
        font-size: 15px;
      }}
      h3 {{
        font-size: 13px;
      }}
      p {{
        margin: 4px 0 8px 0;
      }}
      ul, ol {{
        margin: 4px 0 8px 1.2em;
      }}
      table {{
        border-collapse: collapse;
        width: 100%;
        margin: 8px 0 12px 0;
        font-size: 11px;
      }}
      th, td {{
        border: 1px solid #ddd;
        padding: 4px 6px;
      }}
      th {{
        background-color: #005293;
        color: #ffffff;
        font-weight: 600;
        text-align: left;
      }}
    </style>
  </head>
  <body>
    <div class="header">
      <p class="company-name">E2M Solutions</p>
      <p class="company-tagline">Digital Excellence Delivered</p>
      <p class="meta">
        <strong>Date:</strong> {created_str}
        {"&nbsp; &nbsp; <strong>Prepared for:</strong> " + client_name if client_name else ""}
        {"&nbsp; &nbsp; <strong>Prepared by:</strong> " + prepared_by if prepared_by else ""}
      </p>
    </div>

    <div>
      <p class="title">Project Proposal</p>
      <p class="subtitle">{title_text}</p>
    </div>

    <h1>Executive Summary & Scope</h1>
    {body_html}
  </body>
</html>
    """.strip()

    try:
        pdf_bytes = HTML(string=html_string).write_pdf(stylesheets=[CSS(string="")])
    except Exception as e:
        logger.error("Failed to generate PDF document: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "PDF_GENERATION_FAILED",
                "message": f"Failed to generate PDF document: {str(e)}",
            },
        )

    safe_title = "".join(
        c if c.isalnum() or c in (" ", "-", "_") else "_"
        for c in quote.title[:50]
    ).strip()
    filename = f"Proposal_{safe_title}_{quote.created_at.strftime('%Y%m%d')}.pdf"

    logger.info("PDF export completed: quote_id=%s, filename=%s", quote_id, filename)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )

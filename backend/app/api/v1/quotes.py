"""
Quote API endpoints.

This module provides endpoints for quote management including
generation, CRUD operations, status management, and regeneration.
"""

import json
import logging
import time
from datetime import datetime, timezone
from decimal import Decimal
from math import ceil
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import String, cast, func, or_, select
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
    RefinedProjectUpdate,
    RefineQuoteDataResponse,
    RefineQuoteRequest,
    RefineQuoteResponse,
)
from app.services.ai.knowledge_service import get_knowledge_service
from app.services.ai.llm_service import LLMService, get_llm_service
from app.services.ai.rag_service import RAGService, get_rag_service
from app.services.blocknote import blocknote_json_to_html, is_blocknote_json
from app.services.export.html_utils import is_html_content, sanitize_html
from app.services.quote_refinement_service import get_refinement_service
from app.services.structured_quote_service import build_structured_content

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# WebSocket Connection Manager for Quotes
# =============================================================================


class QuoteConnectionManager:
    """
    Manages WebSocket connections for per-quote real-time updates.

    The manager is intentionally payload-agnostic: it simply relays
    JSON messages between clients subscribed to the same quote ID.
    This keeps the backend simple and lets the frontend control the
    exact Quote shape used for live estimation.
    """

    def __init__(self) -> None:
        # quote_id (str) -> list[WebSocket]
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, quote_id: str) -> None:
        """Accept a new WebSocket connection for a quote."""
        await websocket.accept()
        self.active_connections.setdefault(quote_id, []).append(websocket)
        logger.info("WebSocket connected for quote %s (total=%d)", quote_id, len(self.active_connections[quote_id]))

    def disconnect(self, websocket: WebSocket, quote_id: str) -> None:
        """Remove a WebSocket connection for a quote."""
        connections = self.active_connections.get(quote_id)
        if not connections:
            return

        self.active_connections[quote_id] = [ws for ws in connections if ws is not websocket]
        if not self.active_connections[quote_id]:
            del self.active_connections[quote_id]
        logger.info("WebSocket disconnected for quote %s", quote_id)

    async def broadcast(self, quote_id: str, message: dict[str, Any], *, exclude: WebSocket | None = None) -> None:
        """
        Broadcast a JSON message to all connections for a quote.

        The message is serialized once and sent to all active sockets.
        """
        connections = self.active_connections.get(quote_id)
        if not connections:
            return

        import json

        data = json.dumps(message)

        for ws in list(connections):
            if exclude is not None and ws is exclude:
                continue
            try:
                await ws.send_text(data)
            except Exception as exc:  # pragma: no cover - defensive logging
                logger.warning("Error sending WebSocket message for quote %s: %s", quote_id, exc)


# Global manager instance used by WebSocket endpoint
quote_ws_manager = QuoteConnectionManager()

# Default "Prepared by" value for generation and export (user can override via metadata)
DEFAULT_PREPARED_BY = "E2M Solutions"


def _prepared_by(extra_data: Optional[dict]) -> str:
    """Return prepared_by from quote metadata or default to E2M Solutions."""
    return (extra_data or {}).get("prepared_by") or DEFAULT_PREPARED_BY


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
    search: Optional[str] = Query(
        default=None,
        max_length=100,
        description="Search by quote number (e.g. QT-...), project name, or quote title",
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
        search: Optional search in quote number, project name, or title (DB-backed).

    Returns:
        QuoteListResponse: Paginated list of quotes.
    """
    # Build base query - get quotes created by current user
    base_query = select(Quote).where(Quote.created_by == current_user.id)

    if status_filter:
        base_query = base_query.where(Quote.status == status_filter)

    # DB-backed search: quote number (id), project name, or title
    if search and search.strip():
        search_term = f"%{search.strip()}%"
        base_query = base_query.join(Quote.project).where(
            or_(
                Project.name.ilike(search_term),
                Quote.title.ilike(search_term),
                cast(Quote.id, String).ilike(search_term),
            )
        )

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
            # Deep JSON representation of the estimate for JSON+HTML workflows.
            "structured_content": build_structured_content(
                content=result.content,
                breakdown=result.breakdown or [],
                total_hours=float(result.total_hours or 0),
            ).model_dump(mode="json"),
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
                prepared_by=_prepared_by(new_quote.extra_data),
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
            prepared_by=_prepared_by(quote.extra_data),
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

    response_data = QuoteResponse(
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
        prepared_by=_prepared_by(quote.extra_data),
        created_at=quote.created_at,
        updated_at=quote.updated_at,
    )

    # Broadcast updated quote snapshot to all realtime subscribers
    try:
        await quote_ws_manager.broadcast(
            str(quote.id),
            {
                "type": "quote.updated",
                "quote_id": str(quote.id),
                "project_id": str(quote.project_id),
                "payload": response_data.model_dump(mode="json"),
            },
        )
    except Exception as exc:  # pragma: no cover - best-effort notification
        logger.warning("Failed to broadcast quote update over WebSocket: %s", exc)

    return QuoteDataResponse(
        success=True,
        data=response_data,
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

    # Ingest approved quote into RAG knowledge base (own session; do not pass db)
    if new_status == QuoteStatus.APPROVED:
        try:
            knowledge_service = get_knowledge_service()
            count = await knowledge_service.ingest_approved_quote(str(quote.id), db_session=None)
            logger.info("Ingested approved quote into knowledge base: quote_id=%s, embeddings=%d", quote.id, count)
        except Exception as e:
            logger.warning("Failed to ingest approved quote into knowledge base: quote_id=%s, error=%s", quote.id, e)

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
            prepared_by=_prepared_by(quote.extra_data),
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


def _flatten_quote_content_for_ai(content: str) -> str:
    """
    Flatten quote content for use in AI refinement/regeneration.

    - If content is BlockNote JSON (array of blocks), extract human-readable
      text from block content and join them.
    - If content is a flat dict (e.g. legacy key-value), flatten to "key: value" lines.
    - Otherwise return content as-is (markdown/plain/HTML).
    """
    if not content:
        return content

    try:
        parsed = json.loads(content)
    except (TypeError, ValueError):
        return content

    def _walk(node: Any, out: list[str]) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if isinstance(value, str) and key in {"text", "content", "title"}:
                    if value.strip():
                        out.append(value.strip())
                else:
                    _walk(value, out)
        elif isinstance(node, list):
            for item in node:
                _walk(item, out)

    if isinstance(parsed, list):
        # BlockNote document: extract text from blocks
        texts: list[str] = []
        _walk(parsed, texts)
        if texts:
            return "\n\n".join(texts)
        return content

    if isinstance(parsed, dict):
        # Flat dict (legacy): flatten to "key: value" for LLM
        if parsed and all(isinstance(v, str) for v in parsed.values()):
            parts = [f"{k}:\n{v.strip()}" for k, v in parsed.items() if (v or "").strip()]
            if parts:
                return "\n\n".join(parts)
        # Nested JSON: walk for text/content/title
        texts = []
        _walk(parsed, texts)
        if texts:
            return "\n\n".join(texts)

    return content


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
            # Refine with feedback. The quote content may be stored as
            # JSON (e.g., BlockNote document), so we flatten it into a
            # markdown-like string before sending to the LLM.
            original_text = _flatten_quote_content_for_ai(quote.content)
            result = await llm_service.refine_quote(
                original_quote=original_text,
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
            # Refresh structured_content snapshot after regeneration.
            "structured_content": build_structured_content(
                content=result.content,
                breakdown=result.breakdown or [],
                total_hours=float(result.total_hours or quote.total_hours or 0),
            ).model_dump(mode="json"),
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
                prepared_by=_prepared_by(quote.extra_data),
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

    # Verify project access and get project (may update name/description from chat)
    project = await get_project_with_access(project_id, current_user, db)

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

    # Process refinement request (pass project context for project_updates / new_total_hours)
    try:
        refinement_service = get_refinement_service()
        (
            updated_content,
            ai_message,
            changes,
            new_total_hours,
            project_updates,
        ) = await refinement_service.refine_quote_conversational(
            quote=quote,
            user_message=request.message,
            project_name=project.name,
            project_description=project.description,
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

    # Apply new total hours when user asked to change estimation time (e.g. "increase by 20 hrs")
    if new_total_hours is not None:
        quote.total_hours = Decimal(str(new_total_hours))

    # Apply project name/description updates when user asked to change them via chat
    updated_project_response: Optional[RefinedProjectUpdate] = None
    if project_updates:
        if "name" in project_updates and project_updates["name"] is not None:
            project.name = project_updates["name"]
        if "description" in project_updates:
            project.description = project_updates.get("description")
        updated_project_response = RefinedProjectUpdate(
            name=project.name,
            description=project.description,
        )

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
                prepared_by=_prepared_by(quote.extra_data),
                created_at=quote.created_at,
                updated_at=quote.updated_at,
            ),
            ai_message=ai_message,
            changes_applied=changes,
            updated_project=updated_project_response,
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

    # Convert BlockNote JSON to HTML for DOCX; otherwise pass content as-is
    content_for_export = (
        blocknote_json_to_html(quote.content)
        if quote.content and is_blocknote_json(quote.content)
        else (quote.content or "")
    )
    # "Prepared for" uses project name only (client_name removed from system)
    export_data = QuoteExportData(
        title=quote.title,
        client_name=project.name,
        project_name=project.name,
        requirements=quote.requirements,
        content=content_for_export,
        total_hours=quote.total_hours,
        platform=quote.platform,
        complexity=quote.complexity.value,
        created_at=quote.created_at,
        creator_name=quote.creator.full_name if quote.creator else None,
        prepared_by=_prepared_by(quote.extra_data),
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

    from weasyprint import HTML

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

    # "Prepared for" uses project name only (client_name removed from system)
    prepared_for_name = project.name

    # Determine body HTML (ensure str: content is Text but can be None in edge cases)
    raw_content = str(quote.content) if quote.content is not None else ""
    if is_blocknote_json(raw_content):
        body_html = blocknote_json_to_html(raw_content)
    elif is_html_content(raw_content):
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
    prepared_by = _prepared_by(quote.extra_data)

    title_text = quote.title or "Project Estimate"
    # Escape for safe embedding in HTML (avoid broken markup / WeasyPrint errors)
    title_escaped = html_lib.escape(str(title_text))
    prepared_for_escaped = html_lib.escape(str(prepared_for_name or ""))
    prepared_by_escaped = html_lib.escape(str(prepared_by or ""))

    # Build HTML in two parts so body_html is never inside an f-string (user content
    # can contain { or } which would be interpreted as f-string expressions and cause 500).
    html_header = f"""
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Proposal - {title_escaped}</title>
    <style>
      @page {{
        margin: 1in;
        size: A4;
      }}
      * {{
        box-sizing: border-box;
      }}
      body {{
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
        color: #334155;
        font-size: 14px;
        line-height: 1.75;
        margin: 0;
        padding: 0;
      }}

      /* ── Document header: mirrors .doc-header ── */
      .doc-header {{
        text-align: center;
        margin-bottom: 32px;
        padding-bottom: 24px;
        border-bottom: 3px solid #0f172a;
      }}
      .doc-title {{
        font-size: 28px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 16px 0;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }}

      /* ── Metadata row: mirrors .doc-metadata ── */
      .doc-metadata {{
        display: table;
        width: 100%;
        border-collapse: collapse;
      }}
      .doc-metadata-item {{
        display: table-cell;
        text-align: center;
        padding: 0 16px;
        vertical-align: top;
      }}
      .doc-metadata-item + .doc-metadata-item {{
        border-left: 1px solid #e2e8f0;
      }}
      .doc-metadata-label {{
        display: block;
        font-size: 10px;
        font-weight: 500;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 4px;
      }}
      .doc-metadata-value {{
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #0f172a;
      }}

      /* ── Content body: mirrors .doc-editor-preview / inline-editor.css ── */
      .doc-body {{
        padding-top: 16px;
      }}

      /* Headings */
      h1 {{
        font-size: 22px;
        font-weight: 700;
        color: #0f172a;
        margin: 28px 0 14px 0;
        padding-bottom: 10px;
        border-bottom: 2px solid #cbd5e1;
        line-height: 1.3;
      }}
      h1:first-child {{
        margin-top: 0;
      }}
      h2 {{
        font-size: 18px;
        font-weight: 700;
        color: #1e293b;
        margin: 24px 0 10px 0;
        padding-bottom: 8px;
        border-bottom: 2px solid #3b82f6;
        line-height: 1.35;
      }}
      h3 {{
        font-size: 15px;
        font-weight: 600;
        color: #1e293b;
        margin: 18px 0 8px 0;
        padding-left: 10px;
        border-left: 3px solid #60a5fa;
        line-height: 1.4;
      }}
      h4, h5, h6 {{
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
        margin: 14px 0 6px 0;
      }}

      /* Paragraphs */
      p {{
        font-size: 14px;
        line-height: 1.75;
        color: #334155;
        margin: 0 0 12px 0;
      }}

      /* Unordered lists — blue circle bullets matching inline-editor.css */
      ul {{
        list-style: none;
        padding: 0;
        margin: 8px 0 16px 0;
      }}
      ul li {{
        position: relative;
        padding-left: 22px;
        margin: 6px 0;
        font-size: 14px;
        line-height: 1.65;
        color: #334155;
      }}
      ul li::before {{
        content: "";
        position: absolute;
        left: 6px;
        top: 8px;
        width: 6px;
        height: 6px;
        background: #2563eb;
        border-radius: 50%;
      }}
      ul li p {{
        margin: 0;
      }}
      ul li strong {{
        color: #1e293b;
      }}
      /* Nested lists */
      ul ul {{
        margin-top: 4px;
        margin-bottom: 4px;
      }}
      ul ul li::before {{
        background: #60a5fa;
        width: 5px;
        height: 5px;
      }}

      /* Ordered lists */
      ol {{
        list-style-type: decimal;
        padding-left: 26px;
        margin: 8px 0 16px 0;
      }}
      ol li {{
        font-size: 13px;
        line-height: 1.65;
        color: #334155;
      }}
      ol li p {{
        margin: 0;
      }}

      /* Inline formatting */
      strong, b {{
        font-weight: 600;
        color: #0f172a;
      }}
      em, i {{
        font-style: italic;
      }}
      u {{
        text-decoration: underline;
      }}
      s, del {{
        text-decoration: line-through;
        color: #64748b;
      }}
      code {{
        background-color: #f1f5f9;
        padding: 2px 5px;
        border-radius: 3px;
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
        font-size: 12px;
        color: #0f172a;
      }}
      pre {{
        background-color: #0f172a;
        color: #e2e8f0;
        padding: 14px 16px;
        border-radius: 6px;
        overflow-x: auto;
        margin: 14px 0;
        font-size: 12px;
        line-height: 1.5;
      }}
      pre code {{
        background: none;
        padding: 0;
        border-radius: 0;
        color: inherit;
      }}

      /* Blockquote */
      blockquote {{
        margin: 14px 0;
        padding: 10px 18px;
        border-left: 4px solid #60a5fa;
        background: #f8fafc;
        color: #475569;
        font-style: italic;
      }}
      blockquote p {{
        margin-bottom: 6px;
      }}
      blockquote p:last-child {{
        margin-bottom: 0;
      }}

      /* Tables */
      table {{
        border-collapse: collapse;
        width: 100%;
        margin: 14px 0 20px 0;
      }}
      th, td {{
        border: 1px solid #e2e8f0;
        padding: 8px 12px;
        text-align: left;
        font-size: 13px;
      }}
      th {{
        background-color: #f8fafc;
        font-weight: 600;
        color: #0f172a;
      }}
      tr:nth-child(even) td {{
        background-color: #f8fafc;
      }}

      /* Horizontal rule */
      hr {{
        border: none;
        height: 1px;
        background: #e2e8f0;
        margin: 20px 0;
      }}

      /* Links */
      a {{
        color: #2563eb;
        text-decoration: underline;
      }}
    </style>
  </head>
  <body>
    <div class="doc-header">
      <h1 class="doc-title">Proposal for {prepared_for_escaped}</h1>
      <div class="doc-metadata">
        <div class="doc-metadata-item">
          <span class="doc-metadata-label">Prepared for</span>
          <span class="doc-metadata-value">{prepared_for_escaped}</span>
        </div>
        <div class="doc-metadata-item">
          <span class="doc-metadata-label">Date</span>
          <span class="doc-metadata-value">{created_str}</span>
        </div>
        <div class="doc-metadata-item">
          <span class="doc-metadata-label">Prepared by</span>
          <span class="doc-metadata-value">{prepared_by_escaped}</span>
        </div>
      </div>
    </div>

    <div class="doc-body">
"""
    html_string = (html_header.strip() + "\n" + body_html + "\n    </div>\n  </body>\n</html>")

    try:
        pdf_bytes = HTML(string=html_string).write_pdf()
    except Exception as e:
        logger.error("Failed to generate PDF document: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "PDF_GENERATION_FAILED",
                "message": f"Failed to generate PDF document: {str(e)}",
            },
        )

    # Safe filename from title (quote.title can be None in edge cases)
    title_for_filename = (quote.title or "Project Estimate")[:50]
    safe_title = "".join(
        c if c.isalnum() or c in (" ", "-", "_") else "_"
        for c in title_for_filename
    ).strip() or "Proposal"
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


# =============================================================================
# WebSocket Endpoint for Quote Realtime Updates
# =============================================================================


@router.websocket("/ws/quotes/{quote_id}")
async def websocket_quote_updates(
    websocket: WebSocket,
    quote_id: UUID,
    token: str = Query(..., description="Bearer access token for authentication"),
) -> None:
    """
    WebSocket endpoint for real-time quote updates.

    This endpoint is **server-push only** for now:
    - Clients connect with a JWT access token.
    - The server broadcasts full quote snapshots whenever a quote changes
      (generate, refine, edit, status change, delete).

    Message types (server -> client):
    - quote.sync: Initial snapshot when connection is established
    - quote.updated: Quote content/metadata changed
    - quote.status_changed: Quote status changed
    - quote.deleted: Quote has been deleted
    """
    from app.core.database import get_session_factory
    from app.core.security import verify_access_token
    from app.models.project import Project
    from app.models.user import User
    from app.schemas.quote import QuoteDetailResponse

    # Authenticate token
    try:
        payload = verify_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Verify user and access to quote, and fetch initial snapshot
    session_factory = get_session_factory()
    async with session_factory() as db:
        user = await db.get(User, UUID(user_id))
        if not user or not user.is_active:
            await websocket.close(code=4001, reason="User not found")
            return

        # Load quote with project for header/project name
        result = await db.execute(
            select(Quote)
            .options(selectinload(Quote.project))
            .where(Quote.id == quote_id)
        )
        quote = result.scalar_one_or_none()
        if not quote:
            await websocket.close(code=4004, reason="Quote not found")
            return

        # Basic access control: owner or admin only
        if quote.created_by != user.id and not user.is_admin:
            await websocket.close(code=4003, reason="Access denied")
            return

        # Ensure project still exists (defensive)
        project = await db.get(Project, quote.project_id)
        if not project:
            await websocket.close(code=4004, reason="Project not found")
            return

        # Build initial detail snapshot (matches GET /quotes/{id})
        detail = QuoteDetailResponse(
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
            prepared_by=_prepared_by(quote.extra_data),
            created_at=quote.created_at,
            updated_at=quote.updated_at,
            project_name=quote.project.name if quote.project else None,
            creator_name=None,
            approver_name=None,
        )

    quote_id_str = str(quote_id)

    # Register connection
    await quote_ws_manager.connect(websocket, quote_id_str)

    # Send initial sync payload
    await websocket.send_json(
        {
            "type": "quote.sync",
            "quote_id": quote_id_str,
            "project_id": str(detail.project_id),
            "payload": detail.model_dump(mode="json"),
        }
    )

    try:
        # Keep the connection open; we currently ignore any client-sent messages.
        while True:
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
    finally:
        quote_ws_manager.disconnect(websocket, quote_id_str)


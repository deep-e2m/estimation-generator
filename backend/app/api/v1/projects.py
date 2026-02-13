"""
Project API endpoints.

This module provides endpoints for project management including
CRUD operations and listing with pagination.
"""

import logging
from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.dependencies import ActiveUser, DbSession, api_error, get_project_with_access
from app.models.client import Client
from app.models.project import Platform, Project, ProjectStatus
from app.models.quote import Quote
from app.schemas.project import (
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
)

logger = logging.getLogger(__name__)

router = APIRouter()


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

    new_project = Project(
        name=project_data.name,
        description=project_data.description,
        additional_instructions=project_data.additional_instructions,
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

    # Build base query with eager loads for client
    base_query = (
        select(Project)
        .options(selectinload(Project.client))
        .where(Project.created_by == current_user.id)
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

    project = await get_project_with_access(project_id, current_user, db)

    # Get quote count
    quote_count_query = select(func.count()).where(Quote.project_id == project.id)
    quote_count_result = await db.execute(quote_count_query)
    quote_count = quote_count_result.scalar() or 0

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
        platform=project.platform,
        status=project.status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        quotes_count=quote_count,
        client=project.client,
        owner=owner,
        team_members=[],
        target_completion_date=None,
        requirements_count=0,
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

    project = await get_project_with_access(project_id, current_user, db)

    update_data = project_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)

    logger.info("Project updated: id=%s", project.id)

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

    project = await get_project_with_access(project_id, current_user, db)
    project_name = project.name

    await db.delete(project)
    await db.commit()

    logger.info("Project deleted: id=%s, name=%s", project_id, project_name)

    return ProjectDeleteResponse(
        success=True,
        data={"message": f"Project '{project_name}' deleted successfully"},
    )

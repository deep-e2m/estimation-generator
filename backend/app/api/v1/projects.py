"""
Project API endpoints.

This module provides endpoints for project management including
CRUD operations and listing with pagination.
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.dependencies import ActiveUser, DbSession
from app.models.project import Platform, Project, ProjectStatus
from app.models.quote import Quote
from app.schemas.project import (
    CursorPaginationMeta,
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
    """
    Create a new project.

    Args:
        project_data: Project creation data.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        ProjectDataResponse: The created project.
    """
    logger.info("Creating project: name=%s, user=%s", project_data.name, current_user.email)

    # Create new project
    new_project = Project(
        name=project_data.name,
        description=project_data.description,
        platform=project_data.platform,
        status=ProjectStatus.ACTIVE,
        created_by=current_user.id,
    )

    db.add(new_project)
    await db.commit()
    await db.refresh(new_project)

    logger.info("Project created: id=%s, name=%s", new_project.id, new_project.name)

    return ProjectDataResponse(
        success=True,
        data=ProjectResponse(
            id=new_project.id,
            name=new_project.name,
            description=new_project.description,
            platform=new_project.platform,
            status=new_project.status,
            created_at=new_project.created_at,
            updated_at=new_project.updated_at,
            quotes_count=0,
            client_name=None,
            client_email=None,
        ),
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
    cursor: Optional[str] = Query(default=None, description="Cursor for pagination"),
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
    """
    List projects for the current user with cursor-based pagination.

    Args:
        current_user: The authenticated user.
        db: Database session.
        cursor: Cursor for pagination (project ID to start after).
        limit: Number of items per page.
        status_filter: Optional status filter.
        platform_filter: Optional platform filter.
        search: Optional search term for project name.

    Returns:
        ProjectListResponse: Paginated list of projects.
    """
    logger.debug(
        "Listing projects: user=%s, cursor=%s, limit=%d",
        current_user.email,
        cursor,
        limit,
    )

    # Build base query
    base_query = select(Project).where(Project.created_by == current_user.id)

    # Apply filters
    if status_filter:
        base_query = base_query.where(Project.status == status_filter)
    if platform_filter:
        base_query = base_query.where(Project.platform == platform_filter)
    if search:
        base_query = base_query.where(Project.name.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total_count = total_result.scalar() or 0

    # Apply cursor-based pagination
    # Order by updated_at desc (nulls first), then created_at desc
    paginated_query = base_query.order_by(
        Project.updated_at.desc().nullsfirst(),
        Project.created_at.desc()
    )

    # If cursor is provided, filter to items after the cursor
    # Cursor is the last project ID from the previous page
    if cursor:
        try:
            from uuid import UUID as UUIDType
            cursor_uuid = UUIDType(cursor)
            # Get the cursor project to find its position
            cursor_project_query = select(Project).where(Project.id == cursor_uuid)
            cursor_result = await db.execute(cursor_project_query)
            cursor_project = cursor_result.scalar_one_or_none()
            if cursor_project:
                # Filter to projects that come after the cursor in sort order
                paginated_query = paginated_query.where(
                    (Project.updated_at < cursor_project.updated_at) |
                    ((Project.updated_at == cursor_project.updated_at) &
                     (Project.created_at < cursor_project.created_at)) |
                    ((Project.updated_at == cursor_project.updated_at) &
                     (Project.created_at == cursor_project.created_at) &
                     (Project.id < cursor_project.id))
                )
        except (ValueError, TypeError):
            # Invalid cursor, ignore it
            pass

    # Fetch one extra to determine if there are more
    paginated_query = paginated_query.limit(limit + 1)

    result = await db.execute(paginated_query)
    projects = list(result.scalars().all())

    # Check if there are more items
    has_more = len(projects) > limit
    if has_more:
        projects = projects[:limit]  # Remove the extra item

    # Determine next cursor
    next_cursor = str(projects[-1].id) if has_more and projects else None

    # Get quote counts for each project
    project_responses = []
    for project in projects:
        # Get quote count
        quote_count_query = select(func.count()).where(Quote.project_id == project.id)
        quote_count_result = await db.execute(quote_count_query)
        quote_count = quote_count_result.scalar() or 0

        project_responses.append(
            ProjectResponse(
                id=project.id,
                name=project.name,
                description=project.description,
                platform=project.platform,
                status=project.status,
                created_at=project.created_at,
                updated_at=project.updated_at,
                quotes_count=quote_count,
                client_name=None,  # TODO: Add client fields to Project model if needed
                client_email=None,
            )
        )

    pagination = CursorPaginationMeta(
        cursor=next_cursor,
        has_more=has_more,
        total_count=total_count,
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
    """
    Get project details by ID.

    Args:
        project_id: The project UUID.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        ProjectDetailDataResponse: The project details.

    Raises:
        HTTPException: If project not found or access denied.
    """
    logger.debug("Getting project: id=%s, user=%s", project_id, current_user.email)

    # Fetch project with creator
    query = (
        select(Project)
        .options(selectinload(Project.creator))
        .where(Project.id == project_id)
    )
    result = await db.execute(query)
    project = result.scalar_one_or_none()

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "PROJECT_NOT_FOUND",
                "message": "Project not found",
            },
        )

    # Check access - user must be creator or admin
    if project.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ACCESS_DENIED",
                "message": "You don't have access to this project",
            },
        )

    # Get quote count
    quote_count_query = select(func.count()).where(Quote.project_id == project.id)
    quote_count_result = await db.execute(quote_count_query)
    quote_count = quote_count_result.scalar() or 0

    # Build owner object from creator
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

    return ProjectDetailDataResponse(
        success=True,
        data=ProjectDetailResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            platform=project.platform,
            status=project.status,
            created_at=project.created_at,
            updated_at=project.updated_at,
            quotes_count=quote_count,
            client_name=None,  # TODO: Add client fields to Project model if needed
            client_email=None,
            owner=owner,
            team_members=[],  # TODO: Implement team members if needed
            target_completion_date=None,
            requirements_count=0,
        ),
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
    """
    Update an existing project.

    Args:
        project_id: The project UUID.
        project_data: Project update data.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        ProjectDataResponse: The updated project.

    Raises:
        HTTPException: If project not found or access denied.
    """
    logger.info("Updating project: id=%s, user=%s", project_id, current_user.email)

    # Fetch project
    query = select(Project).where(Project.id == project_id)
    result = await db.execute(query)
    project = result.scalar_one_or_none()

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "PROJECT_NOT_FOUND",
                "message": "Project not found",
            },
        )

    # Check access
    if project.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ACCESS_DENIED",
                "message": "You don't have permission to update this project",
            },
        )

    # Update fields
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

    return ProjectDataResponse(
        success=True,
        data=ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            platform=project.platform,
            status=project.status,
            created_at=project.created_at,
            updated_at=project.updated_at,
            quotes_count=quote_count,
            client_name=None,
            client_email=None,
        ),
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
    """
    Delete a project and all associated data.

    This operation cascades to delete all quotes and chat messages
    associated with the project.

    Args:
        project_id: The project UUID.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        ProjectDeleteResponse: Deletion confirmation.

    Raises:
        HTTPException: If project not found or access denied.
    """
    logger.info("Deleting project: id=%s, user=%s", project_id, current_user.email)

    # Fetch project
    query = select(Project).where(Project.id == project_id)
    result = await db.execute(query)
    project = result.scalar_one_or_none()

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "PROJECT_NOT_FOUND",
                "message": "Project not found",
            },
        )

    # Check access
    if project.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ACCESS_DENIED",
                "message": "You don't have permission to delete this project",
            },
        )

    project_name = project.name

    # Delete project (cascade will handle quotes and messages)
    await db.delete(project)
    await db.commit()

    logger.info("Project deleted: id=%s, name=%s", project_id, project_name)

    return ProjectDeleteResponse(
        success=True,
        data={"message": f"Project '{project_name}' deleted successfully"},
    )

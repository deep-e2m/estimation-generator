"""
Dashboard API endpoints.

Provides aggregate stats for the dashboard (project count, quote count,
total hours estimated) so the UI reflects DB state and stays correct
when projects or quotes are deleted.
"""

import logging
from decimal import Decimal

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.api.dependencies import ActiveUser, DbSession
from app.models.project import Project, ProjectStatus
from app.models.quote import Quote, QuoteStatus
from app.schemas.auth import APIResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


class DashboardStatsData(BaseModel):
    """Aggregate stats for dashboard cards."""

    total_projects: int = Field(..., description="Total number of projects")
    total_quotes: int = Field(..., description="Total number of quotes")
    total_hours_estimated: float = Field(..., description="Sum of estimated hours across all quotes")
    active_projects: int = Field(..., description="Number of projects with status active")
    pending_quotes: int = Field(..., description="Number of quotes in draft (pending)")


class DashboardStatsResponse(APIResponse):
    """Response schema for dashboard stats."""

    data: DashboardStatsData = Field(..., description="Dashboard statistics")


@router.get(
    "/stats",
    response_model=DashboardStatsResponse,
    summary="Get dashboard stats",
    description="Returns aggregate counts and total hours from the database. Use this for dashboard cards so stats stay correct when projects or quotes are deleted.",
    responses={
        200: {"description": "Stats retrieved successfully"},
        401: {"description": "Not authenticated"},
    },
)
async def get_dashboard_stats(
    current_user: ActiveUser,
    db: DbSession,
) -> DashboardStatsResponse:
    """Return total projects, total quotes, and sum of quote hours for the current user."""
    user_id = current_user.id

    # Total projects
    projects_count_q = select(func.count()).select_from(Project).where(Project.created_by == user_id)
    projects_result = await db.execute(projects_count_q)
    total_projects = projects_result.scalar() or 0

    # Active projects
    active_count_q = select(func.count()).select_from(Project).where(
        Project.created_by == user_id,
        Project.status == ProjectStatus.ACTIVE,
    )
    active_result = await db.execute(active_count_q)
    active_projects = active_result.scalar() or 0

    # Total quotes and total hours (quotes are owned by user via created_by)
    quotes_count_q = select(func.count()).select_from(Quote).where(Quote.created_by == user_id)
    quotes_result = await db.execute(quotes_count_q)
    total_quotes = quotes_result.scalar() or 0

    hours_q = select(func.coalesce(func.sum(Quote.total_hours), Decimal("0"))).where(
        Quote.created_by == user_id
    )
    hours_result = await db.execute(hours_q)
    total_hours_value = hours_result.scalar()
    if total_hours_value is None:
        total_hours_value = Decimal("0")
    total_hours_estimated = float(total_hours_value)

    # Pending quotes (draft only; "generating" is a transient frontend state)
    pending_q = select(func.count()).select_from(Quote).where(
        Quote.created_by == user_id,
        Quote.status == QuoteStatus.DRAFT,
    )
    pending_result = await db.execute(pending_q)
    pending_quotes = pending_result.scalar() or 0

    return DashboardStatsResponse(
        success=True,
        data=DashboardStatsData(
            total_projects=total_projects,
            total_quotes=total_quotes,
            total_hours_estimated=total_hours_estimated,
            active_projects=active_projects,
            pending_quotes=pending_quotes,
        ),
    )

"""
Utility API endpoints.

Provides helpers such as placeholder avatar URL (LLM-based gender classification).
"""

from fastapi import APIRouter, Query

from app.api.dependencies import ActiveUser
from app.services.avatar_placeholder import get_placeholder_avatar_url

router = APIRouter()


@router.get(
    "/placeholder-avatar",
    summary="Get placeholder avatar URL by name",
    description=(
        "Returns a placeholder avatar URL for the given full name. "
        "Uses a low-cost LLM to classify first name as male/female (cached per name). "
        "Requires authentication."
    ),
)
async def placeholder_avatar(
    _user: ActiveUser,
    full_name: str = Query(..., min_length=1, max_length=200, description="Full name (e.g. Sarah Chen)"),
) -> dict:
    url = await get_placeholder_avatar_url(full_name)
    return {"url": url}

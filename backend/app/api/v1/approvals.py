"""
Approval workflow API endpoints.

This module provides endpoints for sending project estimations for approval
and for Superior PMs to approve or disapprove.
"""

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import (
    get_project_with_access,
    ActiveUser,
    DbSession,
    PmOrAbove,
    SuperPmOnly,
    api_error,
    get_project_with_permission,
)
from app.models.project_share import AccessLevel
from app.models.approval_request import ApprovalRequest, ApprovalStatus
from app.models.user import User, UserRole
from app.models.audit_log import ActionOutcome
from app.schemas.approval_request import (
    ApprovalDecision,
    ApprovalRequestCreateBulk,
    ApprovalRequestResponse,
)
from app.schemas.auth import UserResponse
from app.services import audit

logger = logging.getLogger(__name__)

router = APIRouter()


def _approval_request_to_response(
    request: ApprovalRequest,
    project_name: str | None,
    requester_user: User,
    assignee_user: User,
) -> dict:
    """Build approval request payload for API response.

    Never build ApprovalRequestResponse from the ORM request alone — requested_by
    and assigned_to must be full User objects (e.g. from explicit select).
    Returns the serialized approval request dict; caller wraps with success/data.
    """
    response_data = ApprovalRequestResponse(
        id=request.id,
        project_id=request.project_id,
        project_name=project_name,
        requested_by=UserResponse.model_validate(requester_user),
        assigned_to=UserResponse.model_validate(assignee_user),
        status=request.status,
        disapproval_reason=request.disapproval_reason,
        created_at=request.created_at,
        updated_at=request.updated_at,
        responded_at=request.responded_at,
    )
    return response_data.model_dump()


async def _ensure_one_pending_per_assignee(
    db: AsyncSession, project_id: UUID, assignee_ids: list[UUID]
) -> set[UUID]:
    """Return set of assignee IDs that already have a pending request for this project."""
    from sqlalchemy import and_

    result = await db.execute(
        select(ApprovalRequest.assigned_to).where(
            and_(
                ApprovalRequest.project_id == project_id,
                ApprovalRequest.status == ApprovalStatus.PENDING,
                ApprovalRequest.assigned_to.in_(assignee_ids),
            )
        )
    )
    return {row[0] for row in result.all()}


@router.post(
    "/projects/{project_id}/approval-requests",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Send project for approval (single or bulk)",
    description="Create one or more approval requests. At most one pending per (project, assignee). Requires edit_full.",
    responses={
        201: {"description": "Approval request(s) created"},
        400: {"description": "Assigned user not Super PM or already has pending request"},
        403: {"description": "Not owner, admin, or edit_full access"},
        404: {"description": "Project or user not found"},
    },
)
async def create_approval_request(
    project_id: UUID,
    body: ApprovalRequestCreateBulk,
    current_user: PmOrAbove,
    db: DbSession,
) -> dict:
    project, _ = await get_project_with_permission(project_id, current_user, db, AccessLevel.EDIT_FULL)

    assignee_ids = list(dict.fromkeys(body.assigned_to))  # preserve order, dedupe

    if not assignee_ids:
        raise api_error(400, "NO_ASSIGNEES", "At least one assignee is required")

    # Load all assignees; must be active Super PMs
    users_result = await db.execute(
        select(User).where(
            User.id.in_(assignee_ids),
            User.is_active == True,  # noqa: E712
        )
    )
    users_by_id = {u.id: u for u in users_result.scalars().all()}
    for uid in assignee_ids:
        u = users_by_id.get(uid)
        if not u:
            raise api_error(404, "USER_NOT_FOUND", f"User not found: {uid}")
        if u.role != UserRole.SUPER_PM:
            raise api_error(
                400,
                "NOT_SUPER_PM",
                "Approval can only be assigned to a Superior PM",
            )

    # At most one pending per (project_id, assigned_to): skip assignees who already have pending
    already_pending = await _ensure_one_pending_per_assignee(db, project_id, assignee_ids)
    to_create = [uid for uid in assignee_ids if uid not in already_pending]

    if not to_create:
        raise api_error(
            400,
            "PENDING_FOR_THIS_PM",
            "All selected Superior PMs already have a pending request for this project",
        )

    created: list[ApprovalRequest] = []
    for assigned_to_id in to_create:
        request = ApprovalRequest(
            project_id=project_id,
            requested_by=current_user.id,
            assigned_to=assigned_to_id,
            status=ApprovalStatus.PENDING,
        )
        db.add(request)
        created.append(request)

    await db.commit()
    for req in created:
        await db.refresh(req)

    # Build response list (same shape for single or bulk)
    users_result2 = await db.execute(select(User).where(User.id.in_(to_create)))
    assignees_by_id = {u.id: u for u in users_result2.scalars().all()}
    data_list = [
        _approval_request_to_response(r, project.name, current_user, assignees_by_id[r.assigned_to])
        for r in created
    ]

    for req in created:
        try:
            await audit.log_action(
                db=db,
                actor_user_id=current_user.id,
                actor_role=current_user.role.value,
                action="approval.requested",
                outcome=ActionOutcome.SUCCESS,
                resource_type="approval",
                resource_id=req.id,
                project_id=project_id,
                metadata=audit.with_admin_bypass(
                    {"assigned_to": str(req.assigned_to), "quote_id": None},
                    project,
                    current_user,
                ),
            )
        except Exception as e:
            logger.error("Failed to log audit for approval request: %s", e)

    return {"success": True, "data": data_list}


@router.get(
    "/projects/{project_id}/approval-requests",
    response_model=dict,
    summary="List approval requests by project",
    description="List all approval requests for a project. Requires project access (read).",
    responses={
        200: {"description": "List of approval requests for the project"},
        403: {"description": "No access to project"},
        404: {"description": "Project not found"},
    },
)
async def list_approval_requests_by_project(
    project_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
) -> dict:
    await get_project_with_access(project_id, current_user, db)

    query = (
        select(ApprovalRequest)
        .options(selectinload(ApprovalRequest.project))
        .where(ApprovalRequest.project_id == project_id)
        .order_by(ApprovalRequest.created_at.desc())
    )
    result = await db.execute(query)
    requests = list(result.scalars().all())

    user_ids = {ar.requested_by for ar in requests} | {ar.assigned_to for ar in requests}
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_by_id = {u.id: u for u in users_result.scalars().all()}

    items = [
        _approval_request_to_response(
            ar,
            ar.project.name if ar.project else None,
            users_by_id[ar.requested_by],
            users_by_id[ar.assigned_to],
        )
        for ar in requests
    ]
    return {"success": True, "data": items}


@router.get(
    "/approval-requests",
    response_model=dict,
    summary="List approval requests (assigned to me)",
    description="List approval requests assigned to the current Super PM.",
    responses={
        200: {"description": "List of approval requests"},
        403: {"description": "Super PM required"},
    },
)
async def list_approval_requests(
    current_user: SuperPmOnly,
    db: DbSession,
    status_filter: ApprovalStatus | None = Query(default=None, description="Filter by status"),
) -> dict:
    query = (
        select(ApprovalRequest)
        .options(selectinload(ApprovalRequest.project))
        .where(ApprovalRequest.assigned_to == current_user.id)
        .order_by(ApprovalRequest.created_at.desc())
    )
    if status_filter:
        query = query.where(ApprovalRequest.status == status_filter)

    result = await db.execute(query)
    requests = list(result.scalars().all())

    # Load requester/assignee users by ID so we don't rely on ORM relationships in async
    user_ids = {ar.requested_by for ar in requests} | {ar.assigned_to for ar in requests}
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_by_id = {u.id: u for u in users_result.scalars().all()}

    items = [
        _approval_request_to_response(
            ar,
            ar.project.name if ar.project else None,
            users_by_id[ar.requested_by],
            users_by_id[ar.assigned_to],
        )
        for ar in requests
    ]
    return {"success": True, "data": items}


@router.get(
    "/approval-requests/{request_id}",
    response_model=dict,
    summary="Get approval request",
    description="Get a single approval request. Accessible by requester, assignee, or any user with project access (read-only).",
    responses={
        200: {"description": "Approval request"},
        403: {"description": "Access denied"},
        404: {"description": "Request not found"},
    },
)
async def get_approval_request(
    request_id: UUID,
    current_user: ActiveUser,
    db: DbSession,
) -> dict:
    result = await db.execute(
        select(ApprovalRequest)
        .options(selectinload(ApprovalRequest.project))
        .where(ApprovalRequest.id == request_id)
    )
    ar = result.scalar_one_or_none()
    if not ar:
        raise api_error(404, "APPROVAL_REQUEST_NOT_FOUND", "Approval request not found")

    # Allow: requester, assignee, or any user with project access (read-only for shared users)
    if ar.requested_by != current_user.id and ar.assigned_to != current_user.id:
        try:
            await get_project_with_access(ar.project_id, current_user, db)
        except Exception:
            raise api_error(403, "ACCESS_DENIED", "You don't have access to this approval request")

    # Load requester/assignee by ID so we don't rely on ORM relationships in async
    users_result = await db.execute(
        select(User).where(User.id.in_([ar.requested_by, ar.assigned_to]))
    )
    users_by_id = {u.id: u for u in users_result.scalars().all()}
    requester_user = users_by_id.get(ar.requested_by)
    assignee_user = users_by_id.get(ar.assigned_to)
    if not requester_user or not assignee_user:
        raise api_error(404, "USER_NOT_FOUND", "Requester or assignee user not found")

    return {
        "success": True,
        "data": _approval_request_to_response(
            ar,
            ar.project.name if ar.project else None,
            requester_user,
            assignee_user,
        ),
    }


@router.post(
    "/approval-requests/{request_id}/decide",
    response_model=dict,
    summary="Approve or disapprove",
    description="Approve or disapprove an approval request. Assigned Super PM only. Disapproval requires a reason.",
    responses={
        200: {"description": "Decision recorded"},
        400: {"description": "Reason required for disapprove or request not pending"},
        403: {"description": "Assigned Super PM required"},
        404: {"description": "Request not found"},
    },
)
async def decide_approval(
    request_id: UUID,
    body: ApprovalDecision,
    current_user: SuperPmOnly,
    db: DbSession,
) -> dict:

    result = await db.execute(
        select(ApprovalRequest)
        .options(selectinload(ApprovalRequest.project))
        .where(ApprovalRequest.id == request_id)
    )
    ar = result.scalar_one_or_none()
    if not ar:
        raise api_error(404, "APPROVAL_REQUEST_NOT_FOUND", "Approval request not found")

    if ar.assigned_to != current_user.id:
        raise api_error(403, "ACCESS_DENIED", "Only the assigned Superior PM can respond to this request")

    if ar.status != ApprovalStatus.PENDING:
        raise api_error(400, "ALREADY_RESPONDED", "This approval request has already been responded to")

    now = datetime.now(timezone.utc)
    ar.responded_at = now
    if body.approved:
        ar.status = ApprovalStatus.APPROVED
        ar.disapproval_reason = None
    else:
        ar.status = ApprovalStatus.DISAPPROVED
        ar.disapproval_reason = (body.reason or "").strip() or None

    await db.commit()
    await db.refresh(ar)

    # Audit log: approval decision
    action_code = "approval.approved" if body.approved else "approval.disapproved"
    audit_metadata = {
        "quote_id": None,  # Optional if quote is known
        "project_id": str(ar.project_id),
    }
    if not body.approved and ar.disapproval_reason:
        audit_metadata["reason"] = ar.disapproval_reason

    try:
        await audit.log_action(
            db=db,
            actor_user_id=current_user.id,
            actor_role=current_user.role.value,
            action=action_code,
            outcome=ActionOutcome.SUCCESS,
            resource_type="approval",
            resource_id=ar.id,
            project_id=ar.project_id,
            metadata=audit_metadata,
        )
    except Exception as e:
        logger.error("Failed to log audit for approval decision: %s", e)

    # Load requester/assignee by ID so we don't rely on ORM relationships after refresh
    users_result = await db.execute(
        select(User).where(User.id.in_([ar.requested_by, ar.assigned_to]))
    )
    users_by_id = {u.id: u for u in users_result.scalars().all()}
    requester_user = users_by_id.get(ar.requested_by)
    assignee_user = users_by_id.get(ar.assigned_to)
    if not requester_user or not assignee_user:
        raise api_error(404, "USER_NOT_FOUND", "Requester or assignee user not found")

    return {
        "success": True,
        "data": _approval_request_to_response(
            ar,
            ar.project.name if ar.project else None,
            requester_user,
            assignee_user,
        ),
    }

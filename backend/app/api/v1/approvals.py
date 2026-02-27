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
    ActiveUser,
    DbSession,
    PmOrAbove,
    SuperPmOnly,
    api_error,
    get_project_with_owner_or_admin,
)
from app.models.approval_request import ApprovalRequest, ApprovalStatus
from app.models.user import UserRole
from app.models.audit_log import ActionOutcome
from app.schemas.approval_request import (
    ApprovalDecision,
    ApprovalRequestCreate,
    ApprovalRequestResponse,
)
from app.schemas.auth import UserResponse
from app.services import audit

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/projects/{project_id}/approval-requests",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Send project for approval",
    description="Create an approval request and assign it to a Superior PM. PM (owner) or admin only.",
    responses={
        201: {"description": "Approval request created"},
        400: {"description": "Assigned user is not a Superior PM or already has pending request"},
        403: {"description": "Not owner or admin"},
        404: {"description": "Project or user not found"},
    },
)
async def create_approval_request(
    project_id: UUID,
    body: ApprovalRequestCreate,
    current_user: PmOrAbove,
    db: DbSession,
) -> dict:
    await get_project_with_owner_or_admin(project_id, current_user, db)

    from app.models.user import User

    assignee_result = await db.execute(
        select(User).where(
            User.id == body.assigned_to,
            User.is_active == True,  # noqa: E712
        )
    )
    assignee = assignee_result.scalar_one_or_none()
    if not assignee:
        raise api_error(404, "USER_NOT_FOUND", "User not found")
    if assignee.role != UserRole.SUPER_PM:
        raise api_error(
            400,
            "NOT_SUPER_PM",
            "Approval can only be assigned to a Superior PM",
        )

    pending_result = await db.execute(
        select(ApprovalRequest).where(
            ApprovalRequest.project_id == project_id,
            ApprovalRequest.status == ApprovalStatus.PENDING,
        )
    )
    if pending_result.scalar_one_or_none():
        raise api_error(
            400,
            "PENDING_APPROVAL_EXISTS",
            "This project already has a pending approval request",
        )

    request = ApprovalRequest(
        project_id=project_id,
        requested_by=current_user.id,
        assigned_to=body.assigned_to,
        status=ApprovalStatus.PENDING,
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    await db.refresh(request.requester)
    await db.refresh(request.assignee)

    # Audit log: approval requested
    try:
        await audit.log_action(
            db=db,
            actor_user_id=current_user.id,
            actor_role=current_user.role.value,
            action="approval.requested",
            outcome=ActionOutcome.SUCCESS,
            resource_type="approval",
            resource_id=request.id,
            project_id=project_id,
            metadata={
                "assigned_to": str(body.assigned_to),
                "quote_id": None,  # Optional if quote is known
            },
        )
    except Exception as e:
        logger.error("Failed to log audit for approval request: %s", e)

    response_data = ApprovalRequestResponse(
        id=request.id,
        project_id=request.project_id,
        requested_by=UserResponse.model_validate(request.requester),
        assigned_to=UserResponse.model_validate(request.assignee),
        status=request.status,
        disapproval_reason=request.disapproval_reason,
        created_at=request.created_at,
        updated_at=request.updated_at,
        responded_at=request.responded_at,
    )
    return {"success": True, "data": response_data.model_dump()}


@router.get(
    "/approval-requests",
    response_model=dict,
    summary="List approval requests",
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
        .options(
            selectinload(ApprovalRequest.requester),
            selectinload(ApprovalRequest.assignee),
            selectinload(ApprovalRequest.project),
        )
        .where(ApprovalRequest.assigned_to == current_user.id)
        .order_by(ApprovalRequest.created_at.desc())
    )
    if status_filter:
        query = query.where(ApprovalRequest.status == status_filter)

    result = await db.execute(query)
    requests = list(result.scalars().all())

    items = [
        ApprovalRequestResponse(
            id=ar.id,
            project_id=ar.project_id,
            requested_by=UserResponse.model_validate(ar.requester),
            assigned_to=UserResponse.model_validate(ar.assignee),
            status=ar.status,
            disapproval_reason=ar.disapproval_reason,
            created_at=ar.created_at,
            updated_at=ar.updated_at,
            responded_at=ar.responded_at,
        )
        for ar in requests
    ]
    return {"success": True, "data": items}


@router.get(
    "/approval-requests/{request_id}",
    response_model=dict,
    summary="Get approval request",
    description="Get a single approval request. Requester or assignee (Super PM) only.",
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
        .options(
            selectinload(ApprovalRequest.requester),
            selectinload(ApprovalRequest.assignee),
            selectinload(ApprovalRequest.project),
        )
        .where(ApprovalRequest.id == request_id)
    )
    ar = result.scalar_one_or_none()
    if not ar:
        raise api_error(404, "APPROVAL_REQUEST_NOT_FOUND", "Approval request not found")

    if ar.requested_by != current_user.id and ar.assigned_to != current_user.id:
        raise api_error(403, "ACCESS_DENIED", "You don't have access to this approval request")

    response_data = ApprovalRequestResponse(
        id=ar.id,
        project_id=ar.project_id,
        requested_by=UserResponse.model_validate(ar.requester),
        assigned_to=UserResponse.model_validate(ar.assignee),
        status=ar.status,
        disapproval_reason=ar.disapproval_reason,
        created_at=ar.created_at,
        updated_at=ar.updated_at,
        responded_at=ar.responded_at,
    )
    return {"success": True, "data": response_data.model_dump()}


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
        .options(
            selectinload(ApprovalRequest.requester),
            selectinload(ApprovalRequest.assignee),
            selectinload(ApprovalRequest.project),
        )
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

    response_data = ApprovalRequestResponse(
        id=ar.id,
        project_id=ar.project_id,
        requested_by=UserResponse.model_validate(ar.requester),
        assigned_to=UserResponse.model_validate(ar.assignee),
        status=ar.status,
        disapproval_reason=ar.disapproval_reason,
        created_at=ar.created_at,
        updated_at=ar.updated_at,
        responded_at=ar.responded_at,
    )
    return {"success": True, "data": response_data.model_dump()}

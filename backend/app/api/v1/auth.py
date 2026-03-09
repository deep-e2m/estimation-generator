"""
Authentication API endpoints.

This module provides endpoints for user registration, login,
logout, token refresh, and user profile management.
"""

import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import ActiveUser, DbSession
from app.core.database import get_db_session
from app.core.security import (
    TokenValidationError,
    create_token_pair,
    hash_password,
    verify_password,
    verify_refresh_token,
)
from app.models.user import User, UserRole
from app.models.audit_log import ActionOutcome
from app.services import audit

# Map string role from registration to enum (only non-admin roles allowed)
REGISTER_ROLE_MAP = {
    "pm": UserRole.PM,
    "super_pm": UserRole.SUPER_PM,
    "dev": UserRole.DEV,
}
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    MeResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    RegisterResponse,
    UserCreate,
    UserMeResponse,
    UserResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Maximum failed login attempts before account lockout
MAX_FAILED_LOGIN_ATTEMPTS = 5
# Lockout duration in minutes
LOCKOUT_DURATION_MINUTES = 15


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Creates a new user account with the provided details.",
    responses={
        201: {"description": "User registered successfully"},
        400: {"description": "Validation error"},
        409: {"description": "Email already registered"},
    },
)
async def register(
    request: Request,
    user_data: UserCreate,
    db: DbSession,
) -> RegisterResponse:
    """
    Register a new user account.

    Args:
        request: The incoming request.
        user_data: User registration data.
        db: Database session.

    Returns:
        RegisterResponse: Registration confirmation with user details.

    Raises:
        HTTPException: If email is already registered or validation fails.
    """
    # Check if email already exists
    existing_user = await db.execute(
        select(User).where(User.email == user_data.email.lower())
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "RESOURCE_ALREADY_EXISTS",
                "message": "An account with this email already exists",
                "field": "email",
            },
        )

    try:
        # Create new user
        password_hash = hash_password(user_data.password, validate=False)  # Already validated by schema

        role = REGISTER_ROLE_MAP.get(user_data.role, UserRole.PM)
        new_user = User(
            email=user_data.email.lower(),
            password_hash=password_hash,
            full_name=user_data.full_name,
            company_name=user_data.company_name,
            role=role,
            is_email_verified=False,  # Require email verification
        )

        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)

        logger.info("New user registered: %s", new_user.email)

        # Audit log: user registration
        try:
            await audit.log_action(
                db=db,
                actor_user_id=new_user.id,
                actor_role=new_user.role.value,
                action="auth.register",
                outcome=ActionOutcome.SUCCESS,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                metadata={"email": new_user.email},
            )
        except Exception as e:
            logger.error("Failed to log audit for registration: %s", e)

        # Generate tokens for auto-login after registration
        token_data = create_token_pair(
            user_id=str(new_user.id),
            email=new_user.email,
            role=new_user.role.value,
        )

        # Store refresh token hash
        new_user.refresh_token = hash_password(token_data["refresh_token"], validate=False)
        new_user.refresh_token_expires_at = token_data["refresh_token_expires_at"]
        await db.commit()
        await db.refresh(new_user)

        return RegisterResponse(
            success=True,
            data={
                "user": UserResponse(
                    id=new_user.id,
                    email=new_user.email,
                    full_name=new_user.full_name,
                    company_name=new_user.company_name,
                    role=new_user.role.value,
                    avatar_url=new_user.avatar_url,
                    created_at=new_user.created_at,
                    updated_at=new_user.updated_at,
                ).model_dump(),
                "tokens": {
                    "access_token": token_data["access_token"],
                    "refresh_token": token_data["refresh_token"],
                    "token_type": token_data["token_type"],
                    "expires_in": token_data["expires_in"],
                },
                "message": "Registration successful. Please check your email to verify your account.",
            },
        )

    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "RESOURCE_ALREADY_EXISTS",
                "message": "An account with this email already exists",
            },
        )


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Authenticate user",
    description="Authenticates a user and returns JWT tokens.",
    responses={
        200: {"description": "Login successful"},
        401: {"description": "Invalid credentials"},
        403: {"description": "Account suspended or not verified"},
        429: {"description": "Too many failed attempts"},
    },
)
async def login(
    request: Request,
    credentials: LoginRequest,
    db: DbSession,
) -> LoginResponse:
    """
    Authenticate user and return JWT tokens.

    Args:
        request: The incoming request.
        credentials: Login credentials.
        db: Database session.

    Returns:
        LoginResponse: User data and authentication tokens.

    Raises:
        HTTPException: If authentication fails.
    """
    # Find user by email (exclude soft-deleted users)
    result = await db.execute(
        select(User)
        .where(User.email == credentials.email.lower())
        .where(User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()

    # Check if user exists and is active
    if user is None:
        logger.warning("Login attempt for non-existent user: %s", credentials.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTH_INVALID_CREDENTIALS",
                "message": "Invalid email or password",
            },
        )

    if not user.is_active:
        logger.warning("Login attempt for inactive user: %s", credentials.email)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "AUTH_ACCOUNT_SUSPENDED",
                "message": "Your account has been suspended. Please contact support.",
            },
        )

    # Check if account is locked
    if user.is_locked:
        logger.warning("Login attempt for locked account: %s", credentials.email)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "RATE_LIMIT_EXCEEDED",
                "message": f"Account temporarily locked due to too many failed login attempts. Please try again later.",
            },
        )

    # Verify password
    if not verify_password(credentials.password, user.password_hash):
        # Increment failed login attempts
        user.failed_login_attempts += 1

        # Lock account if too many failed attempts
        if user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
            from datetime import timedelta
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            logger.warning("Account locked due to too many failed attempts: %s", credentials.email)
            # Audit log: account locked (flush_only to avoid mid-request commit)
            try:
                await audit.log_action(
                    db=db,
                    actor_user_id=user.id,
                    actor_role=user.role.value,
                    action="auth.account.locked",
                    outcome=ActionOutcome.SUCCESS,
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    metadata={"failed_attempts": user.failed_login_attempts},
                    flush_only=True,
                )
            except Exception as e:
                logger.error("Failed to log audit for account lockout: %s", e)

        # Audit log: login failure (flush_only to avoid mid-request commit)
        try:
            await audit.log_action(
                db=db,
                actor_user_id=user.id,
                actor_role=user.role.value,
                action="auth.login.failure",
                outcome=ActionOutcome.FAILURE,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                metadata={"reason": "invalid_password", "email_attempt": credentials.email},
                flush_only=True,
            )
        except Exception as e:
            logger.error("Failed to log audit for login failure: %s", e)

        await db.commit()

        logger.warning("Failed login attempt for user: %s", credentials.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTH_INVALID_CREDENTIALS",
                "message": "Invalid email or password",
            },
        )

    # Successful login - reset failed attempts and update last login
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)

    # Generate tokens
    token_data = create_token_pair(
        user_id=str(user.id),
        email=user.email,
        role=user.role.value,
    )

    # Store refresh token hash (for token revocation)
    user.refresh_token = hash_password(token_data["refresh_token"], validate=False)
    user.refresh_token_expires_at = token_data["refresh_token_expires_at"]

    # Audit log: login success (flush_only to avoid mid-request commit / greenlet issues)
    try:
        await audit.log_action(
            db=db,
            actor_user_id=user.id,
            actor_role=user.role.value,
            action="auth.login.success",
            outcome=ActionOutcome.SUCCESS,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            metadata={"method": "password"},
            flush_only=True,
        )
    except Exception as e:
        logger.error("Failed to log audit for login success: %s", e)

    await db.commit()
    await db.refresh(user)

    logger.info("Successful login for user: %s", user.email)

    return LoginResponse(
        success=True,
        data={
            "user": UserResponse(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                company_name=user.company_name,
                role=user.role.value,
                avatar_url=user.avatar_url,
                created_at=user.created_at,
                updated_at=user.updated_at,
            ).model_dump(),
            "tokens": {
                "access_token": token_data["access_token"],
                "refresh_token": token_data["refresh_token"],
                "token_type": token_data["token_type"],
                "expires_in": token_data["expires_in"],
            },
        },
    )


@router.post(
    "/refresh",
    response_model=RefreshTokenResponse,
    summary="Refresh access token",
    description="Exchange a refresh token for a new access token.",
    responses={
        200: {"description": "Token refreshed successfully"},
        401: {"description": "Invalid or expired refresh token"},
    },
)
async def refresh_token(
    request: Request,
    token_request: RefreshTokenRequest,
    db: DbSession,
) -> RefreshTokenResponse:
    """
    Refresh the access token using a valid refresh token.

    Args:
        request: The incoming request.
        token_request: Refresh token request data.
        db: Database session.

    Returns:
        RefreshTokenResponse: New access token.

    Raises:
        HTTPException: If refresh token is invalid or expired.
    """
    try:
        # Verify refresh token
        payload = verify_refresh_token(token_request.refresh_token)
        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "AUTH_TOKEN_INVALID",
                    "message": "Invalid refresh token",
                },
            )

        # Find user and verify refresh token matches
        from uuid import UUID
        result = await db.execute(
            select(User).where(
                User.id == UUID(user_id),
                User.is_active == True,  # noqa: E712
            )
        )
        user = result.scalar_one_or_none()

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "AUTH_USER_NOT_FOUND",
                    "message": "User not found or inactive",
                },
            )

        # Verify the refresh token matches stored hash
        if user.refresh_token is None or not verify_password(
            token_request.refresh_token, user.refresh_token
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "AUTH_TOKEN_INVALID",
                    "message": "Refresh token has been revoked",
                },
            )

        # Generate new token pair
        token_data = create_token_pair(
            user_id=str(user.id),
            email=user.email,
            role=user.role.value,
        )

        # Update stored refresh token
        user.refresh_token = hash_password(token_data["refresh_token"], validate=False)
        user.refresh_token_expires_at = token_data["refresh_token_expires_at"]

        await db.commit()

        logger.info("Token refreshed for user: %s", user.email)

        return RefreshTokenResponse(
            success=True,
            data={
                "access_token": token_data["access_token"],
                "refresh_token": token_data["refresh_token"],
                "token_type": token_data["token_type"],
                "expires_in": token_data["expires_in"],
            },
        )

    except TokenValidationError as e:
        logger.warning("Refresh token validation failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTH_REFRESH_TOKEN_EXPIRED" if "expired" in str(e).lower() else "AUTH_TOKEN_INVALID",
                "message": str(e),
            },
        )


@router.post(
    "/logout",
    response_model=LogoutResponse,
    summary="Logout user",
    description="Invalidates the current session tokens.",
    responses={
        200: {"description": "Logout successful"},
        401: {"description": "Not authenticated"},
    },
)
async def logout(
    request: Request,
    current_user: ActiveUser,
    db: DbSession,
) -> LogoutResponse:
    """
    Logout the current user by invalidating their refresh token.

    Args:
        request: The incoming request.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        LogoutResponse: Logout confirmation.
    """
    # Invalidate refresh token
    current_user.refresh_token = None
    current_user.refresh_token_expires_at = None

    await db.commit()

    logger.info("User logged out: %s", current_user.email)

    # Audit log: logout
    try:
        await audit.log_action(
            db=db,
            actor_user_id=current_user.id,
            actor_role=current_user.role.value,
            action="auth.logout",
            outcome=ActionOutcome.SUCCESS,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            metadata={},
        )
    except Exception as e:
        logger.error("Failed to log audit for logout: %s", e)

    return LogoutResponse(
        success=True,
        data={"message": "Logged out successfully"},
    )


@router.get(
    "/me",
    response_model=MeResponse,
    summary="Get current user",
    description="Returns the authenticated user's profile information.",
    responses={
        200: {"description": "User profile returned"},
        401: {"description": "Not authenticated"},
    },
)
async def get_me(
    request: Request,
    current_user: ActiveUser,
) -> MeResponse:
    """
    Get the current authenticated user's profile.

    Args:
        request: The incoming request.
        current_user: The authenticated user.

    Returns:
        MeResponse: User profile data.
    """
    return MeResponse(
        success=True,
        data=UserMeResponse(
            id=current_user.id,
            email=current_user.email,
            full_name=current_user.full_name,
            company_name=current_user.company_name,
            role=current_user.role.value,
            avatar_url=current_user.avatar_url,
            is_email_verified=current_user.is_email_verified,
            last_login_at=current_user.last_login_at,
            created_at=current_user.created_at,
            updated_at=current_user.updated_at,
        ),
    )

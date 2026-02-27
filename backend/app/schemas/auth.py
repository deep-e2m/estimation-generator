"""
Authentication schemas for request/response validation.

This module defines Pydantic schemas for authentication endpoints
including registration, login, and token management.
"""

import re
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.config import is_allowed_email_domain, settings


# =============================================================================
# Base Response Schema
# =============================================================================


class APIResponse(BaseModel):
    """Base API response schema."""

    success: bool = True


class ErrorDetail(BaseModel):
    """Error detail schema for validation errors."""

    field: str | None = None
    message: str
    code: str


class ErrorResponse(BaseModel):
    """Standard error response schema."""

    success: Literal[False] = False
    error: dict


# =============================================================================
# User Schemas
# =============================================================================


class UserBase(BaseModel):
    """Base user schema with common fields."""

    email: EmailStr = Field(
        ...,
        description="User's email address",
        examples=["user@example.com"],
    )
    full_name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="User's full name",
        examples=["John Doe"],
    )
    company_name: str | None = Field(
        default=None,
        max_length=200,
        description="User's company name",
        examples=["Acme Corp"],
    )


class UserCreate(UserBase):
    """Schema for user registration request."""

    role: Literal["pm", "super_pm", "dev"] = Field(
        default="pm",
        description="User's role (pm, super_pm, or dev). Admin cannot be self-selected.",
    )
    password: str = Field(
        ...,
        min_length=settings.PASSWORD_MIN_LENGTH,
        description="User's password",
        examples=["SecureP@ss123"],
    )

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password meets security requirements."""
        errors = []

        if len(v) < settings.PASSWORD_MIN_LENGTH:
            errors.append(
                f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters"
            )

        if settings.PASSWORD_REQUIRE_UPPERCASE and not re.search(r"[A-Z]", v):
            errors.append("Password must contain at least one uppercase letter")

        if settings.PASSWORD_REQUIRE_LOWERCASE and not re.search(r"[a-z]", v):
            errors.append("Password must contain at least one lowercase letter")

        if settings.PASSWORD_REQUIRE_DIGIT and not re.search(r"\d", v):
            errors.append("Password must contain at least one digit")

        if settings.PASSWORD_REQUIRE_SPECIAL and not re.search(
            r"[!@#$%^&*(),.?\":{}|<>]", v
        ):
            errors.append(
                "Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)"
            )

        if errors:
            raise ValueError("; ".join(errors))

        return v

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        """Validate and clean full name."""
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return v

    @field_validator("email")
    @classmethod
    def validate_email_domain(cls, v: str) -> str:
        """Restrict registration to company email domains only."""
        if not is_allowed_email_domain(v):
            raise ValueError(
                "Only company email addresses are allowed (e.g. @e2m.solutions or @e2msolution.com)."
            )
        return v.lower()


class UserResponse(BaseModel):
    """Schema for user data in responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="User's unique identifier")
    email: EmailStr = Field(..., description="User's email address")
    full_name: str = Field(..., description="User's full name")
    company_name: str | None = Field(None, description="User's company name")
    role: str = Field(
        ...,
        description="User's role (admin, pm, super_pm, or dev)",
    )
    avatar_url: str | None = Field(None, description="URL to user's avatar")
    is_active: bool = Field(True, description="Whether the user account is active")
    created_at: datetime = Field(..., description="When user was created")
    updated_at: datetime | None = Field(None, description="When user was last updated")


class UserMeResponse(UserResponse):
    """Extended user response for /auth/me endpoint."""

    is_email_verified: bool = Field(..., description="Whether email is verified")
    last_login_at: datetime | None = Field(None, description="Last login timestamp")


# =============================================================================
# Authentication Schemas
# =============================================================================


class LoginRequest(BaseModel):
    """Schema for login request."""

    email: EmailStr = Field(
        ...,
        description="User's email address",
        examples=["user@example.com"],
    )
    password: str = Field(
        ...,
        min_length=1,
        description="User's password",
        examples=["SecureP@ss123"],
    )

    @field_validator("email")
    @classmethod
    def validate_email_domain(cls, v: str) -> str:
        """Restrict login to company email domains only."""
        if not is_allowed_email_domain(v):
            raise ValueError(
                "Only company email addresses are allowed (e.g. @e2m.solutions or @e2msolution.com)."
            )
        return v.lower()


class TokenResponse(BaseModel):
    """Schema for token response in login."""

    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: Literal["Bearer"] = Field(default="Bearer", description="Token type")
    expires_in: int = Field(..., description="Access token expiration in seconds")


class LoginResponse(APIResponse):
    """Schema for login response."""

    data: dict = Field(
        ...,
        description="Login response data containing user and tokens",
    )


class RegisterResponse(APIResponse):
    """Schema for registration response."""

    data: dict = Field(
        ...,
        description="Registration response data containing user and message",
    )


class RefreshTokenRequest(BaseModel):
    """Schema for token refresh request."""

    refresh_token: str = Field(
        ...,
        min_length=1,
        description="The refresh token to exchange for new access token",
    )


class RefreshTokenResponse(APIResponse):
    """Schema for token refresh response."""

    data: dict = Field(
        ...,
        description="New access token data",
    )


class LogoutResponse(APIResponse):
    """Schema for logout response."""

    data: dict = Field(
        default={"message": "Logged out successfully"},
        description="Logout confirmation message",
    )


class MeResponse(APIResponse):
    """Schema for /auth/me response."""

    data: UserMeResponse = Field(
        ...,
        description="Current user data",
    )


# =============================================================================
# Password Reset Schemas
# =============================================================================


class PasswordResetRequest(BaseModel):
    """Schema for password reset request."""

    email: EmailStr = Field(
        ...,
        description="Email address for password reset",
        examples=["user@example.com"],
    )

    @field_validator("email")
    @classmethod
    def validate_email_domain(cls, v: str) -> str:
        """Restrict password reset to company email domains only."""
        if not is_allowed_email_domain(v):
            raise ValueError(
                "Only company email addresses are allowed (e.g. @e2m.solutions or @e2msolution.com)."
            )
        return v.lower()


class PasswordResetConfirm(BaseModel):
    """Schema for password reset confirmation."""

    token: str = Field(
        ...,
        min_length=1,
        description="Password reset token from email",
    )
    new_password: str = Field(
        ...,
        min_length=settings.PASSWORD_MIN_LENGTH,
        description="New password",
        examples=["NewSecureP@ss456"],
    )

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        """Validate new password meets security requirements."""
        errors = []

        if len(v) < settings.PASSWORD_MIN_LENGTH:
            errors.append(
                f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters"
            )

        if settings.PASSWORD_REQUIRE_UPPERCASE and not re.search(r"[A-Z]", v):
            errors.append("Password must contain at least one uppercase letter")

        if settings.PASSWORD_REQUIRE_LOWERCASE and not re.search(r"[a-z]", v):
            errors.append("Password must contain at least one lowercase letter")

        if settings.PASSWORD_REQUIRE_DIGIT and not re.search(r"\d", v):
            errors.append("Password must contain at least one digit")

        if settings.PASSWORD_REQUIRE_SPECIAL and not re.search(
            r"[!@#$%^&*(),.?\":{}|<>]", v
        ):
            errors.append(
                "Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)"
            )

        if errors:
            raise ValueError("; ".join(errors))

        return v


class PasswordResetResponse(APIResponse):
    """Schema for password reset response."""

    data: dict = Field(
        ...,
        description="Password reset response message",
    )

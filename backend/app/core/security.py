"""
Security utilities for password hashing and JWT token management.

This module provides secure password hashing with bcrypt and JWT
token generation/validation for authentication.
"""

import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

logger = logging.getLogger(__name__)

# Password hashing context using bcrypt
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=settings.BCRYPT_ROUNDS,
)


class PasswordValidationError(Exception):
    """Exception raised when password validation fails."""

    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


def validate_password_strength(password: str) -> list[str]:
    """
    Validate password against security requirements.

    Args:
        password: The password to validate.

    Returns:
        list[str]: List of validation error messages. Empty if valid.
    """
    errors = []

    if len(password) < settings.PASSWORD_MIN_LENGTH:
        errors.append(f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters long")

    if settings.PASSWORD_REQUIRE_UPPERCASE and not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter")

    if settings.PASSWORD_REQUIRE_LOWERCASE and not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter")

    if settings.PASSWORD_REQUIRE_DIGIT and not re.search(r"\d", password):
        errors.append("Password must contain at least one digit")

    if settings.PASSWORD_REQUIRE_SPECIAL and not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        errors.append("Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)")

    return errors


def hash_password(password: str, validate: bool = True) -> str:
    """
    Hash a password using bcrypt.

    Args:
        password: The plain text password to hash.
        validate: Whether to validate password strength first.

    Returns:
        str: The hashed password.

    Raises:
        PasswordValidationError: If validation is enabled and password doesn't meet requirements.
    """
    if validate:
        errors = validate_password_strength(password)
        if errors:
            raise PasswordValidationError(errors)

    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.

    Args:
        plain_password: The plain text password to verify.
        hashed_password: The hashed password to compare against.

    Returns:
        bool: True if the password matches, False otherwise.
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.warning("Password verification failed: %s", str(e))
        return False


def generate_secure_token(length: int = 32) -> str:
    """
    Generate a cryptographically secure random token.

    Args:
        length: The length of the token in bytes (default 32).

    Returns:
        str: A URL-safe base64-encoded random token.
    """
    return secrets.token_urlsafe(length)


# JWT Token Types
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"


def create_access_token(
    subject: str,
    additional_claims: dict[str, Any] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a JWT access token.

    Args:
        subject: The subject (usually user ID) for the token.
        additional_claims: Additional claims to include in the token.
        expires_delta: Custom expiration time. Defaults to settings.

    Returns:
        str: The encoded JWT token.
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    now = datetime.now(timezone.utc)
    expire = now + expires_delta

    to_encode = {
        "sub": str(subject),
        "type": TOKEN_TYPE_ACCESS,
        "iat": now,
        "exp": expire,
        "iss": settings.APP_NAME,
    }

    if additional_claims:
        to_encode.update(additional_claims)

    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(
    subject: str,
    additional_claims: dict[str, Any] | None = None,
    expires_delta: timedelta | None = None,
) -> tuple[str, datetime]:
    """
    Create a JWT refresh token.

    Args:
        subject: The subject (usually user ID) for the token.
        additional_claims: Additional claims to include in the token.
        expires_delta: Custom expiration time. Defaults to settings.

    Returns:
        tuple[str, datetime]: The encoded JWT token and expiration datetime.
    """
    if expires_delta is None:
        expires_delta = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    now = datetime.now(timezone.utc)
    expire = now + expires_delta

    to_encode = {
        "sub": str(subject),
        "type": TOKEN_TYPE_REFRESH,
        "iat": now,
        "exp": expire,
        "iss": settings.APP_NAME,
        "jti": generate_secure_token(16),  # JWT ID for token revocation
    }

    if additional_claims:
        to_encode.update(additional_claims)

    token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, expire


class TokenValidationError(Exception):
    """Exception raised when token validation fails."""

    pass


def decode_token(token: str, expected_type: str | None = None) -> dict[str, Any]:
    """
    Decode and validate a JWT token.

    Args:
        token: The JWT token to decode.
        expected_type: If provided, verify the token is of this type.

    Returns:
        dict: The decoded token payload.

    Raises:
        TokenValidationError: If token is invalid, expired, or wrong type.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"require_sub": True, "require_exp": True},
        )

        # Verify token type if specified
        if expected_type and payload.get("type") != expected_type:
            raise TokenValidationError(
                f"Invalid token type. Expected {expected_type}, got {payload.get('type')}"
            )

        return payload

    except jwt.ExpiredSignatureError:
        raise TokenValidationError("Token has expired")
    except JWTError as e:
        logger.warning("JWT decode error: %s", str(e))
        raise TokenValidationError("Invalid token")


def verify_access_token(token: str) -> dict[str, Any]:
    """
    Verify and decode an access token.

    Args:
        token: The access token to verify.

    Returns:
        dict: The decoded token payload.

    Raises:
        TokenValidationError: If token is invalid.
    """
    return decode_token(token, expected_type=TOKEN_TYPE_ACCESS)


def verify_refresh_token(token: str) -> dict[str, Any]:
    """
    Verify and decode a refresh token.

    Args:
        token: The refresh token to verify.

    Returns:
        dict: The decoded token payload.

    Raises:
        TokenValidationError: If token is invalid.
    """
    return decode_token(token, expected_type=TOKEN_TYPE_REFRESH)


def create_token_pair(
    user_id: str,
    email: str,
    role: str,
) -> dict[str, Any]:
    """
    Create both access and refresh tokens for a user.

    Args:
        user_id: The user's unique identifier.
        email: The user's email address.
        role: The user's role.

    Returns:
        dict: Dictionary containing access_token, refresh_token, and metadata.
    """
    additional_claims = {
        "email": email,
        "role": role,
    }

    access_token = create_access_token(
        subject=user_id,
        additional_claims=additional_claims,
    )

    refresh_token, refresh_expires = create_refresh_token(
        subject=user_id,
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # In seconds
        "refresh_token_expires_at": refresh_expires,
    }

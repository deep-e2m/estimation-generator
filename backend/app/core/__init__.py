"""
Core package for shared utilities and infrastructure.

This module exports database and security utilities.
"""

from app.core.database import (
    close_db_connection,
    get_db_session,
    get_engine,
    get_session_factory,
    init_db_connection,
)
from app.core.security import (
    PasswordValidationError,
    TokenValidationError,
    create_access_token,
    create_refresh_token,
    create_token_pair,
    decode_token,
    generate_secure_token,
    hash_password,
    validate_password_strength,
    verify_access_token,
    verify_password,
    verify_refresh_token,
)

__all__ = [
    # Database
    "init_db_connection",
    "close_db_connection",
    "get_db_session",
    "get_engine",
    "get_session_factory",
    # Security
    "hash_password",
    "verify_password",
    "validate_password_strength",
    "PasswordValidationError",
    "create_access_token",
    "create_refresh_token",
    "create_token_pair",
    "decode_token",
    "verify_access_token",
    "verify_refresh_token",
    "TokenValidationError",
    "generate_secure_token",
]

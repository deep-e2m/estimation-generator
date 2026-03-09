"""
Reset all user passwords to a known value for development/testing.

Run from the backend directory:
    cd backend && python -m scripts.reset_user_passwords

Or with custom password:
    RESET_PASSWORD="MyNewP@ss123" python -m scripts.reset_user_passwords

Also unlocks any locked accounts and clears failed_login_attempts.
"""

from __future__ import annotations

import asyncio
import logging
import os

from sqlalchemy import select

from app.config import is_allowed_email_domain
from app.core.database import get_session_factory, init_db_connection
from app.core.security import hash_password
from app.models.user import User

logger = logging.getLogger(__name__)

# Default password meeting PASSWORD_MIN_LENGTH, uppercase, lowercase, digit, special
DEFAULT_PASSWORD = "DevP@ssw0rd!"


async def reset_passwords() -> None:
    """Reset all non-deleted users' passwords and unlock accounts."""
    password = os.environ.get("RESET_PASSWORD", DEFAULT_PASSWORD)

    # Validate password meets requirements
    from app.core.security import validate_password_strength

    errors = validate_password_strength(password)
    if errors:
        raise ValueError(f"Password does not meet requirements: {'; '.join(errors)}")

    await init_db_connection()
    session_factory = get_session_factory()
    password_hash = hash_password(password, validate=False)

    async with session_factory() as session:
        result = await session.execute(
            select(User).where(User.deleted_at.is_(None))
        )
        users = result.scalars().all()

        for user in users:
            user.password_hash = password_hash
            user.failed_login_attempts = 0
            user.locked_until = None

        await session.commit()

        logger.info(
            "Reset password for %d user(s). New password: %s",
            len(users),
            password if os.environ.get("RESET_PASSWORD") else DEFAULT_PASSWORD,
        )
        for u in users:
            domain_ok = "✓" if is_allowed_email_domain(u.email) else "✗ (add domain to ALLOWED_EMAIL_DOMAINS)"
            print(f"  - {u.email} (role={u.role.value}) {domain_ok}")


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(reset_passwords())


if __name__ == "__main__":
    main()

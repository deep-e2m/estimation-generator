"""
One-off: Remove users with disallowed email domains and set pm@e2m.solutions password.

Only e2m.solutions and e2msolution.com are allowed.
Run: docker compose run --rm backend python -m scripts.cleanup_users_and_set_pm_password
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.database import get_session_factory, init_db_connection
from app.core.security import hash_password
from app.models.user import User

logger = logging.getLogger(__name__)

ALLOWED_DOMAINS = ("e2m.solutions", "e2msolution.com")
PM_EMAIL = "pm@e2m.solutions"
PM_NEW_PASSWORD = "Pm@12345"


def _domain_allowed(email: str) -> bool:
    if "@" not in email:
        return False
    return email.split("@")[-1].lower() in ALLOWED_DOMAINS


async def run() -> None:
    await init_db_connection()
    session_factory = get_session_factory()

    async with session_factory() as session:
        # 1. Soft-delete users with disallowed domains
        result = await session.execute(
            select(User).where(User.deleted_at.is_(None))
        )
        users = result.scalars().all()

        removed = []
        for u in users:
            if not _domain_allowed(u.email):
                u.deleted_at = datetime.now(timezone.utc)
                u.is_active = False
                removed.append(u.email)

        if removed:
            await session.flush()
            logger.info("Soft-deleted %d user(s) with disallowed domains: %s", len(removed), removed)

        # 2. Update pm@e2m.solutions password
        pm_result = await session.execute(
            select(User).where(User.email == PM_EMAIL).where(User.deleted_at.is_(None))
        )
        pm_user = pm_result.scalar_one_or_none()
        if pm_user:
            pm_user.password_hash = hash_password(PM_NEW_PASSWORD, validate=False)
            pm_user.failed_login_attempts = 0
            pm_user.locked_until = None
            logger.info("Updated password for %s", PM_EMAIL)
        else:
            logger.warning("User %s not found, skipping password update", PM_EMAIL)

        await session.commit()
        print(f"Removed users: {removed}")
        print(f"pm@e2m.solutions password set to: {PM_NEW_PASSWORD}")


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run())


if __name__ == "__main__":
    main()

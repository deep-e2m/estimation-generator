"""
File: ./backend/app/create_admin.py

Utility script to create an initial admin user.

This can be run from the command line:

    python -m app.create_admin

It will connect to the configured database and create an admin user
with the provided credentials if one does not already exist.
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select, text

from app.core.database import get_session_factory, init_db_connection
from app.core.security import hash_password
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)


ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "AdminP@ssw0rd!"
ADMIN_FULL_NAME = "System Administrator"
ADMIN_COMPANY = "Quote Assistant"


async def create_admin_user() -> None:
    """
    Create an admin user with default credentials if it does not exist.

    The admin user will have:
      - email: ADMIN_EMAIL
      - password: ADMIN_PASSWORD
    """
    await init_db_connection()
    session_factory = get_session_factory()

    async with session_factory() as session:
        # First try to find an existing user via raw SQL to avoid enum mismatches
        select_stmt = text(
            "SELECT id, role, is_email_verified FROM users WHERE email = :email"
        )
        result = await session.execute(select_stmt, {"email": ADMIN_EMAIL})
        row = result.mappings().first()

        if row is not None:
            logger.info("Admin user already exists with email %s", ADMIN_EMAIL)
            # Ensure role is 'admin' and email is verified
            update_stmt = text(
                "UPDATE users "
                "SET role = :role, is_email_verified = TRUE "
                "WHERE email = :email"
            )
            await session.execute(
                update_stmt,
                {"email": ADMIN_EMAIL, "role": "admin"},
            )
            await session.commit()
            logger.info("Existing user updated to admin role and verified email")
            return

        password_hash = hash_password(ADMIN_PASSWORD, validate=False)

        insert_stmt = text(
            "INSERT INTO users (email, password_hash, full_name, company_name, role, "
            "is_email_verified, is_active) "
            "VALUES (:email, :password_hash, :full_name, :company_name, :role, TRUE, TRUE)"
        )

        await session.execute(
            insert_stmt,
            {
                "email": ADMIN_EMAIL,
                "password_hash": password_hash,
                "full_name": ADMIN_FULL_NAME,
                "company_name": ADMIN_COMPANY,
                "role": "admin",
            },
        )
        await session.commit()

        logger.info("Admin user created with email %s", ADMIN_EMAIL)


def main() -> None:
    """Entrypoint for command-line execution."""
    asyncio.run(create_admin_user())


if __name__ == "__main__":
    main()



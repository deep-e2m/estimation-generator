"""
File: ./backend/app/create_admin.py

Utility script to create or sync the single system admin from .env.

Run from the command line:

    python -m app.create_admin

Behaviour:
- One admin for the system. Credentials come from .env (ADMIN_EMAIL, ADMIN_PASSWORD).
- If a user with ADMIN_EMAIL already exists: their password and role are updated from .env.
- If no user with ADMIN_EMAIL exists: creates a new admin, or if there is already
  one admin, updates that user to ADMIN_EMAIL/ADMIN_PASSWORD (so changing .env
  and re-running keeps a single admin). Multiple admins are demoted to pm except
  the one synced from .env.

Change admin email or password in .env and run this script again to apply.
Other users (including PM) are managed via the app/DB, not .env.
"""

from __future__ import annotations

import asyncio
import logging
import os

from sqlalchemy import bindparam, text

from app.config import get_settings, is_allowed_email_domain
from app.core.database import get_session_factory, init_db_connection
from app.core.security import hash_password

logger = logging.getLogger(__name__)


ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@e2m.solutions")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "AdminP@ssw0rd!")
ADMIN_FULL_NAME = os.environ.get("ADMIN_FULL_NAME", "System Administrator")
ADMIN_COMPANY = os.environ.get("ADMIN_COMPANY", "Quote Assistant")


async def create_admin_user() -> None:
    """
    Create or sync the single admin user from .env.

    The admin is defined by ADMIN_EMAIL and ADMIN_PASSWORD in .env. Re-run
    after changing .env to update the admin's email or password. Only one
    admin is maintained; others are demoted to pm.
    """
    settings = get_settings()
    if settings.ALLOWED_EMAIL_DOMAINS and not is_allowed_email_domain(ADMIN_EMAIL):
        raise ValueError(
            f"ADMIN_EMAIL must use an allowed company domain ({', '.join(settings.ALLOWED_EMAIL_DOMAINS)}). "
            "Set ADMIN_EMAIL in the environment (e.g. ADMIN_EMAIL=admin@e2m.solutions)."
        )
    await init_db_connection()
    session_factory = get_session_factory()
    password_hash = hash_password(ADMIN_PASSWORD, validate=False)

    async with session_factory() as session:
        # User with ADMIN_EMAIL already exists: sync password and role from .env
        select_by_email = text(
            "SELECT id, role, is_email_verified FROM users WHERE email = :email"
        )
        result = await session.execute(select_by_email, {"email": ADMIN_EMAIL})
        row = result.mappings().first()

        if row is not None:
            logger.info("Admin user already exists with email %s; syncing password from .env", ADMIN_EMAIL)
            update_stmt = text(
                "UPDATE users "
                "SET role = :role, is_email_verified = TRUE, password_hash = :password_hash "
                "WHERE email = :email"
            )
            await session.execute(
                update_stmt,
                {
                    "email": ADMIN_EMAIL,
                    "role": "admin",
                    "password_hash": password_hash,
                },
            )
            await session.commit()
            logger.info("Admin credentials updated from .env")
            return

        # No user with ADMIN_EMAIL: create new admin or take over the single existing admin
        admins_result = await session.execute(
            text("SELECT id, email FROM users WHERE role = 'admin' ORDER BY id")
        )
        admins = admins_result.mappings().all()

        if len(admins) == 0:
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
            return

        # One or more admins exist but none with ADMIN_EMAIL: sync the first to .env, demote rest
        target_id = admins[0]["id"]
        update_admin_stmt = text(
            "UPDATE users "
            "SET email = :email, password_hash = :password_hash, full_name = :full_name, "
            "company_name = :company_name, role = :role, is_email_verified = TRUE "
            "WHERE id = :id"
        )
        await session.execute(
            update_admin_stmt,
            {
                "id": target_id,
                "email": ADMIN_EMAIL,
                "password_hash": password_hash,
                "full_name": ADMIN_FULL_NAME,
                "company_name": ADMIN_COMPANY,
                "role": "admin",
            },
        )
        if len(admins) > 1:
            other_ids = [a["id"] for a in admins[1:]]
            demote_stmt = text(
                "UPDATE users SET role = 'pm' WHERE id IN :ids"
            ).bindparams(bindparam("ids", expanding=True))
            await session.execute(demote_stmt, {"ids": other_ids})
            logger.info(
                "Single admin synced to %s from .env; %d other admin(s) demoted to pm",
                ADMIN_EMAIL,
                len(admins) - 1,
            )
        else:
            logger.info(
                "Admin email/password updated to %s from .env (same account)",
                ADMIN_EMAIL,
            )
        await session.commit()


def main() -> None:
    """Entrypoint for command-line execution."""
    asyncio.run(create_admin_user())


if __name__ == "__main__":
    main()



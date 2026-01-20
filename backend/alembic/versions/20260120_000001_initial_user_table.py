"""Initial user table creation.

Revision ID: 20260120_000001
Revises:
Create Date: 2026-01-20

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260120_000001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create users table with all necessary columns and constraints."""
    # Create user_role enum type
    user_role_enum = postgresql.ENUM("admin", "pm", name="user_role", create_type=False)
    user_role_enum.create(op.get_bind(), checkfirst=True)

    # Create users table
    op.create_table(
        "users",
        # Primary key
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        # Authentication fields
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        # Profile fields
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("company_name", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        # Role
        sa.Column(
            "role",
            user_role_enum,
            nullable=False,
            server_default="pm",
        ),
        # Email verification
        sa.Column("is_email_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("email_verification_token", sa.String(255), nullable=True),
        sa.Column("email_verification_sent_at", sa.DateTime(timezone=True), nullable=True),
        # Password reset
        sa.Column("password_reset_token", sa.String(255), nullable=True),
        sa.Column("password_reset_token_expires_at", sa.DateTime(timezone=True), nullable=True),
        # Session management
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("refresh_token_expires_at", sa.DateTime(timezone=True), nullable=True),
        # Login tracking
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        # Soft delete
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        # Timestamps
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # Create indexes
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_is_active", "users", ["is_active"])
    op.create_index("ix_users_created_at", "users", ["created_at"])

    # Add check constraints
    op.create_check_constraint(
        "ck_users_email_format",
        "users",
        "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'",
    )
    op.create_check_constraint(
        "ck_users_failed_login_attempts_positive",
        "users",
        "failed_login_attempts >= 0",
    )


def downgrade() -> None:
    """Drop users table and related objects."""
    # Drop check constraints
    op.drop_constraint("ck_users_failed_login_attempts_positive", "users", type_="check")
    op.drop_constraint("ck_users_email_format", "users", type_="check")

    # Drop indexes
    op.drop_index("ix_users_created_at", table_name="users")
    op.drop_index("ix_users_is_active", table_name="users")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_index("ix_users_email", table_name="users")

    # Drop table
    op.drop_table("users")

    # Drop enum type
    user_role_enum = postgresql.ENUM("admin", "pm", name="user_role", create_type=False)
    user_role_enum.drop(op.get_bind(), checkfirst=True)

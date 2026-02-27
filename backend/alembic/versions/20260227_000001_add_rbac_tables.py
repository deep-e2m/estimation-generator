"""Add RBAC tables: project_shares and approval_requests.

Revision ID: 20260227_000001
Revises: 20260226_000001
Create Date: 2026-02-27

Adds:
- super_pm and dev to user_role enum
- project_shares table for project sharing with access levels
- approval_requests table for estimation approval workflow
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260227_000001"
down_revision: Union[str, None] = "20260226_000001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new values to user_role enum (PostgreSQL)
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_pm'")
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'dev'")

    # Create access_level enum for project shares (raw SQL to avoid duplicate create)
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE access_level AS ENUM (
                'read', 'edit_content', 'edit_estimation', 'edit_full'
            );
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )

    # Create approval_status enum
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE approval_status AS ENUM (
                'pending', 'approved', 'disapproved'
            );
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )

    # Reference enums without creating (create_type=False)
    access_level_enum = postgresql.ENUM(
        "read",
        "edit_content",
        "edit_estimation",
        "edit_full",
        name="access_level",
        create_type=False,
    )
    approval_status_enum = postgresql.ENUM(
        "pending",
        "approved",
        "disapproved",
        name="approval_status",
        create_type=False,
    )

    # Create project_shares table
    op.create_table(
        "project_shares",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "shared_with_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "shared_by_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "access_level",
            access_level_enum,
            nullable=False,
            server_default="read",
        ),
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_project_shares")),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_project_shares_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["shared_with_user_id"],
            ["users.id"],
            name=op.f("fk_project_shares_shared_with_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["shared_by_user_id"],
            ["users.id"],
            name=op.f("fk_project_shares_shared_by_user_id_users"),
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_project_shares_project_id",
        "project_shares",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_shares_shared_with_user_id",
        "project_shares",
        ["shared_with_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_shares_shared_by_user_id",
        "project_shares",
        ["shared_by_user_id"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_project_shares_project_id_shared_with_user_id",
        "project_shares",
        ["project_id", "shared_with_user_id"],
    )

    # Create approval_requests table
    op.create_table(
        "approval_requests",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "requested_by",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "assigned_to",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "status",
            approval_status_enum,
            nullable=False,
            server_default="pending",
        ),
        sa.Column("disapproval_reason", sa.Text(), nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_approval_requests")),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_approval_requests_project_id_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["requested_by"],
            ["users.id"],
            name=op.f("fk_approval_requests_requested_by_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["assigned_to"],
            ["users.id"],
            name=op.f("fk_approval_requests_assigned_to_users"),
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_approval_requests_project_id",
        "approval_requests",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_approval_requests_requested_by",
        "approval_requests",
        ["requested_by"],
        unique=False,
    )
    op.create_index(
        "ix_approval_requests_assigned_to",
        "approval_requests",
        ["assigned_to"],
        unique=False,
    )
    op.create_index(
        "ix_approval_requests_status",
        "approval_requests",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    # Drop approval_requests table and indexes
    op.drop_index("ix_approval_requests_status", table_name="approval_requests")
    op.drop_index("ix_approval_requests_assigned_to", table_name="approval_requests")
    op.drop_index("ix_approval_requests_requested_by", table_name="approval_requests")
    op.drop_index("ix_approval_requests_project_id", table_name="approval_requests")
    op.drop_table("approval_requests")

    # Drop project_shares table and indexes
    op.drop_constraint(
        "uq_project_shares_project_id_shared_with_user_id",
        "project_shares",
        type_="unique",
    )
    op.drop_index("ix_project_shares_shared_by_user_id", table_name="project_shares")
    op.drop_index("ix_project_shares_shared_with_user_id", table_name="project_shares")
    op.drop_index("ix_project_shares_project_id", table_name="project_shares")
    op.drop_table("project_shares")

    # Drop enums
    approval_status_enum = postgresql.ENUM(
        "pending",
        "approved",
        "disapproved",
        name="approval_status",
        create_type=False,
    )
    approval_status_enum.drop(op.get_bind(), checkfirst=True)

    access_level_enum = postgresql.ENUM(
        "read",
        "edit_content",
        "edit_estimation",
        "edit_full",
        name="access_level",
        create_type=False,
    )
    access_level_enum.drop(op.get_bind(), checkfirst=True)

    # Note: PostgreSQL does not support removing enum values. To fully revert
    # user_role enum you would need to recreate the type and column. We leave
    # super_pm and dev in the enum for safety; existing users keep their role.
    # If you must remove: migrate data to temp column, drop column, recreate
    # enum with only admin/pm, add column back, copy data, drop temp column.

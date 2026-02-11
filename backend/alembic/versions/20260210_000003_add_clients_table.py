"""Add clients table and client relationship to projects.

Revision ID: 20260210_000003
Revises: 20260210_000002
Create Date: 2026-02-10 00:00:03.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260210_000003"
down_revision: Union[str, None] = "20260210_000002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create clients table and add client_id to projects."""

    # Create clients table
    op.create_table(
        "clients",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # Create indexes
    op.create_index("ix_clients_created_by", "clients", ["created_by"])
    op.create_index("ix_clients_name", "clients", ["name"])

    # Add client_id column to projects table
    op.add_column(
        "projects",
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,  # Temporarily nullable for migration
        ),
    )

    # Create default client for existing projects
    # (Each project gets a placeholder client named "Legacy Client")
    op.execute(
        """
        INSERT INTO clients (id, name, email, created_by, created_at, updated_at)
        SELECT
            gen_random_uuid(),
            'Legacy Client',
            NULL,
            created_by,
            now(),
            now()
        FROM projects
        GROUP BY created_by;
    """
    )

    # Update existing projects to reference the legacy client
    op.execute(
        """
        UPDATE projects p
        SET client_id = c.id
        FROM clients c
        WHERE c.name = 'Legacy Client'
        AND c.created_by = p.created_by;
    """
    )

    # Now make client_id NOT NULL
    op.alter_column("projects", "client_id", nullable=False)

    # Add foreign key constraint
    op.create_foreign_key(
        "fk_projects_client_id_clients",
        "projects",
        "clients",
        ["client_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # Create index
    op.create_index("ix_projects_client_id", "projects", ["client_id"])


def downgrade() -> None:
    """Remove clients table and client_id from projects."""

    op.drop_index("ix_projects_client_id", table_name="projects")
    op.drop_constraint("fk_projects_client_id_clients", "projects", type_="foreignkey")
    op.drop_column("projects", "client_id")
    op.drop_index("ix_clients_name", table_name="clients")
    op.drop_index("ix_clients_created_by", table_name="clients")
    op.drop_table("clients")

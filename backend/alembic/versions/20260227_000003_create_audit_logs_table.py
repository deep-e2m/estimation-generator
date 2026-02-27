"""Create audit_logs table.

Revision ID: 20260227_000003
Revises: 20260227_000002
Create Date: 2026-02-27

Append-only audit log table for activity and compliance tracking.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260227_000003"
down_revision: Union[str, None] = "20260227_000002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create action_outcome enum
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE action_outcome AS ENUM ('success', 'failure');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )

    action_outcome_enum = postgresql.ENUM(
        "success",
        "failure",
        name="action_outcome",
        create_type=False,
    )

    op.create_table(
        "audit_logs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "actor_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "actor_role",
            sa.String(50),
            nullable=False,
        ),
        sa.Column(
            "action",
            sa.String(100),
            nullable=False,
        ),
        sa.Column(
            "outcome",
            action_outcome_enum,
            nullable=False,
            server_default="success",
        ),
        sa.Column(
            "resource_type",
            sa.String(50),
            nullable=True,
        ),
        sa.Column(
            "resource_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "ip_address",
            sa.String(45),
            nullable=True,
        ),
        sa.Column(
            "user_agent",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "request_id",
            sa.String(100),
            nullable=True,
        ),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_logs")),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            name=op.f("fk_audit_logs_actor_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_audit_logs_project_id_projects"),
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "ix_audit_logs_actor_user_id",
        "audit_logs",
        ["actor_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_audit_logs_action",
        "audit_logs",
        ["action"],
        unique=False,
    )
    op.create_index(
        "ix_audit_logs_project_id",
        "audit_logs",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_audit_logs_resource_id",
        "audit_logs",
        ["resource_id"],
        unique=False,
    )
    op.create_index(
        "ix_audit_logs_resource_type",
        "audit_logs",
        ["resource_type"],
        unique=False,
    )
    op.create_index(
        "ix_audit_logs_timestamp",
        "audit_logs",
        ["timestamp"],
        unique=False,
    )
    op.create_index(
        "ix_audit_logs_outcome",
        "audit_logs",
        ["outcome"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_audit_logs_outcome", table_name="audit_logs")
    op.drop_index("ix_audit_logs_timestamp", table_name="audit_logs")
    op.drop_index("ix_audit_logs_resource_type", table_name="audit_logs")
    op.drop_index("ix_audit_logs_resource_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_project_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_user_id", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.execute("DROP TYPE IF EXISTS action_outcome")

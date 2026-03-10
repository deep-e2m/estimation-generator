"""Unique partial index: at most one pending per (project_id, assigned_to).

Revision ID: 20260310_000001
Revises: 20260227_000003
Create Date: 2026-03-10

Adds a unique partial index on approval_requests so that at most one row
with status = 'pending' exists per (project_id, assigned_to).
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260310_000001"
down_revision: Union[str, None] = "20260227_000003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ix_approval_requests_project_assignee_pending
        ON approval_requests (project_id, assigned_to)
        WHERE status = 'pending'
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_approval_requests_project_assignee_pending")

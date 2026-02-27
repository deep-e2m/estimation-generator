"""Reassign all projects to pm@e2m.solutions.

Revision ID: 20260227_000002
Revises: 20260227_000001
Create Date: 2026-02-27

One-time data migration: sets projects.created_by to the user id of
pm@e2m.solutions so all existing projects are owned by that account.
Only runs the update when that user exists (avoids setting created_by to NULL).
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260227_000002"
down_revision: Union[str, None] = "20260227_000001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Reassign all projects to pm@e2m.solutions (only if that user exists)
    op.execute(
        """
        UPDATE projects
        SET created_by = (
            SELECT id FROM users
            WHERE email = 'pm@e2m.solutions' AND deleted_at IS NULL
            LIMIT 1
        )
        WHERE (
            SELECT id FROM users
            WHERE email = 'pm@e2m.solutions' AND deleted_at IS NULL
            LIMIT 1
        ) IS NOT NULL
        """
    )


def downgrade() -> None:
    # No safe way to restore previous owners; leave projects as-is
    pass

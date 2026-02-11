"""Add additional_instructions to projects table.

Revision ID: 20260210_000001
Revises: 20260121_000001
Create Date: 2026-02-10 12:58:00.000000

This migration adds an additional_instructions TEXT field to the projects table
to store extra project information or instructions.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260210_000001"
down_revision: Union[str, None] = "20260121_000002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add additional_instructions column to projects table."""
    
    op.add_column(
        "projects",
        sa.Column(
            "additional_instructions",
            sa.Text,
            nullable=True,
            comment="Additional information or instructions for the project",
        ),
    )


def downgrade() -> None:
    """Remove additional_instructions column from projects table."""
    
    op.drop_column("projects", "additional_instructions")

"""Add reference_urls to projects table.

Revision ID: 20260226_000001
Revises: 20260217_000001
Create Date: 2026-02-26

Adds reference_urls JSONB column to store reference URLs (e.g. Figma design links)
so they are displayed in the UI and sent to the backend for scraping during estimation.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260226_000001"
down_revision: Union[str, None] = "20260217_000001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "reference_urls",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Reference URLs (e.g. Figma) for estimation; scraped when URL scraping is enabled",
        ),
    )


def downgrade() -> None:
    op.drop_column("projects", "reference_urls")

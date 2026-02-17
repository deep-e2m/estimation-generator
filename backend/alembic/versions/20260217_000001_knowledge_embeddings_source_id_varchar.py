"""knowledge_embeddings: change source_id from UUID to VARCHAR(255)

Ingestion uses string source IDs (e.g. 'training-EXAMPLE-...', 'quote-<uuid>').
PostgreSQL UUID type rejects non-UUID strings, causing training ingestion to fail.
This migration allows any string identifier up to 255 chars.

Revision ID: 20260217_000001
Revises: 20260213_000001
Create Date: 2026-02-17

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260217_000001"
down_revision: str | None = "20260213_000001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Convert UUID column to VARCHAR(255). Existing rows have UUIDs; cast to text.
    op.execute("""
        ALTER TABLE knowledge_embeddings
        ALTER COLUMN source_id TYPE VARCHAR(255)
        USING source_id::text
    """)


def downgrade() -> None:
    # Reverting requires valid UUIDs in the column. Only rows with UUID-form source_id will survive.
    op.execute("""
        ALTER TABLE knowledge_embeddings
        ALTER COLUMN source_id TYPE UUID
        USING source_id::uuid
    """)


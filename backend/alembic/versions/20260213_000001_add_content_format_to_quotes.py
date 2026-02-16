"""add content_format column to quotes

Revision ID: 20260213_000001
Revises: 20260211_000001
Create Date: 2026-02-13 00:00:01.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260213_000001'
down_revision = '20260211_000001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add content_format enum and column to quotes table.

    The column defaults to 'markdown' for all existing rows (AI-generated
    content). When users edit via the Tiptap inline editor and save, the
    value is updated to 'html'.
    """
    # Create the enum type first.
    content_format_enum = sa.Enum('markdown', 'html', name='content_format')
    content_format_enum.create(op.get_bind(), checkfirst=True)

    # Add the column with a server default so existing rows get 'markdown'.
    op.add_column(
        'quotes',
        sa.Column(
            'content_format',
            content_format_enum,
            nullable=False,
            server_default='markdown',
            comment='Format of the content field: markdown (AI) or html (Tiptap editor)',
        ),
    )


def downgrade() -> None:
    """Remove content_format column and enum."""
    op.drop_column('quotes', 'content_format')

    # Drop the enum type.
    content_format_enum = sa.Enum('markdown', 'html', name='content_format')
    content_format_enum.drop(op.get_bind(), checkfirst=True)

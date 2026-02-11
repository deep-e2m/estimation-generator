"""make client_id optional in projects

Revision ID: 20260211_000001
Revises: 20260210_000003
Create Date: 2026-02-11 00:00:01.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260211_000001'
down_revision = '20260210_000003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Make client_id nullable and change ondelete constraint."""
    # First, drop the existing foreign key constraint
    op.drop_constraint('fk_projects_client_id_clients', 'projects', type_='foreignkey')

    # Make the column nullable
    op.alter_column('projects', 'client_id',
                    existing_type=postgresql.UUID(),
                    nullable=True)

    # Re-add foreign key with SET NULL on delete
    op.create_foreign_key(
        'fk_projects_client_id_clients',
        'projects', 'clients',
        ['client_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    """Revert client_id to non-nullable (may fail if NULL values exist)."""
    # Drop the foreign key constraint
    op.drop_constraint('fk_projects_client_id_clients', 'projects', type_='foreignkey')

    # Make column non-nullable (will fail if there are NULL values)
    op.alter_column('projects', 'client_id',
                    existing_type=postgresql.UUID(),
                    nullable=False)

    # Re-add foreign key with RESTRICT on delete
    op.create_foreign_key(
        'fk_projects_client_id_clients',
        'projects', 'clients',
        ['client_id'], ['id'],
        ondelete='RESTRICT'
    )

"""Restrict platform type to WordPress only.

Revision ID: 20260210_000002
Revises: 20260210_000001
Create Date: 2026-02-10 00:00:02.000000

This migration simplifies the platform options to only support WordPress.
It updates all existing projects to use 'wordpress' and modifies the
platform_type enum to only contain 'wordpress'.

Changes:
    - Update all projects with non-WordPress platforms to 'wordpress'
    - Alter platform_type enum to only contain 'wordpress' value
    - Remove 'shopify', 'woocommerce', and 'custom' from platform_type enum
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260210_000002"
down_revision: Union[str, None] = "20260210_000001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Restrict platform_type enum to only WordPress."""

    # Step 1: Update all existing projects to use 'wordpress'
    # This ensures no projects have incompatible platform values
    op.execute("""
        UPDATE projects
        SET platform = 'wordpress'
        WHERE platform IN ('shopify', 'woocommerce', 'custom')
    """)

    # Step 2: Create new enum type with only 'wordpress'
    op.execute("""
        CREATE TYPE platform_type_new AS ENUM ('wordpress')
    """)

    # Step 3: Alter the column to use the new type
    # Force all values to 'wordpress' (they already are from step 1, but this ensures type safety)
    op.execute("""
        ALTER TABLE projects
        ALTER COLUMN platform TYPE platform_type_new
        USING 'wordpress'::platform_type_new
    """)

    # Step 4: Drop the old enum type
    op.execute("DROP TYPE platform_type")

    # Step 5: Rename new type to original name
    op.execute("ALTER TYPE platform_type_new RENAME TO platform_type")


def downgrade() -> None:
    """Restore platform_type enum to include all original platforms."""

    # Step 1: Create new enum type with all four original values
    op.execute("""
        CREATE TYPE platform_type_new AS ENUM ('wordpress', 'shopify', 'woocommerce', 'custom')
    """)

    # Step 2: Alter the column to use the new type
    # All existing values are 'wordpress', which is valid in the new enum
    op.execute("""
        ALTER TABLE projects
        ALTER COLUMN platform TYPE platform_type_new
        USING platform::text::platform_type_new
    """)

    # Step 3: Drop the old enum type
    op.execute("DROP TYPE platform_type")

    # Step 4: Rename new type to original name
    op.execute("ALTER TYPE platform_type_new RENAME TO platform_type")

    # Note: Historical data about which platform was originally selected
    # before the upgrade is lost and cannot be restored

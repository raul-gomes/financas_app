"""add users.supabase_id (identity by Supabase sub, not by e-mail)

Revision ID: a7b8c9d0e1f2
Revises: f0a1b2c3d4e5
Create Date: 2026-11-14

Existing rows stay NULL and are linked by e-mail on their next login.
"""

import sqlalchemy as sa
from alembic import op

revision = "a7b8c9d0e1f2"
down_revision = "f0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("supabase_id", sa.String(length=64), nullable=True))
    op.create_index("ix_users_supabase_id", "users", ["supabase_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_supabase_id", table_name="users")
    op.drop_column("users", "supabase_id")

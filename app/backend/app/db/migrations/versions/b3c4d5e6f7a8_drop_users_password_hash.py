"""drop users.password_hash (login is Supabase-only; the column was never read)

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-11-14

downgrade() re-adds the column as nullable: the original NOT NULL default ''
carried no data, and old code that wrote '' keeps working.
"""

import sqlalchemy as sa
from alembic import op

revision = "b3c4d5e6f7a8"
down_revision = "a2b3c4d5e6f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("users", "password_hash")


def downgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(), nullable=True))

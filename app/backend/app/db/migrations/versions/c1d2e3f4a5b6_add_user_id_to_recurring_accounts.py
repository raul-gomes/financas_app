"""add user_id to recurring_accounts (Etapa 7)

Revision ID: c1d2e3f4a5b6
Revises: b9c0d1e2f3a4
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa


revision = "c1d2e3f4a5b6"
down_revision = "b9c0d1e2f3a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("recurring_accounts", sa.Column("user_id", sa.Integer(), nullable=True))
    op.execute("UPDATE recurring_accounts SET user_id = 1")
    op.alter_column("recurring_accounts", "user_id", nullable=False)
    op.create_foreign_key(
        "fk_recurring_accounts_user_id", "recurring_accounts", "users",
        ["user_id"], ["id"], ondelete="CASCADE",
    )
    op.create_index("ix_recurring_accounts_user_id", "recurring_accounts", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_recurring_accounts_user_id", table_name="recurring_accounts")
    op.drop_constraint("fk_recurring_accounts_user_id", "recurring_accounts", type_="foreignkey")
    op.drop_column("recurring_accounts", "user_id")
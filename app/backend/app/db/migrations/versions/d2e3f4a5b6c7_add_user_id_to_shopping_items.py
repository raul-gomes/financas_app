"""add user_id to shopping_items (Etapa 8)

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa


revision = "d2e3f4a5b6c7"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("shopping_items", sa.Column("user_id", sa.Integer(), nullable=True))
    op.execute("UPDATE shopping_items SET user_id = 1")
    op.alter_column("shopping_items", "user_id", nullable=False)
    op.create_foreign_key(
        "fk_shopping_items_user_id", "shopping_items", "users",
        ["user_id"], ["id"], ondelete="CASCADE",
    )
    op.create_index("ix_shopping_items_user_id", "shopping_items", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_shopping_items_user_id", table_name="shopping_items")
    op.drop_constraint("fk_shopping_items_user_id", "shopping_items", type_="foreignkey")
    op.drop_column("shopping_items", "user_id")
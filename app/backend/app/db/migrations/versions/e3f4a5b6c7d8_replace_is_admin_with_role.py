"""replace users.is_admin with role (Etapa 9)

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa


revision = "e3f4a5b6c7d8"
down_revision = "d2e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(length=32), nullable=True))
    op.execute("UPDATE users SET role = 'admin' WHERE is_admin = TRUE")
    op.execute("UPDATE users SET role = 'user' WHERE is_admin IS NOT TRUE OR is_admin IS NULL")
    op.alter_column("users", "role", nullable=False, server_default=sa.text("'user'"))
    op.drop_column("users", "is_admin")


def downgrade() -> None:
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.execute("UPDATE users SET is_admin = TRUE WHERE role = 'admin'")
    op.execute("UPDATE users SET is_admin = FALSE WHERE role <> 'admin'")
    op.drop_column("users", "role")
"""create limit_alerts (Etapa 1 - notificacoes de limites)

Revision ID: f0a1b2c3d4e5
Revises: e3f4a5b6c7d8
Create Date: 2026-09-12
"""
from alembic import op
import sqlalchemy as sa


revision = "f0a1b2c3d4e5"
down_revision = "e3f4a5b6c7d8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "limit_alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("scope", sa.String(length=32), nullable=False, server_default="category"),
        sa.Column("month", sa.String(length=7), nullable=False),
        sa.Column("threshold", sa.Integer(), nullable=False),
        sa.Column("exceeded", sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column("percent_used", sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("email_sent", sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["category_id"], ["categorias.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "category_id", "month", "threshold", name="uq_limit_alerts_user_cat_month_threshold"),
    )
    op.create_index(op.f("ix_limit_alerts_user_id"), "limit_alerts", ["user_id"], unique=False)
    op.create_index(op.f("ix_limit_alerts_category_id"), "limit_alerts", ["category_id"], unique=False)
    op.create_index("ix_limit_alerts_id", "limit_alerts", ["id"], unique=False)


def downgrade() -> None:
    op.drop_table("limit_alerts")
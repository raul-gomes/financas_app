"""add external_id/external_source to transacoes (provider dedupe)

Revision ID: c5d6e7f8a9b0
Revises: b3c4d5e6f7a8
Create Date: 2026-11-14 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c5d6e7f8a9b0"
down_revision = "b3c4d5e6f7a8"
branch_labels = None
depends_on = None

INDEX_NAME = "uq_transacoes_user_external"


def upgrade() -> None:
    op.add_column("transacoes", sa.Column("external_id", sa.String(length=64), nullable=True))
    op.add_column("transacoes", sa.Column("external_source", sa.String(length=16), nullable=True))
    op.create_index(
        INDEX_NAME,
        "transacoes",
        ["user_id", "external_source", "external_id"],
        unique=True,
        postgresql_where=sa.text("external_id IS NOT NULL"),
        sqlite_where=sa.text("external_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name="transacoes")
    op.drop_column("transacoes", "external_source")
    op.drop_column("transacoes", "external_id")

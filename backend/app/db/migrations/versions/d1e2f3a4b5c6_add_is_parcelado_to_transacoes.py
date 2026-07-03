"""add is_parcelado to transacoes

Revision ID: d1e2f3a4b5c6
Revises: c1d2e3f4f5f6
Create Date: 2026-07-02 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c1d2e3f4f5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('transacoes', sa.Column('is_parcelado', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    # Backfill: set is_parcelado = true for existing parceled transactions
    op.execute("UPDATE transacoes SET is_parcelado = true WHERE total_parcelas IS NOT NULL AND total_parcelas > 1")


def downgrade() -> None:
    op.drop_column('transacoes', 'is_parcelado')

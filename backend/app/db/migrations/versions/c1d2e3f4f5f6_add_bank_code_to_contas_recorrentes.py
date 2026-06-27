"""add bank_code to contas_recorrentes

Revision ID: c1d2e3f4f5f6
Revises: b1c2d3e4f5f6
Create Date: 2026-06-24 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1d2e3f4f5f6'
down_revision: Union[str, None] = 'b1c2d3e4f5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('contas_recorrentes', sa.Column('bank_code', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('contas_recorrentes', 'bank_code')

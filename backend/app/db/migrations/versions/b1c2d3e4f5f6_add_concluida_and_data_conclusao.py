"""add concluida and data_conclusao to subcategorias and shopping_items

Revision ID: b1c2d3e4f5f6
Revises: a1b2c3d4e5f7
Create Date: 2026-06-23 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b1c2d3e4f5f6'
down_revision: Union[str, None] = 'a1b2c3d4e5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # subcategorias — metas completion
    op.add_column('subcategorias', sa.Column('concluida', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('subcategorias', sa.Column('data_conclusao', sa.Date(), nullable=True))

    # shopping_items — completion date
    op.add_column('shopping_items', sa.Column('data_conclusao', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('shopping_items', 'data_conclusao')
    op.drop_column('subcategorias', 'data_conclusao')
    op.drop_column('subcategorias', 'concluida')

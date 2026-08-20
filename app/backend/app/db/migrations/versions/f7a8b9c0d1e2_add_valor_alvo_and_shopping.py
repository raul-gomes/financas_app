"""add valor_alvo to subcategorias and create shopping_items table

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-06-23 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f7a8b9c0d1e2'
down_revision: Union[str, None] = 'e6f7a8b9c0d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('subcategorias', sa.Column('valor_alvo', sa.Float(), nullable=True))
    op.create_table(
        'shopping_items',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('nome', sa.String(), nullable=False),
        sa.Column('mes_ref', sa.Date(), nullable=False),
        sa.Column('marcado', sa.Boolean(), default=False, nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('shopping_items')
    op.drop_column('subcategorias', 'valor_alvo')

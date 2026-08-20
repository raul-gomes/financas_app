"""add entity_type to shopping_items

Revision ID: e0f1a2b3c4d5
Revises: a0b1c2d3e4f5
Create Date: 2026-07-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e0f1a2b3c4d5'
down_revision: Union[str, None] = 'a0b1c2d3e4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('shopping_items', sa.Column('entity_type', sa.String(), nullable=False, server_default=sa.text("'individual'")))


def downgrade() -> None:
    op.drop_column('shopping_items', 'entity_type')

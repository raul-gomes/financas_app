"""add_recurring_fields_to_shopping_items

Revision ID: 36a95d2e5251
Revises: dfc6bf881c13
Create Date: 2026-08-24 13:20:25.529550

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '36a95d2e5251'
down_revision: Union[str, Sequence[str], None] = 'dfc6bf881c13'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('shopping_items', sa.Column('is_recurring', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('shopping_items', sa.Column('recurrence_group_id', sa.String(), nullable=True))
    op.add_column('shopping_items', sa.Column('recurrence_end_date', sa.Date(), nullable=True))
    op.create_index('ix_shopping_items_recurrence_group_id', 'shopping_items', ['recurrence_group_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_shopping_items_recurrence_group_id', table_name='shopping_items')
    op.drop_column('shopping_items', 'recurrence_end_date')
    op.drop_column('shopping_items', 'recurrence_group_id')
    op.drop_column('shopping_items', 'is_recurring')

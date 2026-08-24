"""add_composite_indexes_transacoes

Revision ID: 1078188c8bbe
Revises: 36a95d2e5251
Create Date: 2026-08-24 14:16:08.926928

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1078188c8bbe'
down_revision: Union[str, Sequence[str], None] = '36a95d2e5251'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index('idx_transacoes_entity_date', 'transacoes', ['entity_type', 'transaction_date'])
    op.create_index('idx_transacoes_type_date', 'transacoes', ['type', 'transaction_date'])
    op.create_index('idx_transacoes_cat_date', 'transacoes', ['category_id', 'transaction_date'])
    op.create_index('idx_transacoes_recurring', 'transacoes', ['recurring_account_id', 'transaction_date'])
    op.create_index('idx_transacoes_group', 'transacoes', ['group_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_transacoes_group', table_name='transacoes')
    op.drop_index('idx_transacoes_recurring', table_name='transacoes')
    op.drop_index('idx_transacoes_cat_date', table_name='transacoes')
    op.drop_index('idx_transacoes_type_date', table_name='transacoes')
    op.drop_index('idx_transacoes_entity_date', table_name='transacoes')

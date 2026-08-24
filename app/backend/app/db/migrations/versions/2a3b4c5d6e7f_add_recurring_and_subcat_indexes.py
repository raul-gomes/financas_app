"""add_recurring_and_subcat_indexes

Complementa o plano de performance (Fase 4.1): o baseline de EXPLAIN ANALYZE
revelou Seq Scan em `recurring_accounts` (lista ordenada por start_date) e em
`transacoes` no join de metas por subcategory_id. Estes índices cobrem essas
consultas.

Revision ID: 2a3b4c5d6e7f
Revises: 1078188c8bbe
Create Date: 2026-08-24 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2a3b4c5d6e7f'
down_revision: Union[str, Sequence[str], None] = '1078188c8bbe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index('idx_recurring_entity_start', 'recurring_accounts',
                    ['entity_type', 'start_date'])
    op.create_index('idx_transacoes_subcat_date', 'transacoes',
                    ['subcategory_id', 'transaction_date'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_transacoes_subcat_date', table_name='transacoes')
    op.drop_index('idx_recurring_entity_start', table_name='recurring_accounts')

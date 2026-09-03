"""add user_id to transacoes

Revision ID: b9c0d1e2f3a4
Revises: a7b8c9d0e1f2
Create Date: 2026-09-03 14:00:00.000000

Etapa 6 (isolamento por usuário):
- Adiciona transacoes.user_id (FK NOT NULL para users.id) com backfill para o user 1.
- Cria índice em transacoes.user_id.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b9c0d1e2f3a4'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Adiciona a coluna nullable e faz o backfill para o primeiro usuário existente
    op.add_column(
        'transacoes',
        sa.Column('user_id', sa.Integer(), nullable=True),
    )

    # Backfill: associa todas as transações existentes ao primeiro usuário (id 1).
    op.execute("""
        UPDATE transacoes
        SET user_id = 1
        WHERE user_id IS NULL
    """)

    # 2) Torna NOT NULL e adiciona a FK
    op.alter_column(
        'transacoes',
        'user_id',
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.create_foreign_key(
        'fk_transacoes_user_id',
        'transacoes',
        'users',
        ['user_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.create_index('ix_transacoes_user_id', 'transacoes', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_transacoes_user_id', table_name='transacoes')
    op.drop_constraint('fk_transacoes_user_id', 'transacoes', type_='foreignkey')
    op.drop_column('transacoes', 'user_id')
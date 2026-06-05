"""add conta_recorrente_id to transacoes

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('transacoes', sa.Column('conta_recorrente_id', sa.Integer(), nullable=True))
    op.create_index(
        op.f('ix_transacoes_conta_recorrente_id'),
        'transacoes',
        ['conta_recorrente_id'],
        unique=False,
    )
    op.create_foreign_key(
        'fk_transacoes_conta_recorrente_id',
        'transacoes',
        'contas_recorrentes',
        ['conta_recorrente_id'],
        ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_transacoes_conta_recorrente_id', 'transacoes', type_='foreignkey')
    op.drop_index(op.f('ix_transacoes_conta_recorrente_id'), table_name='transacoes')
    op.drop_column('transacoes', 'conta_recorrente_id')

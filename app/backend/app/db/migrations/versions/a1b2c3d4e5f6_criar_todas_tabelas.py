"""criar todas as tabelas

Revision ID: a1b2c3d4e5f6
Revises: 
Create Date: 2026-05-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'categorias',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('categoria_nome', sa.String(), nullable=False, unique=True),
        sa.Column('natureza', sa.String(), nullable=False),
        sa.Column('limite', sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_categorias_id'), 'categorias', ['id'], unique=False)

    op.create_table(
        'subcategorias',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('subcategoria_nome', sa.String(), nullable=False),
        sa.Column('categoria_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['categoria_id'], ['categorias.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_subcategorias_id'), 'subcategorias', ['id'], unique=False)

    op.create_table(
        'transacoes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.String(), nullable=False),
        sa.Column('valor', sa.Float(), nullable=False),
        sa.Column('descricao', sa.String(), nullable=False),
        sa.Column('parcela', sa.Integer(), nullable=True),
        sa.Column('total_parcelas', sa.Integer(), nullable=True),
        sa.Column('data_transacao', sa.DateTime(), nullable=False),
        sa.Column('data_criacao', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column('data_atualizacao', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=True),
        sa.Column('tipo', sa.String(), nullable=False),
        sa.Column('natureza', sa.String(), nullable=False),
        sa.Column('forma_pagamento', sa.String(), nullable=False),
        sa.Column('categoria_id', sa.Integer(), nullable=False),
        sa.Column('subcategoria_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['categoria_id'], ['categorias.id'], ),
        sa.ForeignKeyConstraint(['subcategoria_id'], ['subcategorias.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_transacoes_id'), 'transacoes', ['id'], unique=False)
    op.create_index(op.f('ix_transacoes_group_id'), 'transacoes', ['group_id'], unique=False)

    op.create_table(
        'contas_recorrentes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('descricao', sa.String(), nullable=False),
        sa.Column('valor', sa.Float(), nullable=False),
        sa.Column('dia_vencimento', sa.Integer(), nullable=False),
        sa.Column('categoria_id', sa.Integer(), nullable=False),
        sa.Column('subcategoria_id', sa.Integer(), nullable=False),
        sa.Column('natureza', sa.String(), nullable=False),
        sa.Column('forma_pagamento', sa.String(), nullable=False),
        sa.Column('data_inicio', sa.DateTime(), nullable=False),
        sa.Column('data_fim', sa.DateTime(), nullable=True),
        sa.Column('ativo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('group_id', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['categoria_id'], ['categorias.id'], ),
        sa.ForeignKeyConstraint(['subcategoria_id'], ['subcategorias.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_contas_recorrentes_id'), 'contas_recorrentes', ['id'], unique=False)
    op.create_index(op.f('ix_contas_recorrentes_group_id'), 'contas_recorrentes', ['group_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_contas_recorrentes_group_id'), table_name='contas_recorrentes')
    op.drop_index(op.f('ix_contas_recorrentes_id'), table_name='contas_recorrentes')
    op.drop_table('contas_recorrentes')
    op.drop_index(op.f('ix_transacoes_group_id'), table_name='transacoes')
    op.drop_index(op.f('ix_transacoes_id'), table_name='transacoes')
    op.drop_table('transacoes')
    op.drop_index(op.f('ix_subcategorias_id'), table_name='subcategorias')
    op.drop_table('subcategorias')
    op.drop_index(op.f('ix_categorias_id'), table_name='categorias')
    op.drop_table('categorias')

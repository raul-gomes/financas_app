"""add user_id to categorias

Revision ID: a7b8c9d0e1f2
Revises: 3b4c5d6e7f80
Create Date: 2026-09-03 12:00:00.000000

Etapa 5 (isolamento por usuário):
- Adiciona categorias.user_id (FK NOT NULL para users.id) com backfill para o user 1.
- Troca a unicidade (name, entity_type) por (name, entity_type, user_id).
- Cria índice em categories.user_id.
Subcategorias NÃO recebem user_id: são isoladas via JOIN com a categoria pai.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = '3b4c5d6e7f80'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Adiciona a coluna nullable e faz o backfill para o primeiro usuário existente
    op.add_column(
        'categorias',
        sa.Column('user_id', sa.Integer(), nullable=True),
    )

    # Backfill: associa todas as categorias existentes ao primeiro usuário (id 1).
    # Em um ambiente novo, o primeiro usuário cadastrado assume as categorias legadas.
    op.execute("""
        UPDATE categorias
        SET user_id = 1
        WHERE user_id IS NULL
    """)

    # 2) Torna NOT NULL e adiciona a FK
    op.alter_column(
        'categorias',
        'user_id',
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.create_foreign_key(
        'fk_categorias_user_id',
        'categorias',
        'users',
        ['user_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.create_index('ix_categorias_user_id', 'categorias', ['user_id'])

    # 3) Troca a unicidade (name, entity_type) -> (name, entity_type, user_id)
    op.drop_constraint('uq_categorias_name_entity_type', 'categorias', type_='unique')
    op.create_unique_constraint(
        'uq_categorias_name_entity_type_user',
        'categorias',
        ['name', 'entity_type', 'user_id'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_categorias_name_entity_type_user', 'categorias', type_='unique')
    op.create_unique_constraint(
        'uq_categorias_name_entity_type',
        'categorias',
        ['name', 'entity_type'],
    )
    op.drop_index('ix_categorias_user_id', table_name='categorias')
    op.drop_constraint('fk_categorias_user_id', 'categorias', type_='foreignkey')
    op.drop_column('categorias', 'user_id')
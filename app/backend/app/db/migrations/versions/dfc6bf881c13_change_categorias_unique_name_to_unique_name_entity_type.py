"""change categorias unique(name) to unique(name, entity_type)

Revision ID: dfc6bf881c13
Revises: e0f1a2b3c4d5
Create Date: 2026-07-03 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'dfc6bf881c13'
down_revision: Union[str, None] = 'e0f1a2b3c4d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old unique constraint on name
    op.drop_constraint('categorias_categoria_nome_key', 'categorias', type_='unique')
    # Add new unique constraint on (name, entity_type)
    op.create_unique_constraint('uq_categorias_name_entity_type', 'categorias', ['name', 'entity_type'])


def downgrade() -> None:
    # Drop new constraint
    op.drop_constraint('uq_categorias_name_entity_type', 'categorias', type_='unique')
    # Restore old unique constraint on name
    op.create_unique_constraint('categorias_categoria_nome_key', 'categorias', ['name'])

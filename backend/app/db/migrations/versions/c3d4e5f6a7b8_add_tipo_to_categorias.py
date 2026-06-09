"""add tipo column to categorias

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-06 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Add nullable tipo column
    op.add_column('categorias', sa.Column('tipo', sa.String(), nullable=True))

    # 2) Backfill existing categorias based on their names
    #    Categorias especiais (limites) ficam com tipo = NULL
    #    'Renda' -> entrada, 'Investimentos' -> investimento, demais -> saida
    op.execute("""
        UPDATE categorias
        SET tipo = CASE
            WHEN LOWER(categoria_nome) IN ('mensal pf', 'mensal pj', 'limite cartao credito', 'mensal') THEN NULL
            WHEN LOWER(categoria_nome) = 'renda' THEN 'entrada'
            WHEN LOWER(categoria_nome) = 'investimentos' THEN 'investimento'
            ELSE 'saida'
        END
    """)


def downgrade() -> None:
    op.drop_column('categorias', 'tipo')

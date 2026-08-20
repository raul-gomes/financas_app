"""add total_parcelas to contas_recorrentes

Revision ID: c4d5e6f7a8b9
Revises: b2c3d4e5f6a7
Create Date: 2026-06-08 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('contas_recorrentes', sa.Column('total_parcelas', sa.Integer(), nullable=False, server_default='12'))


def downgrade() -> None:
    op.drop_column('contas_recorrentes', 'total_parcelas')

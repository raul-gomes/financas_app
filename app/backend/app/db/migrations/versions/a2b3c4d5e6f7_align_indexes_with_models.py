"""align indexes with the ORM models (alembic check drift)

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-11-14

Renames the indexes that still carried the pre-rename Portuguese table names,
drops the duplicate single-column index on transacoes.group_id (a second one,
ix_transacoes_group_id, already exists) and records that the composite indexes
live in the models. Nothing here changes query results.
"""

from alembic import op

revision = "a2b3c4d5e6f7"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None

# (old name, new name)
RENAMED_INDEXES = (
    ("ix_contas_recorrentes_group_id", "ix_recurring_accounts_group_id"),
    ("ix_contas_recorrentes_id", "ix_recurring_accounts_id"),
    ("ix_transacoes_conta_recorrente_id", "ix_transacoes_recurring_account_id"),
)


def upgrade() -> None:
    for old, new in RENAMED_INDEXES:
        op.execute(f"ALTER INDEX IF EXISTS {old} RENAME TO {new}")
    op.drop_index("idx_transacoes_group", table_name="transacoes")


def downgrade() -> None:
    op.create_index("idx_transacoes_group", "transacoes", ["group_id"])
    for old, new in RENAMED_INDEXES:
        op.execute(f"ALTER INDEX IF EXISTS {new} RENAME TO {old}")

"""normalize all field names to English

Revision ID: a0b1c2d3e4f5
Revises: d1e2f3a4b5c6
Create Date: 2026-07-02 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a0b1c2d3e4f5'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ============================================================
    # TABLE: categorias
    # ============================================================
    op.execute('ALTER TABLE categorias RENAME COLUMN categoria_nome TO name')
    op.execute('ALTER TABLE categorias RENAME COLUMN natureza TO entity_type')
    op.execute('ALTER TABLE categorias RENAME COLUMN limite TO "limit"')
    op.execute('ALTER TABLE categorias RENAME COLUMN tipo TO "type"')

    # ============================================================
    # TABLE: subcategorias
    # ============================================================
    op.execute('ALTER TABLE subcategorias RENAME COLUMN subcategoria_nome TO name')
    op.execute('ALTER TABLE subcategorias RENAME COLUMN categoria_id TO category_id')
    op.execute('ALTER TABLE subcategorias RENAME COLUMN valor_alvo TO target_amount')
    op.execute('ALTER TABLE subcategorias RENAME COLUMN concluida TO completed')
    op.execute('ALTER TABLE subcategorias RENAME COLUMN data_conclusao TO completed_at')

    # ============================================================
    # TABLE: transacoes
    # ============================================================
    op.execute('ALTER TABLE transacoes RENAME COLUMN descricao TO description')
    op.execute('ALTER TABLE transacoes RENAME COLUMN parcela TO installment_number')
    op.execute('ALTER TABLE transacoes RENAME COLUMN total_parcelas TO total_installments')
    op.execute('ALTER TABLE transacoes RENAME COLUMN is_parcelado TO is_installment')
    op.execute('ALTER TABLE transacoes RENAME COLUMN data_transacao TO transaction_date')
    op.execute('ALTER TABLE transacoes RENAME COLUMN data_criacao TO created_at')
    op.execute('ALTER TABLE transacoes RENAME COLUMN data_atualizacao TO updated_at')
    op.execute('ALTER TABLE transacoes RENAME COLUMN natureza TO entity_type')
    op.execute('ALTER TABLE transacoes RENAME COLUMN forma_pagamento TO payment_method')
    op.execute('ALTER TABLE transacoes RENAME COLUMN categoria_id TO category_id')
    op.execute('ALTER TABLE transacoes RENAME COLUMN subcategoria_id TO subcategory_id')
    op.execute('ALTER TABLE transacoes RENAME COLUMN conta_recorrente_id TO recurring_account_id')
    op.execute('ALTER TABLE transacoes RENAME COLUMN valor TO amount')
    op.execute('ALTER TABLE transacoes RENAME COLUMN tipo TO "type"')

    # ============================================================
    # TABLE: contas_recorrentes → recurring_accounts
    # ============================================================
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN descricao TO description')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN dia_vencimento TO due_day')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN categoria_id TO category_id')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN subcategoria_id TO subcategory_id')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN natureza TO entity_type')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN forma_pagamento TO payment_method')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN data_inicio TO start_date')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN data_fim TO end_date')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN total_parcelas TO total_installments')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN valor TO amount')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN ativo TO active')
    # Rename the table itself
    op.execute('ALTER TABLE contas_recorrentes RENAME TO recurring_accounts')

    # ============================================================
    # TABLE: shopping_items
    # ============================================================
    op.execute('ALTER TABLE shopping_items RENAME COLUMN mes_ref TO reference_month')
    op.execute('ALTER TABLE shopping_items RENAME COLUMN marcado TO checked')
    op.execute('ALTER TABLE shopping_items RENAME COLUMN data_conclusao TO completed_at')
    op.execute('ALTER TABLE shopping_items RENAME COLUMN nome TO name')


def downgrade() -> None:
    # ============================================================
    # TABLE: shopping_items
    # ============================================================
    op.execute('ALTER TABLE shopping_items RENAME COLUMN name TO nome')
    op.execute('ALTER TABLE shopping_items RENAME COLUMN completed_at TO data_conclusao')
    op.execute('ALTER TABLE shopping_items RENAME COLUMN checked TO marcado')
    op.execute('ALTER TABLE shopping_items RENAME COLUMN reference_month TO mes_ref')

    # ============================================================
    # TABLE: recurring_accounts → contas_recorrentes
    # ============================================================
    op.execute('ALTER TABLE recurring_accounts RENAME TO contas_recorrentes')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN active TO ativo')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN total_installments TO total_parcelas')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN end_date TO data_fim')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN start_date TO data_inicio')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN payment_method TO forma_pagamento')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN entity_type TO natureza')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN subcategory_id TO subcategoria_id')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN category_id TO categoria_id')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN due_day TO dia_vencimento')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN description TO descricao')
    op.execute('ALTER TABLE contas_recorrentes RENAME COLUMN amount TO valor')

    # ============================================================
    # TABLE: transacoes
    # ============================================================
    op.execute('ALTER TABLE transacoes RENAME COLUMN "type" TO tipo')
    op.execute('ALTER TABLE transacoes RENAME COLUMN amount TO valor')
    op.execute('ALTER TABLE transacoes RENAME COLUMN recurring_account_id TO conta_recorrente_id')
    op.execute('ALTER TABLE transacoes RENAME COLUMN subcategory_id TO subcategoria_id')
    op.execute('ALTER TABLE transacoes RENAME COLUMN category_id TO categoria_id')
    op.execute('ALTER TABLE transacoes RENAME COLUMN payment_method TO forma_pagamento')
    op.execute('ALTER TABLE transacoes RENAME COLUMN entity_type TO natureza')
    op.execute('ALTER TABLE transacoes RENAME COLUMN updated_at TO data_atualizacao')
    op.execute('ALTER TABLE transacoes RENAME COLUMN created_at TO data_criacao')
    op.execute('ALTER TABLE transacoes RENAME COLUMN transaction_date TO data_transacao')
    op.execute('ALTER TABLE transacoes RENAME COLUMN is_installment TO is_parcelado')
    op.execute('ALTER TABLE transacoes RENAME COLUMN total_installments TO total_parcelas')
    op.execute('ALTER TABLE transacoes RENAME COLUMN installment_number TO parcela')
    op.execute('ALTER TABLE transacoes RENAME COLUMN description TO descricao')

    # ============================================================
    # TABLE: subcategorias
    # ============================================================
    op.execute('ALTER TABLE subcategorias RENAME COLUMN completed_at TO data_conclusao')
    op.execute('ALTER TABLE subcategorias RENAME COLUMN completed TO concluida')
    op.execute('ALTER TABLE subcategorias RENAME COLUMN target_amount TO valor_alvo')
    op.execute('ALTER TABLE subcategorias RENAME COLUMN category_id TO categoria_id')
    op.execute('ALTER TABLE subcategorias RENAME COLUMN name TO subcategoria_nome')

    # ============================================================
    # TABLE: categorias
    # ============================================================
    op.execute('ALTER TABLE categorias RENAME COLUMN "type" TO tipo')
    op.execute('ALTER TABLE categorias RENAME COLUMN "limit" TO limite')
    op.execute('ALTER TABLE categorias RENAME COLUMN entity_type TO natureza')
    op.execute('ALTER TABLE categorias RENAME COLUMN name TO categoria_nome')

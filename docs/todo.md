# 📋 Pendências / Melhorias

## Dashboard
- [x] Uniformizar altura dos cards acima do gráfico anual — **FEITO**: Cards usam `h-full flex flex-col` com spacer
- [x] Ajustar gráfico diário para preencher o box completamente — **FEITO**: Removidos width/height fixos do FlippableChart, usa ResizeObserver
- [x] Exibir "Balanço mensal: (entradas - saídas)" abaixo dos cards, verde se positivo, vermelho se negativo — **FEITO**: Banner no topo do FinancialDashboard

## Extrato / Transações
- [x] Mesmas regras do formulário de nova transação devem ser aplicadas no extrato — **FEITO**: Validação inline por transação (descrição, valor, categoria, subcategoria, forma pagamento, parcelas), duplicate check no confirm, validação de sessão completa
- [x] Upload múltiplo de arquivos (poder subir mais de um por vez) — **FEITO**: Input com `multiple` já existia
- [x] Sempre manter opção de editar/excluir cada entrada — **FEITO**: Botão delete (Trash2) em cada linha da tabela

## Recorrentes
- [x] Compras recorrentes: criar 12 parcelas, cancelar próximas ao desativar — **FEITO**: `POST /shopping/generate-recurring` + campos `is_recurring`, `recurrence_group_id`, `recurrence_end_date` no model/schema
- [x] Botão de renovar e lembrete quando estiver acabando a renovação — **FEITO**: `POST /recurring-accounts/{id}/renew` + campos `is_ending_soon`, `current_installment`, `remaining_installments` em `ContaRecorrenteResponse`

## UX / Animações
- [ ] Nos lançamentos do extrato financeiro, animação de cards subindo de baixo para cima

## API / Backend (novos)
- [x] Endpoint composto `GET /limits/with-spending?year=2024&month=8` — **FEITO**: retorna limites + gastos + % + subcategorias em 1 request
- [x] BFF pattern documentado em `AGENTS.md` — **FEITO**: seção "API Design Philosophy — Backend for Frontend (BFF)"

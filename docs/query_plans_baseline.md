# Query Plans Baseline — Fase 4.1

Data de captura: 2026-08-24
Ambiente: PostgreSQL 16 (container `financas-db`), dados de demonstração (~1666 transações, 25 contas recorrentes, 79 subcategorias, 18 categorias).
Ferramenta: `EXPLAIN (ANALYZE, BUFFERS)` via `asyncpg` (script em `/tmp/explain.py` no container `financas-api`).

> Nota: com volumes tão pequenos o planner do Postgres opta por **Seq Scan** em tabelas pequenas mesmo havendo índice (custo estimado menor). Os índices entram em ação conforme a tabela cresce. O baseline abaixo reflete o estado **após** os índices da Fase 1, e serve para comparação futura.

## Resumo

| # | Endpoint / Consulta | Scan | Índice usado | Exec Time | Status |
|---|---------------------|------|--------------|-----------|--------|
| 1 | Dashboard extrato (lista) | Index Scan Backward | `idx_transacoes_entity_date` | 0.49 ms | ✅ indexado |
| 2 | Dashboard extrato (agregado) | Bitmap Index Scan | `idx_transacoes_entity_date` | 1.5 ms | ✅ indexado |
| 3 | Recorrentes (lista ordenada) | **Seq Scan + Sort** | — | 0.49 ms* | ⚠️ índice adicionado (2a3b4c5d6e7f) |
| 4 | Metas (progresso, join subcat) | **Seq Scan** | — | 0.9 ms* | ⚠️ índice adicionado (2a3b4c5d6e7f) |
| 5 | Limites (gastos por categoria) | Bitmap Index Scan | `idx_transacoes_type_date` | 0.6 ms | ✅ indexado |

\* sub-ms em volume pequeno; o planner usou Seq Scan por ser mais barato que Index Scan nesse volume.

## Achados e Ação

- **Queries 1, 2, 5** já utilizam os índices compostos da Fase 1 (`idx_transacoes_entity_date`, `idx_transacoes_type_date`). Sem regressão.
- **Query 3** (`recurring_accounts` ordenado por `start_date` filtrado por `entity_type`) fazia **Seq Scan + Sort** — não havia índice em `recurring_accounts(entity_type, start_date)`.
- **Query 4** (metas: join `transacoes.subcategory_id` + filtro data/tipo) fazia Seq Scan em `transacoes` — faltava índice em `(subcategory_id, transaction_date)`.

**Ação aplicada:** migração `2a3b4c5d6e7f_add_recurring_and_subcat_indexes.py` cria:
- `idx_recurring_entity_start` em `recurring_accounts(entity_type, start_date)`
- `idx_transacoes_subcat_date` em `transacoes(subcategory_id, transaction_date)`

Re-execução do `EXPLAIN` confirmou que, no volume atual, o planner mantém Seq Scan (esperado), mas os índices estarão ativos em produção/com volume maior. **Próximo passo:** re-capturar este baseline com um dataset realista (ex.: 100k+ transações) para validar o ganho de fato.

## Planos completos (baseline)

### 1 — Dashboard extrato (lista)
```
Limit  (cost=0.28..7.72 rows=20 width=136) (actual time=0.327..0.396 rows=20 loops=1)
  Buffers: shared hit=14 read=2
  ->  Index Scan Backward using idx_transacoes_entity_date on transacoes
        (cost=0.28..164.83 rows=442 width=136) (actual time=0.325..0.392 rows=20 loops=1)
        Index Cond: (entity_type = 'individual' AND transaction_date >= ... AND transaction_date <= ...)
        Buffers: shared hit=14 read=2
Planning Time: 6.338 ms
Execution Time: 0.492 ms
```

### 2 — Dashboard extrato (agregado)
```
HashAggregate  (cost=62.96..62.98 rows=2 width=23) (actual time=1.202..1.204 rows=3 loops=1)
  Group Key: type
  ->  Bitmap Heap Scan on transacoes  (cost=13.91..59.65 rows=442 width=15)
        Recheck Cond: (entity_type = 'individual' AND transaction_date >= ... AND transaction_date <= ...)
        ->  Bitmap Index Scan on idx_transacoes_entity_date
              Index Cond: (entity_type = 'individual' AND transaction_date >= ... AND transaction_date <= ...)
Planning Time: 1.610 ms
Execution Time: 1.548 ms
```

### 3 — Recorrentes (lista) — ANTES do índice (Seq Scan)
```
Limit  (cost=14.38..14.39 rows=2 width=205) (actual time=0.076..0.079 rows=16 loops=1)
  ->  Sort  (cost=14.38..14.39 rows=2 width=205) (actual time=0.074..0.076 rows=16 loops=1)
        Sort Key: start_date DESC
        ->  Seq Scan on recurring_accounts  (cost=0.00..14.38 rows=2 width=205)
              Filter: (entity_type = 'individual')
              Rows Removed by Filter: 9
Execution Time: 0.115 ms
```
Após migração `2a3b4c5d6e7f`: plano idêntico (volume pequeno → planner mantém Seq Scan). Índice `idx_recurring_entity_start` disponível para volume maior.

### 4 — Metas (progresso) — ANTES do índice (Seq Scan)
```
HashAggregate  (cost=74.61..75.39 rows=78 width=25) (actual time=0.782..0.798 rows=79 loops=1)
  ->  Hash Right Join  (cost=2.75..71.59 rows=605 width=25)
        Hash Cond: (t.subcategory_id = s.id)
        ->  Seq Scan on transacoes t  (cost=0.00..67.16 rows=605 width=12)
              Filter: (transaction_date >= ... AND transaction_date <= ... AND type = 'expense')
              Rows Removed by Filter: 1016
Execution Time: 0.901 ms
```
Após migração `2a3b4c5d6e7f`: plano idêntico (volume pequeno). Índice `idx_transacoes_subcat_date` disponível para volume maior.

### 5 — Limites (gastos por categoria)
```
GroupAggregate  (cost=62.68..62.73 rows=3 width=52) (actual time=0.438..0.458 rows=18 loops=1)
  Group Key: c.id
  ->  Hash Right Join  (cost=22.73..62.65 rows=3 width=52)
        Hash Cond: (t.category_id = c.id)
        ->  Bitmap Heap Scan on transacoes t  (cost=5.20..44.93 rows=72 width=12)
              Recheck Cond: (type = 'expense' AND transaction_date >= ... AND transaction_date <= ...)
              ->  Bitmap Index Scan on idx_transacoes_type_date
                    Index Cond: (type = 'expense' AND transaction_date >= ... AND transaction_date <= ...)
Execution Time: 0.598 ms
```

## Como reproduzir
```sh
# No container financas-api (tem asyncpg + acesso à rede do db):
docker cp explain.py financas-api:/tmp/explain.py
docker exec financas-api /app/.venv/bin/python /tmp/explain.py
```
O script em `explain.py` contém as 5 consultas representativas (espelhando os repositórios: `DashboardRepository.extrato_financeiro`, `ContaRecorrenteRepository`, `GoalRepository`, `LimitsRepository`).

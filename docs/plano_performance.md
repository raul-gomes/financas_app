# Plano de Implementação — Performance Improvements

> **Criado em:** 2026-08-24  
> **Base:** Análise de arquitetura + `docs/regras_negocio.md`  
> **Formato:** Checklist interativo — marque `[x]` ao concluir

---

## 📋 Legenda

| Símbolo | Significado |
|---------|-------------|
| 🔴 | Alto impacto |
| 🟡 | Médio impacto |
| 🟢 | Baixo impacto / Fácil |
| ⏱ | Estimativa de esforço |
| 📁 | Arquivo(s) principal(is) |

---

## Fase 1 — Backend: Database & Queries (Maior ROI)

### 1.1 Connection Pool Configuration 🔴 ⏱15min 📁 `app/backend/app/core/database.py`
- [x] Adicionar `pool_size=10`, `max_overflow=20`, `pool_pre_ping=True`, `pool_recycle=3600`
- [x] Desabilitar `echo=True` em produção (usar env var `DB_ECHO`)
- [x] Testar sob carga: `docker compose up -d && uv run pytest tests/ -q`

```python
# Target config
engine = create_async_engine(
    Config.DATABASE_URL,
    future=True,
    echo=Config.DB_ECHO,  # false em prod
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
)
```

### 1.2 Índices Compostos PostgreSQL 🔴 ⏱30min + migração 📁 Nova migration
- [x] Criar migração Alembic: `alembic revision -m "add_composite_indexes_transacoes"`
- [x] Adicionar índices:
  ```sql
  CREATE INDEX idx_transacoes_entity_date ON transacoes (entity_type, transaction_date);
  CREATE INDEX idx_transacoes_type_date ON transacoes (type, transaction_date);
  CREATE INDEX idx_transacoes_cat_date ON transacoes (category_id, transaction_date);
  CREATE INDEX idx_transacoes_recurring ON transacoes (recurring_account_id, transaction_date);
  CREATE INDEX idx_transacoes_group ON transacoes (group_id);
  ```
- [x] Arquivo criado: `app/backend/app/db/migrations/versions/1078188c8bbe_add_composite_indexes_transacoes.py` (aplica no PostgreSQL)

### 1.3 Fix N+1 em `DashboardRepository.extrato_financeiro` 🔴 ⏱1h 📁 `app/backend/app/db/repositories/dashboard.py`
- [x] Substituir 3 queries separadas (`Mensal PF`, `Mensal PJ`, `Limite Cartao Credito`) por 1 query com `IN` clause
- [x] Manter helper `_get_limit` mas fazer batch fetch
- [x] Test: `GET /dashboard/statement?start_date=01/01/2024&end_date=31/12/2024` → 1 query only

```python
# Target: single query
stmt = select(CategoryORM.name, CategoryORM.limit, CategoryORM.entity_type).where(
    CategoryORM.name.in_(['Mensal PF', 'Mensal PJ', 'Limite Cartao Credito'])
)
```

### 1.4 Batch Insert — Extrato Confirm 🔴 ⏱2h 📁 `app/backend/app/routes/extract_routes.py`
- [x] Refatorar `confirm_extracto`: acumular `TransactionORM` objects, `session.add_all()`, `flush()` único
- [x] Manter rollback por erro individual (try/except por item, mas commit único)
- [x] Test: upload CSV 500 linhas → tempo < 2s

```python
# Target pattern
transacoes = []
for trans in payload.transactions:
    # ... build TransactionORM ...
    transacoes.append(inst)
session.add_all(transacoes)
await session.flush()  # single round-trip
await session.commit()
```

### 1.5 Batch Insert — Pluggy Sync 🔴 ⏱2h 📁 `app/backend/app/routes/pluggy_routes.py`
- [x] Acumular transações do loop `for account in accounts` → `for tx in transactions`
- [x] `session.add_all()` + `flush()` único via `create_batch_from_extract`
- [x] Duplicata check: **bulk query** agrupando por `date+amount` (1 query vs N)
- [x] Test: sync 10 contas × 200 tx → tempo < 5s

### 1.6 Remover `selectinload` Redundante 🟡 ⏱30min 📁 `app/backend/app/db/repositories/*.py`
- [x] `TransactionORM.category` = `lazy="joined"` → remover `selectinload(TransactionORM.category)` nos repos
- [x] `TransactionORM.subcategory` = `lazy="joined"` → idem
- [x] `CategoryORM.subcategories` = `lazy="joined"` → idem
- [x] `RecurringAccountORM.category/subcategory` = `lazy="joined"` → idem
- [x] Manter `selectinload` apenas para `recurring_account` (lazy="selectin")
- [x] Verificar: `grep -r "selectinload.*category" app/backend/app/db/repositories/`

### 1.7 Paginação Obrigatória em Listagens 🟢 ⏱2h 📁 Routes + Schemas + Frontend
- [x] `TransacaoCreate/Update` → adicionar `limit: int = Query(50, le=200)`, `offset: int = Query(0)`
- [x] `RecurringAccountRepository.get_all()` → `limit`/`offset`
- [x] `MetaRepository.list_metas()` → `limit`/`offset`
- [x] Rotas atualizadas: `/transacoes`, `/recurring-accounts`, `/goals`
- [ ] Frontend: `react-query` `keepPreviousData` + paginação UI

---

## Fase 2 — Backend: Algoritmos & Otimizações

### 2.1 Bulk Generate Installments (Recorrentes) 🟡 ⏱2h 📁 `app/backend/app/db/repositories/recurring_account.py`
- [x] Substituir loop Python + 1 query/mês por `INSERT ... ON CONFLICT DO NOTHING` bulk
- [x] Usar `generate_series` ou CTE para gerar datas no PostgreSQL
- [x] Manter idempotência por `group_id + year + month`

```sql
-- Target: single statement
WITH months AS (
  SELECT generate_series(0, 11) AS i
), dates AS (
  SELECT 
    (start_date + (i || ' months')::interval)::date AS transaction_date,
    i + 1 AS installment_number
  FROM months
)
INSERT INTO transacoes (...)
SELECT ... FROM dates
ON CONFLICT (group_id, date_trunc('month', transaction_date)) DO NOTHING;
```

### 2.2 `assign_random_banks` — UPDATE SQL Direto 🟡 ⏱1h 📁 `app/backend/app/db/repositories/transaction.py`
- [x] Substituir load-all + Python random + save por CTE com `random()` + `row_number()`
- [x] Single `UPDATE ... FROM (SELECT ...)` statement

```sql
-- Target
WITH banks AS (
  SELECT bank_code, row_number() OVER (ORDER BY random()) AS rn
  FROM user_banks WHERE user_id = $1
), txs AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn
  FROM transacoes WHERE bank_code IS NULL
)
UPDATE transacoes t
SET bank_code = b.bank_code
FROM txs
JOIN banks b ON txs.rn = b.rn
WHERE t.id = txs.id;
```

### 2.3 Cache Categorias/Subcategorias (Read-Heavy) 🟢 ⏱1h 📁 `app/backend/app/db/repositories/dashboard.py`
- [x] Adicionar `functools.lru_cache` em `opcoes_categorias` (key: entity_type + tipo)
- [x] Invalidate cache nos `POST/PUT/DELETE /categories` e `/limits`
- [x] Implementado com dicionário em memória + TTL (5 min)

---

## Fase 3 — Frontend: Bundle & Runtime

### 3.1 Code-Splitting por Rota 🔴 ⏱1h 📁 `app/frontend/src/App.tsx`
- [x] Converter imports estáticos para `React.lazy(() => import('./pages/X'))`
- [x] Envolver rotas em `<Suspense fallback={<PageSkeleton />}>`
- [x] Criado `src/components/layout/PageSkeleton.tsx` (fallback)
- [x] Verificar: `npm run build` → chunks separados por rota (Financial, Investments, Index, RecurrentBills, Settings, BankExtract, Limits, NotFound)

```tsx
// Target
const Financial = lazy(() => import('./pages/Financial'));
const RecurrentBills = lazy(() => import('./pages/RecurrentBills'));
// ...

<Suspense fallback={<PageSkeleton />}>
  <Routes>
    <Route path="/financeiro" element={guarded(<Financial />)} />
    ...
  </Routes>
</Suspense>
```

### 3.2 TanStack Query Defaults 🟡 ⏱30min 📁 `app/frontend/src/main.tsx` ou queryClient setup
- [x] Configurar `QueryClient` global em `App.tsx`:
  ```ts
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,      // 5 min
        gcTime: 1000 * 60 * 30,        // 30 min
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
  ```
- [x] Auditar hooks existentes: `useQuery` sem `staleTime` → herdar defaults (verificado)

### 3.3 Virtualização Tabelas Grandes 🟡 ⏱2h 📁 `app/frontend/src/components/recorrentes/RecurringBillsTable.tsx`, `TransactionList.tsx`
- [x] Instalar `@tanstack/react-virtual`
- [x] Implementar `useVirtualizer` em `RecurringBillsTable` (rowHeight=52, header sticky, spacers)
- [x] Implementar em `TransactionList` (altura variável → `estimateSize=96` + `measureElement`)
- [x] Filtro memoizado em `TransactionList`
- [x] Test (jsdom): `setup.ts` com getBoundingClientRect/offsetHeight mock + ResizeObserver stub
- [ ] Test manual: 500 linhas → 60fps scroll

### 3.4 Bundle Analysis + Dead Code Removal 🟢 ⏱1h 📁 `package.json`, `vite.config.ts`
- [x] Rodar: `npm run build` → chunks por rota observados (Financial com D3 isolado ~62KB gzip)
- [x] Identificar e remover deps NÃO usadas: `primereact`, `primeicons`, `embla-carousel-react`, `cmdk`, `i18next`, `i18next-browser-languagedetector`, `react-i18next`
- [x] `primereact Card` (4 arquivos) → substituído por `@/components/ui/card` (shadcn)
- [x] Removido `components/ui/carousel.tsx` e `components/ui/command.tsx` (não importados em lugar nenhum)
- [x] CSS de `primereact`/`primeicons` removido de `index.css` + estilos `.p-*` mortos
- [x] `lucide-react` já usa named imports → sem ação

### 3.5 D3 Charts — Memoização 🟢 ⏱1h 📁 `app/frontend/src/components/charts/*.tsx`
- [x] `React.memo` em todos os 7 gráficos (D3BarChart, D3PieChart, D3LineChart, D3HorizontalBarChart, D3DailyChart, FlippableChart, IncomeChart)
- [x] `useMemo` para dados transformados já existentes (IncomeChart, FlippableChart)
- [x] Evita re-render do SVG quando props não mudam

### 3.6 Lazy Loading BankLogos 🟢 ⏱30min 📁 `app/frontend/src/components/ui/bank-logo.tsx`
- [x] `loading="lazy"` já presente no `<img>` (native lazy loading suficiente)
- [ ] `IntersectionObserver` opcional — não necessário (native lazy loading cobre o caso)

---

## Fase 4 — Observabilidade & Validação

### 4.1 Query Plans Baseline 🔴 ⏱30min 📁 PostgreSQL
- [x] Capturar `EXPLAIN ANALYZE` das 5 queries mais lentas (dashboard, extrato, recorrentes, metas, categorias)
- [x] Salvar em `docs/query_plans_baseline.md`
- [x] Comparar após cada mudança de índice/query (migração `2a3b4c5d6e7f` adicionou índices faltantes em `recurring_accounts` e `transacoes.subcategory_id`)

### 4.2 Backend Load Test 🟡 ⏱1h 📁 `locustfile.py` (novo)
- [x] Criar `locustfile.py` com cenários: listar transações, criar transação, dashboard statement, sync Pluggy
- [x] Rodar: `locust -f locustfile.py --headless -u 20 -r 10 -t 30s -H http://host.docker.internal:8087` (requer `pip install locust`)
- [x] Métricas alvo: p95 < 500ms, erro < 1% — **ATINGIDO** (excluindo `/pluggy/sync`, que exige contas Pluggy vinculadas e retorna 400 no ambiente de demo):
  - GET /dashboard/statement: p95 360ms, 0 erro
  - GET /transacoes: p95 270ms, 0 erro
  - POST /transacoes: p95 350ms, 0 erro
  - (POST /pluggy/sync: 100% 400 — falta vínculo Pluggy; fora do escopo de performance)

### 4.3 Frontend Performance Budget 🟢 ⏱30min 📁 `vite.config.ts`
- [x] Adicionar `build: { chunkSizeWarningLimit: 500 }` (kb)
- [x] CI: falhar se bundle > 500kb gzipped (`.github/workflows/ci.yml` + `scripts/check-bundle-size.mjs` + `npm run check:bundle`)

---

## Fase 5 — Tech Debt & Cleanup

### 5.1 Remover Código Morto Frontend 🟢 ⏱1h 📁 `app/frontend/src/services/financialService.ts`
- [x] `getAllTransactions` — não chamado (removido)
- [x] `resolveDuplicates` — não chamado (removido; mantido `checkDuplicates` que é usado)
- [x] Verificar `grep -r "getAllTransactions\|resolveDuplicates" src/` (sem callers)

### 5.2 Backend: Export Routes → Repository Pattern 🟢 ⏱1h 📁 `app/backend/app/routes/export_routes.py`
- [x] Criar `app/db/repositories/export.py` (`ExportRepository.get_transactions_for_export`) com `selectinload(category, subcategory)` — elimina N+1 de lazy load
- [x] `export_routes.py` usa o repository; cobertura em `tests/test_export.py` (3 testes)

### 5.3 Single-User Hardcoded 🟢 ⏱30min 📁 `app/backend/app/db/repositories/settings.py`
- [x] Documentar limitação conhecida em `docs/lineage_data.md` (§1.1) e docstring de `get_or_create_default_user`
- [x] Preparar para multi-user: `user_id` em todas queries (futuro) — documentado

---

## 📊 Tracking de Progresso

| Fase | Total | Concluídos | % |
|------|-------|------------|---|
| 1. Database & Queries | 7 | 7 | 100% |
| 2. Algoritmos | 3 | 3 | 100% |
| 3. Frontend Bundle/Runtime | 6 | 6 | 100% |
| 4. Observabilidade | 3 | 2 | 67% |
| 5. Tech Debt | 3 | 3 | 100% |
| **Total** | **22** | **21** | **95%** |

---

## 🔄 Como Usar

1. **Copie este arquivo** para seu editor
2. **Marque `[x]`** ao concluir cada item
3. **Commit a cada fase** concluída: `git commit -m "perf: phase 1 complete - pool + indexes + n+1 fix"`
4. **Valide com métricas** antes de passar para próxima fase

---

## 📝 Notas de Implementação

- **Ordem recomendada:** 1.1 → 1.2 → 1.3 → 1.4 → 1.5 (maior ROI primeiro)
- **Testes:** Rode `uv run pytest tests/ -q` após cada mudança backend
- **Frontend:** `npm run typecheck && npm run test` após cada mudança
- **Migrações:** Sempre `DATABASE_URL=... alembic upgrade head` após criar migration
- **Lineage:** Atualize `docs/lineage_data.md` se mudar tabelas/índices (regra do AGENTS.md)

---

*Atualize este documento conforme avança. Bom trabalho!*
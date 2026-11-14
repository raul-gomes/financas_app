# Plano de Implementação — Autenticação + Isolamento de Dados + Roles

> **Criado em:** 2026-08-25
> **Atualizado em:** 2026-09-03 (Etapas 1–9 concluídas: auth + isolamento de dados por usuário + roles multi-role aplicadas nas rotas admin)
> **Base:** App single-user atual (`get_or_create_default_user`). Modelo de role: coluna `role` (string, default `"user"`) — substitui a coluna `is_admin` legada.
> **Objetivo:** introduzir auth real (Supabase), isolamento de dados por usuário e roles server-side, em etapas incrementais com TDD.
> **Convenção:** Cada etapa segue TDD (RED → GREEN → REFACTOR) e é entregue independentemente.

---

## Decisões / Premissas

- [x] **Supabase Cloud** (`supabase.com`) para autenticação. Env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`.
- [x] Fase 1: apenas **email/senha** (signUp, signInWithPassword, resetPasswordForEmail). Sem OAuth ainda.
- [x] Roles: usa coluna `role` (String, enum: `admin`, `user`, futuramente `manager`, `viewer`, etc.) na tabela `users` — PRONTO PARA MULTI-ROLE. A coluna `is_admin` legada foi migrada para `role` na Etapa 9 (`e3f4a5b6c7d8`; `is_admin=true→'admin'`, `false→'user'`, bool removida).
  - **A autorização é decidida SÓ no servidor**, a partir da coluna `role` no banco (resolvida pelo `sub` do JWT) — nunca a partir de dados enviados pelo cliente. `role` não é aceito no corpo de nenhuma request (schemas Pydantic não o expõem).
- [x] **Isolamento de dados:** toda tabela ganha `user_id` FK, dados existentes migram pro usuário default.
- [x] **TDD obrigatório:** cada etapa tem testes antes da implementação.

## Libs necessárias

- [x] Frontend: `@supabase/supabase-js` (`npm install @supabase/supabase-js`)
- [x] Backend: `PyJWT` (`uv add pyjwt` — adicionado ao pyproject.toml, pendente `uv lock`)

---

## Pré-requisitos (Supabase Cloud)

- [ ] Criar projeto no supabase.com → anotar `Project URL`, `anon key`, `JWT Secret` (Settings → API)
- [ ] Authentication → Providers → habilitar **Email**
- [ ] Authentication → URL Configuration → Site URL: `http://localhost:8087`
- [ ] Authentication → URL Configuration → Redirect URLs: incluir `**/redefinir-senha`
- [ ] `.env` raiz: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`
- [ ] `app/frontend/.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## Etapa 1 — Auth Backend (JWT verification)

**Objetivo:** Backend verifica token Supabase e extrai o usuário.

- [x] 1.1 Adicionar `SUPABASE_JWT_SECRET` em `app/backend/app/core/config.py`
- [x] 1.2 Criar `app/backend/app/core/security.py` com `get_current_user(token)` — decodifica JWT HS256, extrai `sub` + `email`
- [x] 1.3 Criar `app/backend/app/db/repositories/users.py` com `get_or_create_user_from_supabase(sub, email)` — upsert na tabela `users`
- [x] 1.4 Criar `bearer_scheme` em `security.py` (HTTPBearer) — rotas importam de lá
- [x] 1.5 **TESTE:** `tests/test_security.py` — JWT válido retorna `UserORM`; token inválido/expirado → 401
- [x] 1.5b **TESTE:** `tests/test_users_repository.py` — upsert cria usuário, retorna existente, não duplica
- [x] 1.6 Rodar `uv run pytest tests/test_security.py tests/test_users_repository.py -v` e validar

---

## Etapa 2 — Auth Frontend (login/sessão/token)

**Objetivo:** Usuário faz login, frontend envia token em toda chamada API.

- [x] 2.1 Criar `app/frontend/src/lib/supabase.ts` — cliente Supabase
- [x] 2.2 Criar `app/frontend/src/lib/api.ts` — `apiFetch()` com `Authorization: Bearer`
- [x] 2.3 Criar `app/frontend/src/contexts/AuthContext.tsx` — `useSession()` com `onAuthStateChange`
- [x] 2.4 Refatorar services para usar `apiFetch`: `settingsService.ts`, `financialService.ts`, `recurringAccountService.ts`, `limitsService.ts`, `goalsService.ts`, `extractService.ts`
- [x] 2.5 **TESTE:** `AuthContext.test.tsx` — mock Supabase, verifica `useSession()` retorna `session`/`user`/`loading`
- [x] 2.6 **TESTE:** `api.test.ts` — mock `getSession`, verifica header `Authorization` em `apiFetch`
- [x] 2.7 Rodar `npm run test` e validar

---

## Etapa 3 — Telas de Auth + Guard

**Objetivo:** Telas de login/cadastro/senha e proteção de rotas autenticadas.

- [x] 3.1 Criar `src/pages/Login.tsx` — email/senha → `supabase.auth.signInWithPassword`
- [x] 3.2 Criar `src/pages/SignUp.tsx` — `supabase.auth.signUp`
- [x] 3.3 Criar `src/pages/ForgotPassword.tsx` — `supabase.auth.resetPasswordForEmail`
- [x] 3.4 Criar `src/pages/UpdatePassword.tsx` — `supabase.auth.updateUser`
- [x] 3.5 Criar `src/components/auth/AuthGuard.tsx` — redireciona `/login` sem sessão
- [x] 3.6 Atualizar `App.tsx` — novas rotas `/login`, `/cadastro`, `/esqueci-senha`, `/redefinir-senha`; `AuthGuard` nas rotas protegidas
- [x] 3.7 **TESTE:** `AuthGuard.test.tsx` — sem sessão redireciona; com sessão renderiza
- [x] 3.8 **TESTE:** `Login.test.tsx` — formulário chama `signInWithPassword`
- [x] 3.9 Rodar `npm run test` e validar

---

## Etapa 4 — Backend: proteger todas as rotas

**Objetivo:** Sem token válido → 401 em toda rota `/api/*`.

- [x] 4.1 Adicionar `Depends(get_current_user)` em: `transactions_routes.py`
- [x] 4.2 Adicionar `Depends(get_current_user)` em: `categories_routes.py`
- [x] 4.3 Adicionar `Depends(get_current_user)` em: `dashboard_routes.py`
- [x] 4.4 Adicionar `Depends(get_current_user)` em: `limits_routes.py`
- [x] 4.5 Adicionar `Depends(get_current_user)` em: `recurring_accounts_routes.py`
- [x] 4.6 Adicionar `Depends(get_current_user)` em: `extract_routes.py`
- [x] 4.7 Adicionar `Depends(get_current_user)` em: `goals_routes.py`
- [x] 4.8 Adicionar `Depends(get_current_user)` em: `shopping_routes.py`
- [x] 4.9 Adicionar `Depends(get_current_user)` em: `export_routes.py`
- [x] 4.10 Substituir `get_or_create_default_user()` por `user` do Depends em: `settings_routes.py`, `pluggy_routes.py`
- [x] 4.11 **TESTE:** cada rota sem header → 401; com token válido → 200
- [x] 4.12 Rodar `uv run pytest` e validar

---

## Etapa 5 — Isolamento: `categorias` + `subcategorias`

**Objetivo:** Cada usuário vê só suas categorias e subcategorias.

> **Decisão (híbrida):** `user_id` é adicionado apenas em `categorias` (ponto único de isolamento). `subcategorias` NÃO ganha coluna `user_id` — é isolada transitivamente via JOIN com a categoria pai. Isso evita coluna duplicada e risco de desync, mantendo a mesma garantia de segurança.

- [x] 5.1 Migration: adicionar `user_id` FK NOT NULL em `categorias` + índice
- [x] 5.2 Migration: **N/A (híbrido)** — `subcategorias` não recebe `user_id`, é isolada via categoria pai
- [x] 5.3 Migration: `UPDATE categorias SET user_id = 1;` (dados existentes) + trocar unicidade `(name, entity_type)` → `(name, entity_type, user_id)`
- [x] 5.4 Atualizar `app/db/models/category.py` — adicionar coluna `user_id` + UniqueConstraint tripla
- [x] 5.5 Atualizar `app/db/repositories/category.py` — adicionar `user_id` em: `get_all()`, `get_by_id()`, `get_by_nome()`, `get_by_nome_and_entity_type()`, `get_by_tipo()`, `create()`, `update()`, `delete()`
- [x] 5.6 Atualizar `app/db/repositories/subcategory.py` — isolar queries via `category.has(user_id=...)` (JOIN com a categoria pai)
- [x] 5.7 Atualizar `routes/categories_routes.py` — extrair `user.id` do JWT e passar pro repository
- [x] 5.8 Atualizar `app/db/repositories/dashboard.py` — adicionar `user_id` nos JOINs/filtros de categorias (`opcoes_categorias`, `rendimento_por_periodo`, `extrato_financeiro`)
- [x] 5.9 Atualizar `app/db/repositories/limits.py` — adicionar `user_id` nos filtros (`bulk_update_limits`, `get_all_limits`, `get_limits_with_spending`)
- [x] 5.10 Atualizar `app/db/repositories/goal.py` — adicionar `user_id` nos filtros (metas via categoria `Metas`)
- [x] 5.11 **TESTE:** `test_category_isolation.py` — categorias com user 1 e user 2, verificar isolamento (CRUD + unicidade por usuário)
- [x] 5.12 **TESTE:** `test_category_isolation.py` — subcategorias inacessíveis entre usuários (via categoria pai)
- [x] 5.13 Rodar `uv run pytest` e validar (163 passando)

---

## Etapa 6 — Isolamento: `transacoes`

**Objetivo:** Cada usuário vê só suas transações.

- [x] 6.1 Migration: adicionar `user_id` FK NOT NULL em `transacoes` + índice
- [x] 6.2 Migration: `UPDATE transacoes SET user_id = 1;` (dados existentes)
- [x] 6.3 Atualizar `app/db/models/transaction.py` — adicionar coluna `user_id`
- [x] 6.4 Atualizar `app/db/repositories/transaction.py` — adicionar `user_id` em: `get_all()`, `get_by_id()`, `check_duplicates()`, `create()`, `update()`, `delete()`, `assign_random_banks()`, `create_batch_from_extract()`, `create_from_extract()`
- [x] 6.5 Atualizar `routes/transactions_routes.py` — extrair `user.id` do JWT (também em `check-duplicates` e `resolve-duplicates`)
- [x] 6.6 Atualizar `app/db/repositories/dashboard.py` — `extrato_financeiro()`, `gastos_por_categoria()`, `rendimento_por_periodo()`, `entradas_por_categoria()` com `user_id`
- [x] 6.7 Atualizar `app/db/repositories/export.py` — `get_transactions_for_export()` com `user_id` (+ rotas `export-routes`)
- [x] 6.8 **TESTE:** `test_transaction_isolation.py` — transações com user 1 e user 2, verificar isolamento (list, get by id, update, delete, extrato, export)
- [x] 6.9 **TESTE:** verificação de duplicatas respeita `user_id`
- [x] 6.10 Rodar `uv run pytest` e validar (170 passando)

> **Nota (bonus necessário):** como `transacoes.user_id` virou NOT NULL, também foi feita scoping em `settings_routes.py`/`pluggy_routes.py` (que criam/checam transações) e em `ContaRecorrenteRepository` (gera transações com `user_id`); o seed passa a preencher `user_id`.

---

## Etapa 7 — Isolamento: `recurring_accounts`

**Objetivo:** Cada usuário vê só suas contas recorrentes.

- [x] 7.1 Migration: adicionar `user_id` FK NOT NULL em `recurring_accounts` + índice
- [x] 7.2 Migration: `UPDATE recurring_accounts SET user_id = 1;` (dados existentes)
- [x] 7.3 Atualizar `app/db/models/recurring_account.py` — adicionar coluna `user_id`
- [x] 7.4 Atualizar `app/db/repositories/recurring_account.py` — adicionar `user_id` em todas as queries
- [x] 7.5 Atualizar `routes/recurring_accounts_routes.py` — extrair `user.id` do JWT
- [x] 7.6 Garantir que `generate_pending_transactions()` mantém `user_id` nas transações geradas
- [x] 7.7 **TESTE:** `test_recurring_account_isolation.py` — isolamento por user_id (list, get by id, update, delete, renew)
- [x] 7.8 **TESTE:** geração de transações a partir de recorrentes mantém `user_id`
- [x] 7.9 Rodar `uv run pytest` e validar (176 passando)

---

## Etapa 8 — Isolamento: `shopping_items`

**Objetivo:** Cada usuário vê só sua lista de compras.

- [x] 8.1 Migration: adicionar `user_id` FK NOT NULL em `shopping_items` + índice
- [x] 8.2 Migration: `UPDATE shopping_items SET user_id = 1;` (dados existentes)
- [x] 8.3 Atualizar `app/db/models/shopping_item.py` — adicionar coluna `user_id`
- [x] 8.4 Atualizar `app/db/repositories/shopping.py` — adicionar `user_id` em todas as queries
- [x] 8.5 Atualizar `routes/shopping_routes.py` — extrair `user.id` do JWT
- [x] 8.6 **TESTE:** `test_shopping_isolation.py` — isolamento por user_id (list, update, delete)
- [x] 8.7 Rodar `uv run pytest` e validar (180 passando)

---

## Etapa 9 — Roles: proteção server-side (modelo `role` multi-role)

**Objetivo:** Rotas admin retornam 403 para não-admin, usando o novo modelo `role` (string enum) pronto para múltiplas roles.

- [x] 9.0 Migração de schema: substituir `is_admin` Bool por `role` String(32) em `users`
  - `ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'user';`
  - `UPDATE users SET role = 'admin' WHERE is_admin = TRUE;` → depois `UPDATE users SET role = 'user' WHERE is_admin = FALSE;`
  - Dropar a coluna `is_admin`
  - **Remover o `server_default=true` perigoso** — novo cadastro nasce `role='user'` no `get_or_create_user_from_supabase` (sem bootstrap admin; admin só por promoção manual no banco).
- [x] 9.1 Atualizar `app/db/models/user.py` — `role: Column(String(32), nullable=False, server_default='user')` no lugar de `is_admin`
- [x] 9.2 Criar `require_role(*roles)` em `app/backend/app/core/security.py` — checa `user.role in roles`, senão 403 (genérico p/ multi-role; mantém helper `require_admin = require_role("admin")`)
- [x] 9.3 Atualizar schemas/frontend: `ProfileResponse` e `RoleContext` usam `role` (string) em vez de `is_admin` (bool)
- [x] 9.4 Aplicar `Depends(require_admin)` em: `pluggy_routes.py`
- [x] 9.5 Aplicar `Depends(require_admin)` em: `export_routes.py`
- [x] 9.6 Aplicar `Depends(require_admin)` em: `shopping_routes.py`
- [x] 9.7 Aplicar `Depends(require_admin)` em: `goals_routes.py`
- [x] 9.8 Aplicar `Depends(require_admin)` em: `recurring_accounts_routes.py`
- [x] 9.9 Aplicar `Depends(require_admin)` em: `extract_routes.py`
- [x] 9.10 **TESTE:** `test_security.py` — `require_role("admin")` com `role='admin'` passa; `role='user'` → 403
- [x] 9.11 **TESTE:** `test_admin_guard.py` — cada rota admin com user `role='user'` → 403
- [x] 9.12 **TESTE:** `test_users_repository.py` — upsert novo vira `role='user'` (sem bootstrap admin); usuários subsequentes também `'user'`
- [x] 9.13 Rodar `uv run pytest` e validar (193 passando; frontend typecheck ok)

> **Nota:** com a decisão de "sumir com essas features no deploy", pluggy/export/shopping/goals/extract são **admin-only** e `recurring-accounts` inteiro foi admin-only — depois foi liberado para `role='user'` o CRUD de recorrentes (aba Recorrentes em Limites), exceto o `POST /recurring-accounts/generate` (continua admin). Nos testes de isolamento das Etapas 5-8, usuários 1 e 2 passaram a ser `role='admin'` (para ainda provarem isolamento de dados entre admins); usuário 3 é `role='user'` (usado no `test_admin_guard.py` para provar 403). Conforme o acesso for liberado por role, remove-se o guard por rota e mantêm-se apenas as Etapas de isolamento por `user_id`.

---

## Etapa 10 — Cleanup + Documentação

**Objetivo:** Limpar código legado e atualizar docs.

- [x] 10.1 Remover `get_or_create_default_user()` de `app/db/repositories/settings.py`
- [x] 10.2 Atualizar `app/db/repositories/settings.py` — `get_profile()` usa `user` do JWT
- [x] 10.3 Atualizar `docs/lineage_data.md` — novas colunas `user_id`, dependências
- [x] 10.4 Atualizar `docs/arvore_arquivos.md` — novos arquivos (security.py, users.py, AuthContext, RoleContext)
- [x] 10.5 Rodar `uv run pytest` e `npm run test` completos (193 backend + 68 frontend passing)
- [x] 10.6 Rodar `npm run typecheck` no frontend (ok)

---

## Riscos / Notas

- **single-user → multi-user:** autenticar é fácil; isolar dados por `user_id` é o trabalho grande. Cada etapa de isolamento é entregue independentemente.
- **`role` bootstrap:** todo novo cadastro nasce `role='user'`; admin só através de promoção manual no banco (`UPDATE users SET role='admin' WHERE email=...`). Nunca confiar em `role` vindo do cliente — só da coluna no banco, resolvida pelo `sub` do JWT.
- **Token expirado:** `onAuthStateChange` + `supabase.auth.refreshSession()` tratam o refresh; o `apiFetch` deve reler a sessão a cada chamada.
- **Redirect URLs:** devem bater exatamente com o configurado no Supabase (incluindo porta).
- **Alembic:** `alembic.ini` defaults para SQLite — sempre passar `DATABASE_URL` env var ao rodar migrations manualmente.

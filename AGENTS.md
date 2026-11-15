# AGENTS.md — financas_app

## General practices live in the second brain

Cross-project rules (TDD, security, CI quality, API contract/BFF, code language,
git flow, living docs) are **not repeated here**. Read
`~/HD_Repos/cerebro/20_Praticas/Praticas-Essenciais.md` (mandatory summary) and the
topic notes in `~/HD_Repos/cerebro/20_Praticas/` — mainly `TDD-e-Testes.md`,
`Seguranca.md` and `Contrato-de-API.md`. Step-by-step guides:
`~/HD_Repos/cerebro/30_Playbooks/`. No access to that path? Same vault at the
private repo `github.com/raul-gomes/cerebro`. **This file only holds what is
specific to this project and wins on conflict.**

## Folder Structure

> For the complete file tree with function descriptions, see: `docs/arvore_arquivos.md`
>
> **IMPORTANT**: Whenever a new file, function, or component is created or removed, update `docs/arvore_arquivos.md` to keep the tree in sync.

## Data Lineage

> For the complete data lineage (sources → transformations → tables → consumers), see: `docs/lineage_data.md`
>
> **IMPORTANT**: Whenever there is ANY database change — new/changed ORM model (`app/db/models/`), new Alembic migration (`app/db/migrations/versions/`), or a repository/route/service that starts reading/writing different tables — update `docs/lineage_data.md` in the same change (tables catalog, route→table matrix, flow graph, migration history, and its "Última atualização" date).

## Operational Docs

> - `docs/comandos.md`: every useful command to run the project (update it whenever you use, create or change a command, in the same commit).
> - `docs/pendencias.md`: open pending items and technical debt (add newly found items, mark the ones you finish).

## Design System & Componentes

> For the component catalog and design tokens, see: `docs/components.md`
>
> **IMPORTANT**:
> - **Sempre reutilize** os componentes existentes (`src/components/ui/` e compostos documentados) antes de escrever UI nova — nunca duplique primitivos (input, select, dialog, table etc.).
> - Todo modal novo deve usar `ResponsiveModal` (não `Dialog`/`DialogContent` direto).
> - Se, ao implementar algo, surgir um pedaço de UI que pode virar componente reutilizável, **crie o componente** na pasta apropriada (`ui/` para genéricos, `components/<domínio>/` para padrões de negócio) e **atualize `docs/components.md` na mesma mudança**.
> - Use apenas os design tokens (`primary`, `success`, `warning`, `destructive`, gradientes) — nunca hardcode cores.

## Architecture

- **Monorepo**: `app/backend/` (FastAPI, Python 3.12) + `app/frontend/` (Vite, React 18, TypeScript)
- **Database**: PostgreSQL (relational: categorias, transacoes)
- **Infra**: `infra/nginx.conf` (reverse proxy — only public-facing service)
- **Docker**: root `docker-compose.yml` runs all services (dev); `docker-compose-prod.yml` is the production stack (TLS via `infra/nginx.prod.conf.template`, frontend image `nginx-unprivileged` on 8080).

## Services & Ports

| Service | Port | Access | Notes |
|---------|------|--------|-------|
| Nginx | 8087 | **External** | Only public entry point |
| PostgreSQL | 5436 (host) → 5432 | Loopback only (`127.0.0.1`) | credentials from `.env` (no defaults), db: `financas` |
| Backend API | 8000 | Internal | FastAPI, proxied via nginx `/api/` |
| Frontend | 8080 | Internal | Vite dev server, proxied via nginx `/` |

## Developer Commands

### Full stack (Docker)
```sh
docker compose up -d --build   # starts all services from repo root
```

### Backend (local dev)
```sh
cd app/backend
uv sync                        # install deps (uses uv, not pip)
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (local dev)
```sh
cd app/frontend
npm install
npm run dev                    # Vite dev server (default port 8080)
npm run test                   # Vitest (smoke tests, jsdom) — roda no container: docker exec financas-web sh -c "cd /app && npm run test"
npm run typecheck              # tsc -b --noEmit — SEMPRE usar este formato (tsc puro não valida nada num tsconfig solution-style)
```

### Migrations (PostgreSQL via Alembic)
```sh
cd app/backend
DATABASE_URL=postgresql+asyncpg://<usuário>:<senha>@localhost:5436/financas alembic upgrade head
```

## Key Backend Structure

- Entry: `app/backend/app/main.py` — FastAPI app with 12 route modules (all thin: HTTP only)
- Routes: `transactions`, `categories`, `dashboard`, `limits`, `recurring_accounts`, `extract`, `settings`, `goals`, `shopping`, `pluggy`, `export`, `notifications`
- DB layer: `app/db/` — SQLAlchemy async (PostgreSQL)
- Models: `app/db/models/` — 7 ORM models
- Repositories: `app/db/repositories/` — 13 data access classes
- Schemas: `app/schemas/` — Pydantic DTOs
- Services: `app/services/` — one use-case service per domain (`transaction_service.py`, `dashboard_service.py`, `category_service.py`, `limits_service.py`, `goal_service.py`, `shopping_service.py`, `recurring_account_service.py`, `settings_service.py`, `extract_service.py`, `pluggy_sync_service.py`, `notification_service.py`, `export_service.py`, `limit_alert_service.py`), Pluggy HTTP client, extract parsers
- Unit of work: `app/core/unit_of_work.py`; domain errors + their single HTTP mapping: `app/core/errors.py`; route dependencies: `app/routes/dependencies.py`
- Config: `app/core/config.py` — loads env via `python-dotenv`
- Migrations: `app/db/migrations/versions/` — 24 Alembic migrations
- Tests: `tests/` — 60 test files (pytest + pytest-asyncio): routes via `client`, services via `make_uow` (service + `UnitOfWork` over the test session)

## Key Frontend Structure

- Entry: `app/frontend/src/main.tsx` → `App.tsx`
- Pages: `src/pages/` — 8 route pages
- Components:
  - `src/components/ui/` — shadcn-ui primitives (48 files)
  - `src/components/charts/` — D3 chart components
  - `src/components/dialogs/` — Modal/dialog components
  - `src/components/dashboards/` — Dashboard components
  - `src/components/investments/` — Investment components
  - `src/components/layout/` — AppLayout, SidebarPanel
  - `src/components/limits/` — Limits feature tabs
- Services: `src/services/` — 6 API service files
- Types: `src/types/` — TypeScript interfaces
- Hooks: `src/hooks/` — Custom React hooks
- Contexts: `src/contexts/` — SidebarContext

## Layers and unit of work (pattern for new and migrated domains)

Every domain follows it (transactions, overview/dashboard, categories, limits, goals, shopping, recurring accounts, settings/banks, extract import, Pluggy, notifications, export). New code must too.

```
route  ->  service  ->  repository
HTTP       rules +      data access (SQL)
only       authorization
```

- **Route** (`app/routes/*_routes.py`): parses/validates HTTP input (query, body, `DD/MM/YYYY` dates via `parse_date`), calls ONE service method, returns the DTO. No SQL, no business rules, no `user_id` from the client.
- **Service** (`app/services/*_service.py`): built per request from the authenticated user (`get_current_user`) and the request's unit of work/session (see `app/routes/dependencies.py`). Every repository call receives `self.user.id`; admin-only behavior is decided from `user.role` (or the router's `require_admin` guard). Raises domain exceptions (`app/core/errors.py`: `NotFoundError`, `ConflictError`, `ValidationError`, `UnprocessableError`, `ForbiddenError`, `PayloadTooLargeError`, `UpstreamError`, `ServerConfigError`), never `HTTPException`; `register_exception_handlers` (called by `create_app`) is the ONE place that maps them to HTTP, with fixed pt-BR messages (never exception text, SQL or another user's data) and a generic 500 for anything unexpected. The only `HTTPException`s left are the 401/409 of `get_current_user` and the 403 of `require_role` (authentication dependency, not a use case).
- **Repository** (`app/db/repositories/*.py`): queries only, always filtered by `user_id`. Aggregations (`SUM`/`GROUP BY`, filters on user, date range, PF/PJ) run in SQL, never by looping over ORM rows. It `add`/`flush`/`refresh`es but **never commits**.
- **Unit of work** (`get_unit_of_work`, declared `Depends(get_unit_of_work, scope="function")`): one `AsyncSession` per request; it commits once when the handler returns and rolls back when it raises. `scope="function"` makes the commit happen before the response is sent, so a failed commit is a 500, not a lost write. Side effects that need durable data (e.g. limit-alert evaluation, cache invalidation) go through `uow.after_commit(callback)`: best-effort, logged, never undo the write. When one failing item must not abort the whole request (bulk limits update, extract batch insert) run it inside `session.begin_nested()` (a savepoint) and report the failure in the response instead.
- Write routes use the domain's `get_*_service` (unit of work); read-only routes use `get_*_reader` / `get_dashboard_service` / `get_export_service` (plain session, nothing to commit). Reader services must only call their read methods.
- Repositories never take a `commit` flag: they only `add`/`flush`/`refresh`. The only `commit()` calls left outside the unit of work are the identity provisioning of `get_or_create_user_from_supabase` (it runs inside the auth dependency, before any unit of work exists) and `trigger_limit_evaluation` (its own transaction boundary, run after the request commit or by the periodic job).
- Tests: services are tested directly with the `make_uow` fixture (a service + `UnitOfWork` over the test session; see `tests/test_transaction_service.py`, `tests/test_category_service.py`...); the unit of work itself in `tests/test_unit_of_work.py`; the error mapping in `tests/test_domain_errors.py`. SQLite note: pysqlite opens its transaction lazily and would commit a released outermost SAVEPOINT, so a service test that checks rollback after a savepoint does a first write before.

## Frontend data fetching (react-query)

Server data goes through `@tanstack/react-query`, not `useEffect` + `useState`:

- Cache keys come only from `src/lib/queryKeys.ts`; hooks live in `src/hooks/queries/` (one file per domain). Zod parsing stays in the services (`src/services/*`, at the boundary); hooks only call services.
- Lists that page use `useInfiniteQuery` with the backend `next_cursor` ("Carregar mais"). Filters are part of the key.
- After a create/update/delete, invalidate through `useTransactionMutations()` / `invalidateTransactionData` / `invalidateDomain` so every derived screen refetches. Query failures are logged once by `createQueryClient` and surfaced with `useErrorToast`.
- Tests wrap components in `renderWithQuery` (`src/test/queryWrapper.tsx`: retry off) and mock the services.

## Pagination (lists)

List endpoints return a page DTO written by hand with `items`, `total`, `limit`, `has_more`, `next_cursor`. Ordering must be total and stable (e.g. `transaction_date desc, id desc`) and the page size capped by a named constant (`TRANSACTIONS_MAX_PAGE_SIZE`). Reference: `GET /transacoes/paginated` (keyset cursor; its `search` also matches a pt-BR amount and the name of the user's own banks, see `docs/regras_negocio.md` 2.1).

## Development Rules (project specifics)

- **Commit messages are written in English** (Conventional Commits, e.g. `fix(frontend): ...`).
- **TDD** (rule in `cerebro/20_Praticas/TDD-e-Testes.md`): backend tests in `tests/` (pytest + pytest-asyncio, SQLite in-memory via `conftest.py`) — `uv run pytest`; frontend `*.test.tsx`/`*.test.ts` next to the component/service with Vitest + Testing Library (jsdom) — `npm run test` (or in the container); types with `npm run typecheck` (`tsc -b --noEmit`).
- **Security** (rule in `cerebro/20_Praticas/Seguranca.md`): authentication is Supabase (the app stores no passwords); the Pluggy key is encrypted at rest (`app/core/crypto.py`) and never logged; extract uploads (CSV/OFX) with size limits and defensive parsing; only nginx exposed.

## Important Quirks

- **Nginx is the only exposed service** — backend and frontend are internal to Docker network
- **API calls** go through nginx proxy: frontend → `/api/*` → backend
- **Alembic runs on startup** — `docker compose up` automatically applies migrations
- **Alembic URL mismatch**: `alembic.ini` defaults to SQLite — always pass `DATABASE_URL` env var when running alembic manually
- **Backend usa uv, nunca pip**: Dockerfile instala com `uv sync --frozen` (imagem final nem tem pip). Dependências travadas no `uv.lock` — para mudar deps, edite `pyproject.toml` e rode `uv lock` (ou `uv lock --check` para validar). Sem uv no host? Rode via container efêmero: `docker run --rm -v ./app/backend:/app -w /app ghcr.io/astral-sh/uv:python3.12-alpine sh -c "uv sync && DATABASE_URL=sqlite+aiosqlite:///:memory: uv run pytest -q"`
- **Backend lint/format**: ruff (`uv run ruff check .` / `uv run ruff format .`, config in `pyproject.toml`); frontend uses eslint

## Env Vars

Set in `.env` at repo root (copy from `.env.example`):

```
POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
```

## API — Backend for Frontend (MANDATORY)

The rule (one call per screen, derived values and SQL aggregation in the backend,
response schema = screen contract, checklist) is in
`~/HD_Repos/cerebro/20_Praticas/Contrato-de-API.md`. In this project, computed
fields live in the Pydantic schema via `@model_validator(mode='before')` with a
comment naming the screen that reads them (`# Frontend usa: is_ending_soon para badge "Acabando"`),
and repositories return aggregated DTOs.

### Examples in this project (follow this pattern)

| Endpoint | Entrega Pronta | Evita no Frontend |
|----------|----------------|-------------------|
| `GET /dashboard/statement` | `total_income`, `total_expenses`, `monthly_goal`, `credit_card_limit`, `fixed_expenses`, `variable_expenses`, `transactions[]` | 5+ queries + agregações |
| `GET /dashboard/period-income` | `{limit, months: {jan: {income, expense}, ...}}` | GROUP BY 12 meses + busca de limite |
| `GET /goals/progress` | `[{subcategory_id, name, target, current, progress%, completed}]` | JOIN metas + transações + cálculo % |
| `GET /limits/with-spending` | `[{limit, spent, remaining, percent_used, subcategories[]}]` | Cruzar limites + gastos manualmente |
| `GET /recurring-accounts` | `remaining_installments`, `current_installment`, `is_ending_soon` | Calcular parcela atual + badge "Acabando" |

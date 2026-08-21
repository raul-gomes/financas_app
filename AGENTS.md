# AGENTS.md — financas_app

## Folder Structure

> For the complete file tree with function descriptions, see: `docs/arvore_arquivos.md`
>
> **IMPORTANT**: Whenever a new file, function, or component is created or removed, update `docs/arvore_arquivos.md` to keep the tree in sync.

## Data Lineage

> For the complete data lineage (sources → transformations → tables → consumers), see: `docs/lineage_data.md`
>
> **IMPORTANT**: Whenever there is ANY database change — new/changed ORM model (`app/db/models/`), new Alembic migration (`app/db/migrations/versions/`), or a repository/route/service that starts reading/writing different tables — update `docs/lineage_data.md` in the same change (tables catalog, route→table matrix, flow graph, migration history, and its "Última atualização" date).

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
- **Docker**: root `docker-compose.yml` runs all services.

## Services & Ports

| Service | Port | Access | Notes |
|---------|------|--------|-------|
| Nginx | 8087 | **External** | Only public entry point |
| PostgreSQL | 5432 | Internal | user: `postgres`, db: `financas` |
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
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5436/financas alembic upgrade head
```

## Key Backend Structure

- Entry: `app/backend/app/main.py` — FastAPI app with 11 route modules
- Routes: `transactions`, `categories`, `dashboard`, `limits`, `recurring_accounts`, `extract`, `settings`, `goals`, `shopping`, `pluggy`, `export`
- DB layer: `app/db/` — SQLAlchemy async (PostgreSQL)
- Models: `app/db/models/` — 7 ORM models
- Repositories: `app/db/repositories/` — 9 data access classes
- Schemas: `app/schemas/` — Pydantic DTOs
- Services: `app/services/` — Pluggy API client, extract parsers
- Config: `app/core/config.py` — loads env via `python-dotenv`
- Migrations: `app/db/migrations/versions/` — 14 Alembic migrations
- Tests: `tests/` — 12 test files (pytest + pytest-asyncio)

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

## Development Rules

### TDD (Test-Driven Development) — MANDATORY

Every new feature or bug fix MUST follow the TDD cycle:

1. **RED**: Write failing tests first that describe the expected behavior
2. **GREEN**: Write the minimum code to make the tests pass
3. **REFACTOR**: Clean up the code while keeping tests green

- Backend tests: `tests/` (pytest + pytest-asyncio, SQLite in-memory via `conftest.py`) — run with `uv run pytest`
- Frontend tests: Vitest + Testing Library (jsdom) já configurados — coloque `*.test.tsx`/`*.test.ts` ao lado do componente/serviço e rode com `npm run test` (ou via container); valide tipos com `npm run typecheck` (`tsc -b --noEmit`)
- Never deliver a feature without tests covering its core behavior (happy path + edge cases + error handling)
- When fixing a bug, first write a test that reproduces it, then apply the fix

### Security Best Practices — PRIORITY

Always prioritize security when writing code:

- **Never commit secrets** (keys, passwords, tokens) — use `.env` / env vars only
- **Validate all external input** with Pydantic schemas on every endpoint (never trust raw request data)
- **Use parameterized queries** via SQLAlchemy ORM — never build SQL by string concatenation
- **Hash passwords** with bcrypt (see `settings_routes.py`); never store or log plain secrets (e.g., `pluggy_api_key`)
- **Sanitize file uploads** (extract CSV/OFX): enforce size limits, parse defensively, never execute content
- Keep dependencies updated and avoid introducing packages with known vulnerabilities (`npm audit` / `uv lock`)
- Apply least privilege: only expose what is necessary through nginx; backend/DB stay internal

## Important Quirks

- **Nginx is the only exposed service** — backend and frontend are internal to Docker network
- **API calls** go through nginx proxy: frontend → `/api/*` → backend
- **Alembic runs on startup** — `docker compose up` automatically applies migrations
- **Alembic URL mismatch**: `alembic.ini` defaults to SQLite — always pass `DATABASE_URL` env var when running alembic manually
- **Backend usa uv, nunca pip**: Dockerfile instala com `uv sync --frozen` (imagem final nem tem pip). Dependências travadas no `uv.lock` — para mudar deps, edite `pyproject.toml` e rode `uv lock` (ou `uv lock --check` para validar). Sem uv no host? Rode via container efêmero: `docker run --rm -v ./app/backend:/app -w /app ghcr.io/astral-sh/uv:python3.12-alpine sh -c "uv sync && DATABASE_URL=sqlite+aiosqlite:///:memory: uv run pytest -q"`
- **No linter/formatter** configured on backend; frontend uses eslint

## Env Vars

Set in `.env` at repo root (copy from `.env.example`):

```
POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
```

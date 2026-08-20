# AGENTS.md — financas_app

## Folder Structure

> For the complete file tree with function descriptions, see: `docs/arvore_arquivos.md`
>
> **IMPORTANT**: Whenever a new file, function, or component is created or removed, update `docs/arvore_arquivos.md` to keep the tree in sync.

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

## Important Quirks

- **Nginx is the only exposed service** — backend and frontend are internal to Docker network
- **API calls** go through nginx proxy: frontend → `/api/*` → backend
- **Alembic runs on startup** — `docker compose up` automatically applies migrations
- **Alembic URL mismatch**: `alembic.ini` defaults to SQLite — always pass `DATABASE_URL` env var when running alembic manually
- **No linter/formatter** configured on backend; frontend uses eslint

## Env Vars

Set in `.env` at repo root (copy from `.env.example`):

```
POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
```

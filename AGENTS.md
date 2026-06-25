# AGENTS.md — financas_app

## Architecture

- **Monorepo**: `backend/` (FastAPI, Python 3.12) + `frontend/` (Vite, React 18, TypeScript)
- **Database**: PostgreSQL (relational: categorias, transacoes)
- **Docker**: root `docker-compose.yml` runs all services.

## Services & Ports

| Service | Port | Notes |
|---------|------|-------|
| PostgreSQL | 5436 | user: `postgres`, db: `financas` |
| Backend API | 8005 | FastAPI at `/` and `/docs` |
| Frontend | 8087 | React SPA (nginx in prod) |

## Developer Commands

### Full stack (Docker)
```sh
docker compose up -d   # starts all services from repo root
```

### Backend (local dev)
```sh
cd backend
uv sync                # install deps (uses uv, not pip)
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (local dev)
```sh
cd frontend
npm install
npm run dev            # Vite dev server (default port 8080)
```

### Migrations (PostgreSQL via Alembic)
```sh
cd backend
# alembic.ini defaults to SQLite — override for PostgreSQL:
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5436/financas alembic upgrade head
```

## Key Backend Structure

- Entry: `backend/app/main.py` — FastAPI app with 8 route modules
- Routes: `transacoes`, `categorias`, `dashboard`, `limits`, `metas`, `shopping`, `pluggy`, `export`
- DB layer: `app/db/` — SQLAlchemy async (PostgreSQL)
- Repositories: `app/db/repositories/` — data access per entity
- Config: `app/core/config.py` — loads env via `python-dotenv`
- Migrations: `app/db/migrations/versions/` — 6 existing migrations

## Key Frontend Structure

- Entry: `frontend/src/main.tsx` → `App.tsx`
- Pages: `src/pages/`
- Services: `src/services/` — API calls to backend
- UI: shadcn-ui + PrimeReact components

## Important Quirks

- **No test framework** is set up in either backend or frontend
- **No linter/formatter** configured on backend; frontend uses eslint (no format script)
- **Alembic URL mismatch**: `alembic.ini` has `sqlite+aiosqlite:///./financas.db` but docker-compose uses PostgreSQL. Always pass `DATABASE_URL` env var when running alembic.
- **Frontend build arg**: `VITE_API_URL` is baked into the Docker build (default `http://localhost:8005`).
- **CORS origins** hardcoded in `backend/app/main.py` — includes several LAN IPs. Update if adding new dev endpoints.

## Env Vars

Set in `.env` at repo root (copy from `.env.example`):

```
POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
```

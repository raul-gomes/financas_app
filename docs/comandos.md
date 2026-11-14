# Comandos úteis

Todo comando para desenvolver, rodar e manter o app. Usou, criou ou mudou um
comando? Atualize este arquivo no mesmo commit. Segredos ficam no EnvVault: use
`envvault run -p financas_app -- <comando>` quando o comando precisar do `.env`.

## Stack completo (Docker, raiz do repo)

| Comando | Quando usar |
| --- | --- |
| `docker compose up -d --build` | Subir Postgres, backend, frontend e nginx. App em http://localhost:8087 |
| `docker compose logs -f backend` | Acompanhar o backend (troque por `frontend`, `nginx`, `db`). |
| `docker compose down` | Parar tudo (o volume `postgres-data` continua). |
| `docker exec financas-web sh -c "cd /app && npm run test"` | Testes do frontend dentro do container. |

## Backend (`app/backend`)

| Comando | Quando usar |
| --- | --- |
| `uv sync` | Instalar dependências. |
| `uv run pytest -q` | Testes (SQLite em memória, não precisa de banco). `uv run pytest tests/<arquivo>.py` roda só os relacionados. |
| `uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` | Backend local fora do Docker. |
| `DATABASE_URL=postgresql+asyncpg://<usuário>:<senha>@localhost:5436/financas uv run alembic upgrade head` | Aplicar migrations no Postgres do Docker (porta 5436 no host). |
| `uv run alembic revision -m "<descrição>"` | Nova migration (nunca editar uma já aplicada). |
| `SEED_USER_EMAIL=<seu-email-de-dev> DATABASE_URL=postgresql://<usuário>:<senha>@localhost:5436/financas uv run python -m app.scripts.seed` | Popular o banco de dev com dados de exemplo (usuário admin com o e-mail informado). |
| `uv run ruff check .` / `uv run ruff format .` | Lint e formatação do backend (config em `pyproject.toml`; `--fix` aplica correções seguras). |
| `uvx pip-audit --disable-pip --no-deps -r <(uv export --frozen --no-hashes --no-emit-project)` | Auditoria de dependências do backend (roda no CI de forma informativa; ver Q1). |

## Frontend (`app/frontend`)

| Comando | Quando usar |
| --- | --- |
| `npm ci` | Instalar dependências pelo `package-lock.json`. Se `node_modules` for do root (criado pelo Docker), rode dentro do container. |
| `npm run dev` | Vite dev server (porta 8080). |
| `npm run typecheck` | Typecheck. Sempre este formato (`tsc -b --noEmit`); `tsc` puro não valida nada. |
| `npm run test` | Testes unitários (Vitest). |
| `npm run lint` | Lint (ESLint). |
| `npm run build` | Build de produção (`dist/`). |
| `node scripts/check-bundle-size.mjs` | Orçamento de bundle (500 kB gzip por chunk), o mesmo do CI. |

## Git e CI

| Comando | Quando usar |
| --- | --- |
| `git switch mvp && git pull` | Branch de trabalho atual (não existe `develop` ainda). |
| `gh pr checks <número>` / `gh run view <id> --log-failed` | Ver o CI e por que falhou. |

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

## Produção, backup e nginx

| Comando | Quando usar |
| --- | --- |
| `docker compose -f docker-compose-prod.yml up -d --build` | Subir a stack de produção. Exige no `.env`: `POSTGRES_*`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_AUTH_URL`, `SUPABASE_JWT_SECRET`, `CORS_ORIGINS`, `DOMAIN`. Certificados em `infra/certbot/conf` (certbot, webroot `infra/certbot/www`) antes do primeiro `up`. |
| `docker compose -f docker-compose-prod.yml down` | Parar a stack de produção (volumes `postgres-data` e `backend-logs` continuam). |
| `docker compose -f docker-compose-prod.yml logs -f backend` | Logs dos containers; arquivos do loguru ficam no volume `backend-logs` (`/app/logs`). |
| `docker compose -f docker-compose-prod.yml ps` | Estado e saúde (healthcheck) de cada serviço. |
| `docker compose exec nginx nginx -t` | Validar a config do nginx com a stack no ar (`nginx -s reload` aplica). |
| `docker run --rm -v $PWD/infra/nginx.conf:/etc/nginx/conf.d/default.conf:ro -v $PWD/infra/snippets:/etc/nginx/snippets:ro --add-host frontend:127.0.0.1 --add-host backend:127.0.0.1 nginx:1.27-alpine nginx -t` | Validar o nginx de dev sem subir a stack (o de prod é igual, com o template renderizado e um certificado). |
| `scripts/backup-db.sh <pasta> [manter=14]` | `pg_dump -Fc` do container `financas-db` para `<pasta>/financas-<UTC>.dump` (modo 600) e mantém só os N mais recentes. |
| `scripts/restore-db.sh <arquivo.dump>` | Restaura um dump (destrutivo, pede confirmação digitando `restore`). Teste o backup num ambiente descartável antes de depender dele. |
| `0 3 * * * cd /caminho/financas_app && scripts/backup-db.sh /var/backups/financas 14 >> /var/log/financas-backup.log 2>&1` | Exemplo de cron diário às 03:00 (`crontab -e`). |

Observação: as migrations (`alembic upgrade head`) rodam no start do backend e assumem **uma única réplica** do backend; para escalar horizontalmente, mova a migration para um passo de deploy separado.

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
| `uvx pip-audit --disable-pip --no-deps -r <(uv export --frozen --no-hashes --no-emit-project)` | Auditoria de dependências do backend (roda no CI e bloqueia o build). |

## Frontend (`app/frontend`)

| Comando | Quando usar |
| --- | --- |
| `npm ci` | Instalar dependências pelo `package-lock.json`. Se `node_modules` for do root (criado pelo Docker), rode dentro do container. |
| `npm run dev` | Vite dev server (porta 8080). |
| `npm run typecheck` | Typecheck. Sempre este formato (`tsc -b --noEmit`); `tsc` puro não valida nada. |
| `npm run test` | Testes unitários (Vitest). |
| `npm run lint` | Lint (ESLint). |
| `npm run build` | Build de produção (`dist/`). |
| `npm audit --omit=dev` | Auditoria de dependências de produção do frontend (`npm audit fix` sem `--force`). |
| `node scripts/check-bundle-size.mjs` | Orçamento de bundle (64 kB gzip por chunk), o mesmo do CI. |

## Git e CI

| Comando | Quando usar |
| --- | --- |
| `git switch mvp && git pull` | Branch de trabalho atual (não existe `develop` ainda). |
| `gh pr checks <número>` / `gh run view <id> --log-failed` | Ver o CI e por que falhou. |

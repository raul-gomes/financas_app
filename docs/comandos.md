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
| `docker compose -f docker-compose-prod.yml up -d --build` | Subir a stack de produção. Exige no `.env`: `POSTGRES_*`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_AUTH_URL`, `SUPABASE_JWT_SECRET`, `PLUGGY_KEY_ENCRYPTION_KEYS`, `CORS_ORIGINS`, `DOMAIN`. Certificados em `infra/certbot/conf` (certbot, webroot `infra/certbot/www`) antes do primeiro `up`. |
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
| `DATABASE_URL=sqlite+aiosqlite:///:memory: uv run pytest -q` | Testes (SQLite em memória, não precisa de banco; `DATABASE_URL` é obrigatório para importar o app, como no CI). `... uv run pytest tests/<arquivo>.py` roda só os relacionados. |
| `uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` | Backend local fora do Docker. |
| `DATABASE_URL=postgresql+asyncpg://<usuário>:<senha>@localhost:5436/financas uv run alembic upgrade head` | Aplicar migrations no Postgres do Docker (porta 5436 no host). |
| `DATABASE_URL=postgresql+asyncpg://<usuário>:<senha>@localhost:5436/financas uv run alembic check` | Falha se os models divergem das migrations (rode após `upgrade head`; roda no CI contra um Postgres descartável). |
| `docker run -d --rm --name financas-pgtest -e POSTGRES_USER=t -e POSTGRES_PASSWORD=t -e POSTGRES_DB=t -p 55432:5432 postgres:16-alpine` | Postgres descartável (porta livre 55432) para os testes marcados `postgres`. Espere ~5 s (`docker exec financas-pgtest pg_isready -U t`). |
| `DATABASE_URL=sqlite+aiosqlite:///:memory: TEST_POSTGRES_URL=postgresql+asyncpg://t:t@localhost:55432/t uv run pytest -m postgres` | Testes de integração do Postgres (`tests/test_postgres_integration.py`: parcelas em lote, advisory lock, savepoints, índice único do id do provedor, paginação por cursor). A fixture **apaga e recria o schema `public`** e roda `alembic upgrade head`; nunca aponte para dados reais. Sem `TEST_POSTGRES_URL` esses testes são pulados (`-m "not postgres"` os exclui). No CI rodam contra o serviço `postgres:16`. |
| `docker stop financas-pgtest` | Remove o container descartável (`--rm` apaga ao parar). |
| `uv run alembic revision -m "<descrição>"` | Nova migration (nunca editar uma já aplicada). |
| `SEED_USER_EMAIL=<seu-email-de-dev> SEED_USER_NAME=<nome> DATABASE_URL=postgresql+asyncpg://<usuário>:<senha>@localhost:5436/financas uv run python -m app.scripts.seed` | **Apaga e recria todas as tabelas** e popula o banco de dev com dados fictícios (usuário admin com o e-mail informado; casal com PF e PJ; últimos 18 meses até o mês atual; investimentos todo mês; determinístico para o mesmo dia). Dentro do container: `docker exec financas-api python -m app.scripts.seed`. Só em banco de dev/demonstração. |
| `uv run ruff check .` / `uv run ruff format .` | Lint e formatação do backend (config em `pyproject.toml`; `--fix` aplica correções seguras). |
| `uvx bandit==1.9.4 -r app -ll` | SAST do backend (roda no CI; bloqueia em severidade média ou maior; `# nosec` só com motivo escrito). |
| `uvx pip-audit --disable-pip --no-deps -r <(uv export --frozen --no-hashes --no-emit-project)` | Auditoria de dependências do backend (roda no CI e bloqueia o build). |

## Chave de cifra da chave Pluggy (`PLUGGY_KEY_ENCRYPTION_KEYS`)

A chave Pluggy de cada usuário fica cifrada (Fernet) em `users.pluggy_api_key`. A variável
`PLUGGY_KEY_ENCRYPTION_KEYS` é obrigatória em dev e produção (o backend não sobe sem ela, nem
a migration roda se houver chave em texto puro). Ela vive no EnvVault, nunca no repositório.

| Comando / passo | Quando usar |
| --- | --- |
| `uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` | Gerar uma chave nova (rode em `app/backend`; uma por ambiente: dev e prod diferentes). Guarde a saída no EnvVault como `PLUGGY_KEY_ENCRYPTION_KEYS`, sem colar em chat, nota ou arquivo versionado. |
| `envvault run -p financas_app -- docker compose up -d --build` | Subir o dev com a chave injetada. A migration `b8c9d0e1f2a3` cifra as chaves Pluggy já salvas no primeiro start. |
| Rotação: 1) gere uma chave nova; 2) no EnvVault ponha `NOVA,ANTIGA` (a primeira cifra, todas decifram); 3) reinicie o backend; 4) cada chave Pluggy salva de novo (Configurações) passa a usar a `NOVA`; 5) só remova `ANTIGA` quando todos os usuários com chave tiverem salvo de novo. | Trocar a chave de cifra sem perder dados. Ainda não há comando que re-cifre o banco inteiro; remover `ANTIGA` cedo demais deixa a chave Pluggy ilegível (erro 500 claro no sync; o usuário precisa salvá-la de novo). |
| `uv run alembic downgrade -1` (com a chave no ambiente) | Desfaz a cifra (volta a texto puro); só para reverter este deploy. |

## Frontend (`app/frontend`)

| Comando | Quando usar |
| --- | --- |
| `npm ci` | Instalar dependências pelo `package-lock.json`. Se `node_modules` for do root (criado pelo Docker), rode dentro do container. |
| `npm run dev` | Vite dev server (porta 8080). |
| `npm run typecheck` | Typecheck. Sempre este formato (`tsc -b --noEmit`); `tsc` puro não valida nada. |
| `npm run test` | Testes unitários (Vitest). |
| `npm run lint` | Lint (ESLint). |
| `npm run build` | Build de produção (`dist/`). |
| `npm audit` | Auditoria completa do frontend, incluindo dev. Hoje: 21 alertas altos, todos do `picomatch` (GHSA-fc5q-39xc-vjpf, sem versão corrigida; ver pendência Q12). |
| `npm audit --omit=dev` | Auditoria de dependências de produção do frontend; esperado 0 (bloqueante no CI). |
| `VITE_SUPABASE_URL=http://fake.local VITE_SUPABASE_ANON_KEY=anon VITE_API_URL=http://127.0.0.1:18799 npx vite build --outDir <pasta-temporária> && npx vite preview --outDir <pasta-temporária> --host 127.0.0.1 --port 18080` | Servir o frontend contra um backend local (SQLite com seed) para checagem visual/Playwright em 390x844 e 1440x900. Sessão falsa no `localStorage` na chave `sb-fake-auth-token`; backend com `SUPABASE_JWT_SECRET` descartável e `CORS_ORIGINS=http://127.0.0.1:18080`. |
| `node scripts/check-bundle-size.mjs` | Orçamento de bundle (64 kB gzip por chunk), o mesmo do CI. |

## Git e CI

| Comando | Quando usar |
| --- | --- |
| `git switch mvp && git pull` | Branch de trabalho atual (não existe `develop` ainda). |
| `gh pr checks <número>` / `gh run view <id> --log-failed` | Ver o CI e por que falhou. |

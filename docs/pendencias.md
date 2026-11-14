# Pendências

Arquivo único de pendências. Detalhe e evidência de cada achado em
[`analise-inicial.md`](analise-inicial.md). Resolveu: marque `[x]`, escreva `FEITO`
e o commit. Itens antigos de `todo.md`, `backlog.md` e `ideias.md` estão
consolidados no fim.

## Decisões do dono (antes de codar)
- [ ] Nome do produto: a confirmar ("Olavo" ou "Placo"?) antes de renomear repo, `package.json` e textos.
- [x] **MVP = o produto do usuário comum** (transações, categorias, limites, dashboards, configurações). As rotas só de admin (metas, compras, recorrentes, extrato, Pluggy, investimentos, export) são **implementações em andamento**, fora do MVP. DECIDIDO 2026-11-14.
- [ ] Uso pessoal apenas, ou também empresarial?
- [ ] Onde roda a produção hoje?
- [x] Git flow: `develop` criada a partir de `mvp` e virou a branch padrão; `feature/*` → `develop`; `main` só por release. FEITO 2026-11-14.

## Segurança
- [x] **S1** (alta) FEITO: `log_api_request` redige campos de credencial em qualquer rota; o perfil loga só os nomes dos campos; `diagnose=False` no loguru (tracebacks mostravam variáveis locais). Era: Remover o log do payload em `PUT /settings/profile` (`settings_routes.py:34`) e redigir campos sensíveis no logger.
- [ ] **S2** (alta) ~~Não devolver `pluggy_api_key`~~ FEITO (API devolve `has_pluggy_key`; string vazia remove a chave). **Falta:** cifrar em repouso (precisa de uma chave nova no EnvVault — decisão do dono).
- [x] **S3** (média) FEITO: algoritmo pela config (HS256 só com segredo; ES256/RS256 só via JWKS; `none` recusado), `aud=authenticated`, `iss` do projeto, claims obrigatórias. Era: JWT: algoritmo fixo, `audience` e `issuer` (`core/security.py:26-45`).
- [x] **S4** (média) FEITO: coluna `users.supabase_id` (migration `a7b8c9d0e1f2`), busca pelo `sub`, e-mail local segue o Supabase, e-mail de outra conta → 409. Perfil não aceita mais e-mail/senha (422): a tela troca pelo Supabase (antes a senha de login não mudava). Era: Identidade pelo `sub` do Supabase (`supabase_id`); não deixar o perfil trocar e-mail.
- [ ] **S5** (média) `user_id` obrigatório em todos os repositórios.
- [ ] **S6** (média) Extrato: `defusedxml` e limite de tamanho antes de ler o arquivo.
- [ ] **S7** (média) CORS por variável de ambiente, rate limit, headers de segurança no nginx, containers sem root.
- [ ] **S8** (baixa) passlib removido e `password_hash` não é mais escrito; falta a migration que apaga a coluna. Era: Remover `password_hash`/passlib se o login é só Supabase.
- [ ] **S9** (baixa) Não devolver `str(e)` ao cliente; `console.error` sem o objeto inteiro.
- [x] **S10** (média) Tooltips D3 montavam HTML com o nome da categoria (dado do usuário). FEITO: `escapeHtml` (`lib/format.ts`) em todo texto interpolado.

## Bugs
- [x] **B1** (média) FEITO: 4 testes dependiam da data (fixtures de setembro/2026 vs `now()`); agora o relógio é congelado com `time-machine` (fixture autouse em `test_limit_alert_job.py` e `test_notifications_routes.py`).
- [ ] **B2** (média) Confirmar 413 em extrato > 1 MB; definir `client_max_body_size 10m`.
- [ ] **B3** (média) Nginx de prod: upstream `frontend:8080` × imagem na 80; 443 sem TLS. Versionar o compose de prod sem segredos.
- [ ] **B4** (baixa) `database.py:9` sem `DATABASE_URL`; `sync_engine` morto; `"Sin cronizar"` e `datetime.now()` sem fuso em `pluggy_routes.py`.

## Qualidade
- [~] **Q1** (alta) PARCIAL: job de backend no CI (ruff, pytest, pip-audit informativo), actions por SHA, `permissions` mínimas, concurrency e CI em todos os PRs FEITOS. Falta: SAST, `alembic check`, e tornar o pip-audit bloqueante (hoje reporta 43 vulnerabilidades em anyio, certifi, idna, mako, pyjwt, python-dotenv, python-multipart, starlette; atualizar dependências).
- [x] **Q2** (média) FEITO: ruff configurado no `pyproject.toml` (format + lint zerados). Regras adiadas em `extend-ignore` com TODO: B904, UP042, S314, S112, B017 (testes); E501 ignorado (formatter cuida).
- [ ] **Q3** (média) Extrair serviços dos repositórios e das rotas; unit of work por request.
- [ ] **Q4** (média) Trocar `except Exception` silenciosos por exceções específicas.
- [x] **Q5** (média) Zod nos services do frontend; remover `any`. Feito: `src/schemas/*` + `lib/parse.ts`; todo `res.json()` dos services é parseado uma vez na borda; sem `any` em src (fora de `ui/`). Follow-up: ligar `strictNullChecks` (hoje `Infer<>` compensa o `z.infer` no modo não estrito).
- [ ] **Q6** (média) Quebrar `BankExtract.tsx`, `ExtratoDialog.tsx`, `AddTransactionDialog.tsx`; unificar Add/Edit (ao tocar).
- [x] **Q7** (média) Trocar cores fixas por tokens. Feito em todo `src/`: novos tokens `critical` e `chart-1..12` (light+dark); só restam overlays `bg-black/80` do shadcn.
- [ ] **Q8** (média) Usar react-query nos fetches ou remover a dependência.
- [ ] **Q9** (baixa) ~~17 erros de ESLint~~ (feito; restam 16 warnings); ~~remover `bun.lockb`~~ (feito); ~~`lang="pt-BR"`~~ (feito); `aria-label` nos botões de ícone; `.dict()` → `model_dump()`; imports mortos; tetos de versão; tirar `psycopg2-binary`/`aiosqlite` de produção.
- [ ] **Q11** (média) Frontend: `npm audit --omit=dev` com 5 moderados — react-router 6 (corrigido só na v7, major) e glob/minimatch (só build, via tailwind). Zod já foi para a v4 (alerta alto resolvido). Chunk principal 684 kB (202 kB gzip): analisar `manualChunks`/`zod/mini`.
- [ ] **Q10** (baixa) Commits em inglês daqui em diante.

## Performance
- [ ] **P1** (média) Export filtrar `user_id` no SQL (`repositories/export.py:48`).
- [ ] **P2** (média) Overview agregando no SQL.
- [ ] **P3** (média) Paginação de transações no backend; cache no frontend.
- [x] **P4** (baixa) Lazy nas páginas de auth; importar só os módulos do D3 usados. Feito: Login/SignUp/ForgotPassword/UpdatePassword lazy; `d3` trocado por submódulos via `src/lib/d3.ts`; chunk principal 658,09 -> 648,77 kB (gzip 191,44 -> 189,83).
- [ ] **P5** (baixa) Lock no job de alertas; evitar `selectin` de bancos em toda request.

## Infra e operação
- [ ] **I1** (alta) Backup do Postgres (`pg_dump` agendado + teste de restauração).
- [ ] **I2** (média) Não publicar o Postgres no host (ou só em `127.0.0.1`); sem senha padrão no compose.
- [ ] **I3** (média) Logs num volume (rotação já existe no loguru); health check nos containers.
- [ ] **I4** (baixa) Migração fora do start do container (ou com lock); `set -e` no `setup-docker.sh`.

## Documentação e higiene
- [x] **D1** (alta) `senhas.txt`, `acessos.md` e `ssh_key` movidos para `.private/` (ignorada, `0700`); `docs/` versionado (e-mail pessoal e URL de banco redigidos). FEITO. Falta o dono passar esses segredos para o EnvVault.
- [ ] **D2** (média) Atualizar `regras_negocio.md` (limites 80/90/100, papéis) e ~~o `AGENTS.md` (12 routers, 24 migrations, 29 arquivos de teste)~~ (AGENTS.md feito).
- [ ] **D3** (baixa) Apagar branches paradas (`docs/agents-cerebro`, `origin/full-code`); ~~remover os 2 PNGs de `docs/`~~ (feito).

## Herdado de todo.md / backlog.md / ideias.md
- [ ] Animação de cards subindo nos lançamentos do extrato (`todo.md`).
- [ ] **MULTI-01** Multi-moeda: moeda global por usuário (`backlog.md`).
- [ ] Conectar com o MCP de Open Finance (`ideias.md`).
- [ ] Limitar o extrato para não crescer sem fim.
- [ ] Visão mobile.
- [ ] Tirar investimento (decisão de produto).
- [ ] Estudar API para um app mobile.
- [ ] Validar a questão de permissão (parcialmente respondida: o backend impõe `admin`; ver decisão acima).
- [x] Âncoras no site — FEITO (`d5ebab6`).
- [x] Dashboard só com categorias perto do limite — FEITO (`2c7e15b`).

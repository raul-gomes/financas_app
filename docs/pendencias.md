# Pendências

Arquivo único de pendências. Detalhe e evidência de cada achado em
[`analise-inicial.md`](analise-inicial.md). Resolveu: marque `[x]`, escreva `FEITO`
e o commit. Itens antigos de `todo.md`, `backlog.md` e `ideias.md` estão
consolidados no fim.

## Decisões do dono (antes de codar)
- [x] Nome do produto: **Placo** (DECIDIDO). FEITO no frontend: logo, favicon, manifest, título, `package.json`. Falta renomear o repo/pastas e os nomes de container (`financas-*`), o README do frontend (ainda é o do Lovable) e o remetente/textos de e-mail no backend.
- [x] **MVP = o produto do usuário comum** (transações, categorias, limites, dashboards, configurações). As rotas só de admin (metas, compras, recorrentes, extrato, Pluggy, investimentos, export) são **implementações em andamento**, fora do MVP. DECIDIDO 2026-11-14.
- [ ] Uso pessoal apenas, ou também empresarial?
- [ ] Onde roda a produção hoje?
- [x] Git flow: `develop` criada a partir de `mvp` e virou a branch padrão; `feature/*` → `develop`; `main` só por release. FEITO 2026-11-14.

## Segurança
- [x] **S1** (alta) FEITO: `log_api_request` redige campos de credencial em qualquer rota; o perfil loga só os nomes dos campos; `diagnose=False` no loguru (tracebacks mostravam variáveis locais). Era: Remover o log do payload em `PUT /settings/profile` (`settings_routes.py:34`) e redigir campos sensíveis no logger.
- [ ] **S2** (alta) ~~Não devolver `pluggy_api_key`~~ FEITO (API devolve `has_pluggy_key`; string vazia remove a chave). **Falta:** cifrar em repouso (precisa de uma chave nova no EnvVault — decisão do dono).
- [x] **S3** (média) FEITO: algoritmo pela config (HS256 só com segredo; ES256/RS256 só via JWKS; `none` recusado), `aud=authenticated`, `iss` do projeto, claims obrigatórias. Era: JWT: algoritmo fixo, `audience` e `issuer` (`core/security.py:26-45`).
- [x] **S4** (média) FEITO: coluna `users.supabase_id` (migration `a7b8c9d0e1f2`), busca pelo `sub`, e-mail local segue o Supabase, e-mail de outra conta → 409. Perfil não aceita mais e-mail/senha (422): a tela troca pelo Supabase (antes a senha de login não mudava). Era: Identidade pelo `sub` do Supabase (`supabase_id`); não deixar o perfil trocar e-mail.
- [x] **S5** (média) FEITO: `user_id: int` obrigatório (sem `None` = sem filtro) em transaction, recurring_account, shopping, dashboard e export; todas as consultas filtram por ele; testes em `test_user_scoped_repositories.py`. Era: `user_id` obrigatório em todos os repositórios.
- [x] **S6** (média) FEITO: OFX parseado com `defusedxml` (entidades/DTD malicioso → 400) e upload lido em blocos de 64 KB com 413 assim que passa de 10 MB; `S314`/`S112` saíram do `extend-ignore`. Era: Extrato: `defusedxml` e limite de tamanho antes de ler o arquivo.
- [~] **S7** (média) CORS por variável de ambiente, rate limit, headers de segurança no nginx, containers sem root. _Feito: `CORS_ORIGINS`, `ENVIRONMENT=production` (sem /docs), `limit_req`, headers/CSP/HSTS, backend e frontend sem root (nginx de borda ainda root, precisa das portas 80/443)._
- [ ] **S8** (baixa) passlib removido e `password_hash` não é mais escrito; falta a migration que apaga a coluna. Era: Remover `password_hash`/passlib se o login é só Supabase.
- [ ] **S9** (baixa) Não devolver `str(e)` ao cliente; `console.error` sem o objeto inteiro.
- [x] **S10** (média) Tooltips D3 montavam HTML com o nome da categoria (dado do usuário). FEITO: `escapeHtml` (`lib/format.ts`) em todo texto interpolado.

## Bugs
- [x] **B1** (média) FEITO: 4 testes dependiam da data (fixtures de setembro/2026 vs `now()`); agora o relógio é congelado com `time-machine` (fixture autouse em `test_limit_alert_job.py` e `test_notifications_routes.py`).
- [x] **B2** (média) Confirmar 413 em extrato > 1 MB; definir `client_max_body_size 10m`. _Feito: `client_max_body_size 10m` nos dois nginx._
- [x] **B3** (média) Nginx de prod: upstream `frontend:8080` × imagem na 80; 443 sem TLS. Versionar o compose de prod sem segredos. _Feito: frontend de prod na 8080 (nginx-unprivileged), `infra/nginx.prod.conf.template` com TLS, compose de prod versionado._
- [x] **B4** (baixa) FEITO: `DATABASE_URL` ausente falha na partida com `RuntimeError` citando a variável (`require_database_url`); `sync_engine` removido (sem uso); texto padrão do Pluggy virou "Sincronizado" (a busca ainda reconhece o texto antigo) e `datetime.now(UTC)` em `pluggy_routes.py`.
- [x] **B5** (alta) Import de OFX voltava vazio para qualquer arquivo (`_clean_ofx_tags` quebrava o XML; `DTPOSTED` com hora e fuso era descartado; decimal com vírgula falhava). FEITO: SGML 1.x e XML 2.x testados.
- [x] **B6** (alta) Lote por nome (sync Pluggy) estourava `UnboundLocalError` ou gravava a subcategoria errada (chaves de cache diferentes entre os passos). FEITO.

## Qualidade
- [~] **Q1** (alta) PARCIAL: job de backend no CI (ruff, pytest, pip-audit bloqueante), actions por SHA, `permissions` mínimas, concurrency e CI em todos os PRs FEITOS. pip-audit agora bloqueante (backend com 0 vulnerabilidades após upgrade). Falta: SAST, `alembic check`; frontend (prod) ainda com zod 3 e react-router 6 (correção só em major novo) e glob/minimatch via tailwind/sucrase.
- [x] **Q2** (média) FEITO: ruff configurado no `pyproject.toml` (format + lint zerados). Regras adiadas em `extend-ignore` com TODO: B904, UP042, S314, S112, B017 (testes); E501 ignorado (formatter cuida).
- [ ] **Q3** (média) Extrair serviços dos repositórios e das rotas; unit of work por request.
- [ ] **Q4** (média) PARCIAL (extrato FEITO: parsers CSV/OFX capturam exceções específicas e registram aviso com nº da linha, sem valores). Trocar `except Exception` silenciosos por exceções específicas.
- [x] **Q5** (média) Zod nos services do frontend; remover `any`. Feito: `src/schemas/*` + `lib/parse.ts`; todo `res.json()` dos services é parseado uma vez na borda; sem `any` em src (fora de `ui/`). Follow-up FEITO: `strict: true` ligado no `tsconfig.app.json`; o helper `Infer<>` foi removido e os tipos usam `z.infer`.
- [ ] **Q6** (média) Quebrar `BankExtract.tsx`, `ExtratoDialog.tsx`, `AddTransactionDialog.tsx`; unificar Add/Edit (ao tocar).
- [x] **Q7** (média) Trocar cores fixas por tokens. Feito em todo `src/`: novos tokens `critical` e `chart-1..12` (light+dark); só restam overlays `bg-black/80` do shadcn.
- [ ] **Q8** (média) Usar react-query nos fetches ou remover a dependência.
- [ ] **Q9** (baixa) ~~17 erros de ESLint~~ (feito; restam 16 warnings `react-refresh/only-export-components`, só afetam o HMR em dev e exigiriam separar arquivos de `ui/` e contextos, ficam para a refatoração mobile); ~~remover `bun.lockb`~~ (feito); ~~`lang="pt-BR"`~~ (feito); ~~`aria-label` nos botões de ícone~~ (feito, pt-BR); `.dict()` → `model_dump()`; imports mortos; tetos de versão; tirar `psycopg2-binary`/`aiosqlite` de produção. Backend: tetos de versão, `psycopg2-binary` removido e `aiosqlite` só em dev — FEITO.
- [x] **Q11** (média) FEITO: react-router 6 -> v7 (modo biblioteca, import de `react-router`) e `npm audit fix` (glob/minimatch de produção): `npm audit --omit=dev` = 0 vulnerabilidades. Chunk principal 684 kB (202 kB gzip) -> 113 kB (35 kB gzip) com `manualChunks` (ver P4). Restam só alertas de dev (`npm audit`: 15, vite/esbuild, vitest/tinypool e minimatch de eslint), todos exigindo major de vite/vitest (`audit fix --force`); tratar em item próprio (Vite 8/Vitest 4).
- [ ] **Q10** (baixa) Commits em inglês daqui em diante.

## Performance
- [x] **P1** (média) FEITO: export filtra `user_id` no SQL (teste captura o SQL). Era: Export filtrar `user_id` no SQL (`repositories/export.py:48`).
- [ ] **P2** (média) Overview agregando no SQL.
- [ ] **P3** (média) Paginação de transações no backend; cache no frontend.
- [x] **P4** (baixa) Lazy nas páginas de auth; importar só os módulos do D3 usados. Feito: Login/SignUp/ForgotPassword/UpdatePassword lazy; `d3` trocado por submódulos via `src/lib/d3.ts`; chunk principal 658,09 -> 648,77 kB (gzip 191,44 -> 189,83). Fase 2: todas as rotas já eram lazy; `manualChunks` (react-vendor, d3, supabase, zod, radix) e fallback acessível (`role="status"`, texto pt-BR). Maior chunk: 684 kB -> 223 kB (supabase), gzip 202 -> 58 kB; orçamento do CI apertado de 500 kB para 64 kB gzip por chunk.
- [ ] **P5** (baixa) Lock no job de alertas; evitar `selectin` de bancos em toda request.

## Infra e operação
- [~] **I1** (alta) Backup do Postgres (`pg_dump` agendado + teste de restauração). _Scripts `scripts/backup-db.sh`/`restore-db.sh` e cron documentados; falta agendar no servidor e testar a restauração._
- [x] **I2** (média) Não publicar o Postgres no host (ou só em `127.0.0.1`); sem senha padrão no compose. _Feito: `127.0.0.1:5436`, credenciais obrigatórias (`:?`)._
- [x] **I3** (média) Logs num volume (rotação já existe no loguru); health check nos containers. _Feito: volume `backend-logs` no prod, healthchecks em todos os serviços._
- [~] **I4** (baixa) Migração fora do start do container (ou com lock); `set -e` no `setup-docker.sh`. _`set -euo pipefail` feito; migration segue no start (premissa de réplica única documentada em `docs/comandos.md`)._

## Documentação e higiene
- [x] **D1** (alta) `senhas.txt`, `acessos.md` e `ssh_key` movidos para `.private/` (ignorada, `0700`); `docs/` versionado (e-mail pessoal e URL de banco redigidos). FEITO. Falta o dono passar esses segredos para o EnvVault.
- [ ] **D2** (média) Atualizar `regras_negocio.md` (limites 80/90/100, papéis) e ~~o `AGENTS.md` (12 routers, 24 migrations, 29 arquivos de teste)~~ (AGENTS.md feito).
- [ ] **D3** (baixa) Apagar branches paradas (`docs/agents-cerebro`, `origin/full-code`); ~~remover os 2 PNGs de `docs/`~~ (feito).

## Herdado de todo.md / backlog.md / ideias.md
- [ ] Animação de cards subindo nos lançamentos do extrato (`todo.md`).
- [ ] **MULTI-01** Multi-moeda: moeda global por usuário (`backlog.md`).
- [ ] Conectar com o MCP de Open Finance (`ideias.md`).
- [ ] Limitar o extrato para não crescer sem fim.
- [ ] Visão mobile. **Fase 1 FEITA** (shell): barra de abas inferior com botão "+" (folha de nova transação), barra superior com slot de mês e sino, página `/mais`, `ResponsiveModal` como bottom sheet abaixo de `md`, `/recorrentes` em cards, moeda/datas pt-BR, textos em português. **Fase 2 (falta, por página):** `/financial` (legenda do gráfico e KPIs estouram 390 px, KPIs em carrossel, gráfico de 6 meses, lançamentos agrupados por dia, sem lixeira na linha), `/` (início como cards do mock, PF/PJ segmentado, mês no slot `MobileTopBarSlot`), `/limits` (cards em vez de tabela, edição em folha, chips de abas), formulários com campos de 48 px e teclado numérico, tabelas de `/extrato-bancario`, `/investments` e `/configuracoes`, títulos `h1` duplicados com a barra superior, desligar o `overflow-x-clip` do `main` quando cada página parar de estourar.
- [ ] Erros engolidos restantes (`.catch(() => {})` sem log) em `ContaForm`, `EditRecurrentBillDialog`, `AddRecurrentBillDialog`, `bank-select`, `ExtratoDialog`, `BankExtract`, `FinancialDashboard`: tratar como em `AddTransactionDialog`/`TransactionList` (log + aviso).
- [ ] Tirar investimento (decisão de produto).
- [ ] Estudar API para um app mobile.
- [ ] Validar a questão de permissão (parcialmente respondida: o backend impõe `admin`; ver decisão acima).
- [x] Âncoras no site — FEITO (`d5ebab6`).
- [x] Dashboard só com categorias perto do limite — FEITO (`2c7e15b`).

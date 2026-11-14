# Estrutura de Arquivos — financas_app

> Atualizado em: 2026-09-15

```
financas_app/
├── app/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── main.py                         # FastAPI entry point: registra CORS, 12 routers, endpoints / e /health; lifespan inicia/para job de notificações (limit_alert_job)
│   │   │   ├── logger.py                       # Loguru (console, arquivo, JSON, rotação); redact()/log_api_request() mascaram credenciais
│   │   │   │
│   │   │   ├── core/
│   │   │   │   ├── config.py                   # Classe Config + require_database_url (falha na partida sem DATABASE_URL): carrega DATABASE_URL, SUPABASE_JWT_SECRET, SUPABASE_AUTH_URL do .env
│   │   │   │   ├── database.py                 # Engine async SQLAlchemy, AsyncSessionLocal, get_session() dependency
│   │   │   │   └── security.py                 # get_current_user() — decodifica JWT Supabase via JWKS (ES256/RS256) ou HS256 (SUPABASE_JWT_SECRET), bearer_scheme (HTTPBearer auto_error=False → 401 sem token); require_role(*roles) + require_admin (403)
│   │   │   │
│   │   │   ├── db/
│   │   │   │   ├── base.py                     # SQLAlchemy declarative_base (Base)
│   │   │   │   │
│   │   │   │   ├── models/                     # Modelos ORM (tabelas do PostgreSQL)
│   │   │   │   │   ├── __init__.py             # Re-exporta todos os models para registro no Alembic
│   │   │   │   │   ├── category.py             # CategoryORM (categorias) + SubcategoryORM (subcategorias) — 1:N
│   │   │   │   │   ├── transaction.py          # TransactionORM (transacoes) — FKs para category, subcategory, recurring_account
│   │   │   │   │   ├── recurring_account.py    # RecurringAccountORM (contas recorrentes) — parcelas mensais
│   │   │   │   │   ├── shopping_item.py        # ShoppingItemORM (itens de compra)
│   │   │   │   │   ├── user.py                 # UserORM (usuarios) — 1:N com user_banks; role ('admin'/'user') desde Etapa 9
│   │   │   │   │   ├── user_bank.py            # UserBankORM (bancos do usuario)
│   │   │   │   │   └── limit_alert.py          # LimitAlertORM (limit_alerts) — alertas de limite 80/90/100 + exceeded, scope category/credit_card, read_at/email_sent
│   │   │   │   │
│   │   │   │   ├── repositories/               # Camada de acesso a dados (queries SQL)
│   │   │   │   │   ├── category.py             # CategoriaRepository: CRUD categorias + sincronização de subcategorias
│   │   │   │   │   ├── subcategory.py          # SubcategoriaRepository: CRUD subcategorias, criação em lote
│   │   │   │   │   ├── transaction.py          # TransacaoRepository: CRUD + parcelas + detecção de duplicatas + importação de extrato
│   │   │   │   │   ├── dashboard.py            # DashboardRepository: queries agregadas (gastos, rendimento, extrato)
│   │   │   │   │   ├── overview.py             # DashboardOverviewRepository: dashboard geral (totais, progresso mês, cartão, status limites, parcelas, recorrentes; metas/compras só admin)
│   │   │   │   │   ├── limits.py               # LimitsRepository: atualização em lote de limites de categorias
│   │   │   │   │   ├── recurring_account.py    # ContaRecorrenteRepository: CRUD + geração de parcelas + renovação
│   │   │   │   │   ├── goal.py                 # MetaRepository: CRUD metas + cálculo de progresso baseado em transações
│   │   │   │   │   ├── shopping.py             # ShoppingRepository: CRUD lista de compras + migração de itens não marcados
│   │   │   │   │   ├── settings.py             # SettingsRepository: perfil do usuário + gerenciamento de bancos
│   │   │   │   │   ├── limit_alert.py          # LimitAlertRepository: CRUD alertas de limite (create, list_for_user com notificações, mark read/read-all)
│   │   │   │   │   └── users.py                # get_or_create_user_from_supabase(): identidade pelo sub (supabase_id), vincula legado pelo e-mail, IdentityConflictError; novo cadastro nasce role='user'
│   │   │   │   │
│   │   │   │   └── migrations/                 # Alembic — migrações do banco
│   │   │   │       ├── env.py                  # Configuração do Alembic (lê DATABASE_URL do env)
│   │   │   │       ├── script.py.mako          # Template para novas migrações
│   │   │   │       └── versions/               # 15 migrações (desde criar_tabelas até create limit_alerts)
│   │   │   │
│   │   │   ├── routes/                         # Rotas FastAPI (API REST)
│   │   │   │   ├── transactions_routes.py      # /transacoes — CRUD + detecção/resolução de duplicatas
│   │   │   │   ├── categories_routes.py        # /categories — CRUD categorias
│   │   │   │   ├── dashboard_routes.py         # /dashboard — extrato, overview, rendimento, gastos por categoria
│   │   │   │   ├── limits_routes.py            # /limits — listar e atualizar limites em lote; /limits/risk-check projeta o valor digitado (gasto atual + amount → thresholds 80/90/100)
│   │   │   │   ├── recurring_accounts_routes.py # /recurring-accounts — CRUD + renovação + geração
│   │   │   │   ├── extract_routes.py           # /extracts — upload de extrato CSV/OFX (leitura em blocos, limite 10 MB) + confirmação
│   │   │   │   ├── settings_routes.py          # /settings — perfil + bancos + atribuição aleatória
│   │   │   │   ├── goals_routes.py             # /goals — CRUD metas + progresso
│   │   │   │   ├── shopping_routes.py          # /shopping — CRUD lista de compras + migração
│   │   │   │   ├── pluggy_routes.py            # /pluggy — integração Open Finance (contas, sincronização)
│   │   │   │   ├── notifications_routes.py     # /notifications — listar alertas, marcar lido (1 ou todos)
│   │   │   │   └── export_routes.py            # /export — exportação CSV e OFX
│   │   │   │
│   │   │   ├── schemas/                        # DTOs Pydantic (validação de request/response)
│   │   │   │   ├── transaction.py              # TransacaoCreate/Response/Update + schemas de duplicatas
│   │   │   │   ├── categories.py               # CategoriaBase/Create/Update/Response
│   │   │   │   ├── subcategory.py              # SubcategoriaBase/Create/Update/Response
│   │   │   │   ├── dashboard.py                # Schemas de resposta do dashboard (extrato, rendimento, gastos)
│   │   │   │   ├── overview.py                 # OverviewResponse + sub-schemas do dashboard geral
│   │   │   │   ├── limits.py                   # LimitsUpdatePayload/Response — atualização em lote
│   │   │   │   ├── recurring_account.py        # ContaRecorrenteCreate/Update/Response + GenerateRequest/Response
│   │   │   │   ├── extract.py                  # UploadResponse, ConfirmPayload/Response
│   │   │   │   ├── settings.py                 # ProfileResponse/Update, BankResponse/Create
│   │   │   │   ├── goals.py                    # MetaCreate/Update/Response/Progresso
│   │   │   │   ├── shopping.py                 # ShoppingItemCreate/Update/Response
│   │   │   │   └── notifications.py            # NotificationItem (severity/message computados por threshold 80/90/100), NotificationsResponse, MarkReadResponse, CategoryRiskResponse (projeção gasto atual + valor digitado)
│   │   │   │
│   │   │   └── services/                       # Lógica de negócio e integrações externas
│   │   │       ├── pluggy_service.py           # Cliente HTTP para API Meu Pluggy (Open Finance)
│   │   │       ├── extract_parsers.py          # Parsers de extrato bancário (CSV e OFX via defusedxml; UnsafeOfxError)
│   │   │       ├── limit_alert_service.py      # LimitAlertService: avalia limites (evaluate_limits, _evaluate_credit_card), envia emails, trigger_limit_evaluation e evaluate_all_users_current_month (disparos pós-mutação)
│   │   │       ├── email_service.py            # Envio de e-mails via Resend API (opt-in EMAIL_ALERTS_ENABLED; best-effort, nunca levanta)
│   │   │       └── limit_alert_job.py          # Job periódico de avaliação de limites (run_evaluation_once, _job_loop, start/stop) — roda no lifespan
│   │   │
│   │   ├── tests/                              # Suite de testes (pytest + pytest-asyncio)
│   │   │   ├── conftest.py                     # Fixtures: SQLite in-memory, httpx.AsyncClient, factories de payload
│   │   │   ├── test_security.py                # Testes de autenticação JWT (HS256/ES256, aud, iss, alg none, sem segredo → 401) + require_role/require_admin (403)
│   │   │   ├── test_logger_redaction.py        # Credenciais nunca chegam ao log (redact, log_api_request)
│   │   │   ├── test_ofx_parser.py              # OFX 1.x (SGML) e 2.x (XML) reais
│   │   │   ├── test_batch_from_extract.py      # Lote por nome de categoria/subcategoria (sync Pluggy)
│   │   │   ├── test_admin_guard.py             # Etapa 9: rotas admin-only → 403 para role='user' (pluggy, export, shopping, goals, extract) + acesso user a recurring-accounts (generate segue 403)
│   │   │   ├── test_auth_required.py           # Etapa 4: cada rota sem token → 401 (client_no_auth)
│   │   │   ├── test_category_isolation.py      # Etapa 5: isolamento por usuário de categorias/subcategorias (via client_user2 + clients_ctrl)
│   │   │   ├── test_transaction_isolation.py   # Etapa 6: isolamento de transações por usuário (list, get, update, delete, duplicatas, extrato, export)
│   │   │   ├── test_user_scoped_repositories.py # S5/P1: export e dashboard só retornam dados do usuário (filtro no SQL)
│   │   │   ├── test_users_repository.py        # Testes de upsert de usuário (criação, retorno existente, não duplica)
│   │   │   ├── test_root.py                    # Testa endpoints / e /health
│   │   │   ├── test_transactions.py            # CRUD transações + filtro por data + 404
│   │   │   ├── test_categories.py              # CRUD categorias + subcategorias + duplicatas (409)
│   │   │   ├── test_dashboard.py               # Endpoints do dashboard (extrato, rendimento, gastos)
│   │   │   ├── test_limits.py                  # Atualização em lote de limites
│   │   │   ├── test_recurring_accounts.py      # CRUD contas recorrentes + parcelas + renovação
│   │   │   ├── test_recurring_account_isolation.py # Etapa 7: isolamento de contas recorrentes por usuário (list, get, update, delete, renew) + geração de parcelas com user_id
│   │   │   ├── test_extract.py                 # Upload e confirmação de extratos CSV
│   │   │   ├── test_extract_parsers.py         # Unit tests do parser CSV (delimitadores, datas, valores)
│   │   │   ├── test_extract_upload_safety.py   # S6: OFX com entidades recusado (400), upload > 10 MB (413) lido em blocos
│   │   │   ├── test_extract_skipped_rows.py    # Q4: linhas CSV ignoradas viram aviso com número da linha
│   │   │   ├── test_startup_config.py          # B4: DATABASE_URL obrigatório (falha na partida) e descrição padrão do sync Pluggy
│   │   │   ├── test_goals.py                   # CRUD metas + progresso + duplicatas
│   │   │   ├── test_overview.py                # Dashboard geral (/dashboard/overview): totais, progresso mês, cartão, status limites, parcelas, recorrentes, metas/compras só admin
│   │   │   ├── test_shopping.py                # CRUD lista de compras + rollover (não-comprados p/ mês seguinte) + ordenação
│   │   │   ├── test_shopping_isolation.py      # Etapa 8: isolamento de itens de compra por usuário (list, update, delete)
│   │   │   ├── test_schemas.py                 # Validação dos schemas Pydantic
│   │   │   ├── test_duplicate_validation.py    # Detecção e resolução de duplicatas end-to-end
│   │   │   ├── test_limit_alert_repository.py  # CRUD limit_alerts + unique constraint + list/read/read-all
│   │   │   ├── test_limit_alert_service.py     # evaluate_limits (alerta p/ 80/90/100, severity por threshold, exceeded, idempotência), cartão, emails
│   │   │   ├── test_email_service.py           # Content/HTML do e-mail; nunca levanta em erro de API
│   │   │   ├── test_notifications_routes.py    # GET /notifications + PUT read/read-all + GET /limits/risk-check + disparo em transação
│   │   │   └── test_limit_alert_job.py         # Job: avalia todos usuários do mês atual; usuário sem email não quebra
│   │   │
│   │   ├── scripts/
│   │   │   ├── __init__.py                      # Pacote de scripts utilitários
│   │   │   └── seed.py                          # Popula o banco com dados de demonstração (usuário, bancos, categorias incl. especiais de limite, recorrentes, transações 2025-2026, metas, compras)
│   │   │
│   │   ├── Dockerfile                          # Build multi-stage: uv + Python 3.12 Alpine
│   │   ├── alembic.ini                         # Config do Alembic (URL default SQLite — sobrescrever com DATABASE_URL)
│   │   ├── pyproject.toml                      # Definição do projeto Python + dependências
│   │   └── uv.lock                             # Lockfile do uv
│   │
│   └── frontend/
│       ├── src/
│       │   ├── main.tsx                        # Entry point React (renderiza App)
│       │   ├── App.tsx                         # Router setup: rotas + Providers (QueryClient, Tooltip, Toaster)
│       │   ├── App.css                         # Estilos globais da aplicação
│       │   ├── index.css                       # Estilos base (Tailwind + shadcn)
│       │   ├── vite-env.d.ts                   # Type declarations do Vite
│       │   │
│       │   ├── components/
│       │   │   ├── ErrorBoundary.tsx             # Barreira de erro por rota (fallback + retry; crash não derruba o app)
│       │   │   ├── ui/                         # shadcn-ui primitives + compostos (button, dialog, card, responsive-modal, confirm-dialog, bank-logo, bank-select, bank-search, currency-input, stat-card, empty-state, page-header, etc.); smoke tests Vitest colocados (*.test.tsx ao lado). Obs: carousel.tsx e command.tsx REMOVIDOS (não usados; deps embla-carousel-react/cmdk removidas)
│       │   │   │
│       │   │   ├── charts/                     # Componentes de gráficos D3
│       │   │   │   ├── D3BarChart.tsx           # Gráfico de barras anual (income/expenses/investment por mês)
│       │   │   │   ├── D3DailyChart.tsx         # Gráfico de barras diário (breakdown do mês selecionado)
│       │   │   │   ├── D3HorizontalBarChart.tsx # Gráfico de barras horizontal (breakdown por categoria)
│       │   │   │   ├── D3LineChart.tsx          # Gráfico de linha (evolução temporal)
│       │   │   │   ├── D3PieChart.tsx           # Gráfico de pizza (proporção por categoria)
│       │   │   │   ├── FlippableChart.tsx       # Container 3D flip: frente (anual) + verso (diário)
│       │   │   │   └── IncomeChart.tsx          # Gráfico de entradas por subcategoria
│       │   │   │
│       │   │   ├── dialogs/                    # Componentes de modal/diálogo
│       │   │   ├── dialogs/                    # Componentes de modal/diálogo
│       │   │   │   ├── AddTransactionDialog.tsx      # Modal "Nova Transação" (pt-BR): máscara de moeda, data dd/mm/yyyy, banco novo em linha inteira (ícone via BankLogo CDN GitHub + fallback de iniciais coloridas, igual ao Settings) + aviso de % projetada do limite com cores 80/90/100 ao digitar valor + categoria, via /limits/risk-check?amount=
│       │   │   │   ├── AddTransactionDialog.test.tsx # Testes do aviso de limite estourado, tradução pt-BR, máscara de data dd/mm/yyyy, payload ISO e banco em linha inteira
│       │   │   │   ├── EditTransactionDialog.tsx     # Modal para editar transação existente
│       │   │   │   ├── DuplicateDialog.tsx           # Modal de detecção/resolução de duplicatas
│       │   │   │   ├── AddInvestmentDialog.tsx       # Modal para adicionar investimento
│       │   │   │   ├── EditInvestmentDialog.tsx      # Modal para editar investimento
│       │   │   │   ├── AddRecurrentBillDialog.tsx    # Modal para criar conta recorrente
│       │   │   │   ├── EditRecurrentBillDialog.tsx   # Modal para editar conta recorrente
│       │   │   │   ├── BankBreakdownModal.tsx        # Modal de detalhamento por banco
│       │   │   │   ├── ExtratoDialog.tsx             # Modal de seleção de extrato para importar
│       │   │   │   ├── ExtratoUploadModal.tsx        # Modal de upload de extrato bancário (CSV/OFX)
│       │   │   │   └── PluggyInfoDialog.tsx          # Modal de informações da integração Pluggy
│       │   │   │
│       │   │   ├── dashboards/                 # Componentes de dashboard
│       │   │   │   ├── FinancialDashboard.tsx   # Dashboard financeiro: orçamento, gráfico flip, categorias; cartão com barra de % (>=80 warning, estourado destructive + badge "Estourando")
│       │   │   │   ├── ChartAnchors.tsx         # Âncoras de navegação que rolam até cada gráfico/seção do dashboard
│       │   │   │   ├── ChartAnchors.test.tsx    # Testes das âncoras (render, scrollIntoView, seção inexistente)
│       │   │   │   ├── OverviewDashboard.tsx    # Dashboard geral da página inicial: indicadores, progresso mês, cartão (badge "Estourando" e tone 80/100), status limites, parcelas, recorrentes, metas/compras (admin)
│       │   │   │   ├── OverviewDashboard.test.tsx # Testes do dashboard geral (render, refetch por entidade, isAdmin, badge cartão estourando)
│       │   │   │   └── FinancialDashboard.test.tsx # Testes de rolagem dos boxes (100vh→130vh; Entradas/Gastos rolam quando estouram o teto) + badge "Estourando" do cartão
│       │   │   │
│       │   │   ├── investments/                # Componentes de investimentos
│       │   │   │   └── InvestmentTable.tsx       # Tabela de investimentos com CRUD (add/edit/delete)
│       │   │   │
│       │   │   ├── brand/                      # Marca
│       │   │   │   ├── Logo.tsx                  # Logo Placo (marca "P" + barras, cores só por tokens; props size, showWordmark; aria-label)
│       │   │   │   └── Logo.test.tsx             # Testes do logo (wordmark, aria, tamanhos, sem cor fixa)
│       │   │   │
│       │   │   ├── layout/                     # Componentes de layout
│   │   │               │   ├── AppLayout.tsx             # Layout principal: header desktop (md+), barra superior e de abas mobile, `+` global (AddTransactionDialog), conteúdo com padding para a barra
│   │   │               │   ├── MobileTabBar.tsx          # Barra de abas inferior (Início, Financeiro, +, Limites, Mais): ≥44px, safe-area, aria-current
│   │   │               │   ├── MobileTabBar.test.tsx     # Testes da barra de abas
│   │   │               │   ├── MobileTopBar.tsx          # Barra superior mobile (logo/título, slot de mês `MobileTopBarSlot`, sino)
│   │   │               │   ├── navigation.ts             # Abas, grupo "Mais", títulos por rota, isTabActive/getRouteTitle
│   │   │               │   ├── navigation.test.ts        # Testes de navigation.ts
│   │   │               │   ├── SidebarPanel.tsx          # Sidebar colapsável: tabs de metas, compras, resumo
│   │   │               │   ├── PageSkeleton.tsx          # Fallback de <Suspense> acessível (role=status, pt-BR) para rotas lazy
│   │   │               │   └── PageSkeleton.test.tsx     # Teste do fallback de carregamento
│   │   │               │
│   │   │               ├── notifications/               # Componentes de notificações de limites
│   │   │               │   ├── NotificationBell.tsx      # Sino de alertas no header (badge não-lidas, popover com severidade, marcar lido/todos)
│   │   │               │   └── NotificationBell.test.tsx # Testes do bell (badge, popover, marcar lido, vazio)
│   │   │               │
│   │   │               ├── auth/                        # Guard de autenticação
│   │   │               │   └── AuthGuard.tsx            # Redireciona para /login quando não há sessão (+ teste)
│   │   │               │   └── AuthGuard.test.tsx       # Testes do guard (redireciona sem sessão, renderiza com sessão)
│       │   │   │
│       │   │   ├── limits/                     # Componentes da feature de limites
│       │   │   │   ├── LimitsTab.tsx             # Aba de gerenciamento de limites por categoria; aviso de % pré-save (banner colorido 80/90/100) e toast antes de persistir
│       │   │   │   ├── LimitsTab.test.tsx        # Testes do aviso pré-save (cores por threshold, some ao aumentar limite, toast no save)
│       │   │   │   ├── RecorrentesTab.tsx        # Aba de contas recorrentes
│       │   │   │   ├── MetasTab.tsx              # Aba de metas financeiras
│       │   │   │   ├── ComprasTab.tsx            # Aba de lista de compras
│       │   │   │   └── ContaForm.tsx             # Formulário de criação/edição de conta recorrente
│       │   │   │
│       │   │   ├── recorrentes/                  # Feature compartilhada de contas recorrentes
│       │   │   │   └── RecurringBillsTable.tsx    # Tabela única usada por /recorrentes e aba Limites (helpers currentInstallment/isEndingSoon exportados); virtualizada (useVirtualizer, sticky header)
│       │   │   │
│       │   │   ├── TransactionList.tsx          # Lista de transações com filtros (memoizado), paginação e ações; virtualizada (useVirtualizer)
│       │   │   ├── CategoryBreakdownSection.tsx # Seção de breakdown de gastos por categoria
│       │   │   ├── ComprasList.tsx              # Lista de compras do mês com checkbox e CRUD
│       │   │   ├── MetasList.tsx                # Lista de metas com progresso e ações
│       │   │   └── AnimatedNumber.tsx           # Componente de número com animação de contagem
│       │   │
│       │   ├── pages/                          # Páginas (rotas da aplicação)
│       │   │   ├── Index.tsx                   # Página inicial: Visão Geral (OverviewDashboard)
│       │   │   ├── More.tsx                    # Página "Mais" (mobile): menu admin (recorrentes, extrato, investimentos), configurações, notificações, sair
│       │   │   ├── More.test.tsx               # Testes do menu Mais (admin vs usuário, sair)
│       │   │   ├── Financial.tsx               # Página financeira: dashboard + transações + sidebar
│       │   │   ├── Financial.test.tsx          # Testes de altura da tela (inicia 100vh, cresce até max 130vh)
│       │   │   ├── Investments.tsx             # Página de investimentos (placeholder)
│       │   │   ├── Limits.tsx                  # Página de limites: tabs por role (admin: Limites/Recorrentes/Metas/Compras; user: Limites/Recorrentes)
│       │   │   ├── Limits.test.tsx             # Testes das abas por role (user: sem Metas/Compras)
│       │   │   ├── RecurrentBills.tsx          # Página de contas recorrentes: lista + CRUD
│       │   │   ├── BankExtract.tsx             # Página de extrato bancário: upload + preview + confirmação
│       │   │   ├── Settings.tsx                # Página de configurações: perfil + bancos + Pluggy
│       │   │   ├── Login.tsx                   # Login email/senha (Supabase) — teste ao lado
│       │   │   ├── Login.test.tsx              # Testes do formulário de login
│       │   │   ├── SignUp.tsx                  # Cadastro de conta (todo novo usuário nasce como 'user'; admin só por promoção manual)
│       │   │   ├── ForgotPassword.tsx          # "Esqueci minha senha" (resetPasswordForEmail)
│       │   │   ├── UpdatePassword.tsx          # Redefinição de senha (retorno do link do e-mail)
│       │   │   └── NotFound.tsx                # Página 404
│       │   │
│       │   ├── services/                       # Camada de chamadas à API
│       │   │   ├── financialService.ts          # Transações, dashboard, categorias, limites (getLimits/saveLimits/getLimitsWithSpending)
│       │   │   ├── overviewService.ts            # Dashboard geral (OverviewDashboard) — GET /dashboard/overview
│       │   │   ├── recurringAccountService.ts   # Contas recorrentes
│       │   │   ├── goalsService.ts              # Metas financeiras
│       │   │   ├── shoppingService.ts           # Lista de compras
│       │   │   ├── extractService.ts            # Upload e confirmação de extratos
│       │   │   ├── settingsService.ts           # Perfil do usuário e bancos
│       │   │   ├── notificationService.ts       # Alertas de limites: GET /notifications, PUT read/read-all, GET /limits/risk-check (+ teste ao lado)
│       │   │   ├── notificationService.test.ts  # Testes do NotificationService (list, markRead, markAllRead, checkCategoryRisk)
│       │   │   └── boundary.test.ts             # Todos os services: payload válido parseia, malformado rejeita com ApiSchemaError (sem vazar payload)
│       │   │
│       │   ├── schemas/                        # Schemas Zod do contrato da API (espelham app/backend/app/schemas/); fonte dos tipos de resposta
│       │   │   ├── financial.ts                # Transações, extrato, rendimento anual, categorias, duplicatas, limites
│       │   │   ├── overview.ts                 # OverviewResponse
│       │   │   ├── recurringAccount.ts         # ContaRecorrenteResponse, GenerateResponse
│       │   │   ├── goals.ts                    # MetaResponse, MetaProgresso
│       │   │   ├── shopping.ts                 # ShoppingItemResponse
│       │   │   ├── extract.ts                  # UploadResponse, ConfirmResponse
│       │   │   ├── notifications.ts            # NotificationItem, NotificationsResponse, MarkReadResponse, CategoryRiskResponse
│       │   │   └── settings.ts                 # Perfil, bancos, BrasilAPI, Meu Pluggy
│       │   │
│       │   ├── types/                          # Tipos TypeScript (respostas da API derivadas dos schemas via z.infer; payloads de envio escritos à mão)
│       │   │   ├── financial.ts                # Transaction, YearlyData, FinancialSummary, CategoryBreakdown, etc.
│       │   │   ├── overview.ts                 # OverviewResponse + sub-tipos do dashboard geral
│       │   │   ├── recurringAccount.ts         # ContaRecorrente, ContaRecorrenteCreate/Update
│       │   │   ├── goals.ts                    # Meta, MetaCreate, MetaUpdate, MetaProgresso
│       │   │   ├── shopping.ts                 # ShoppingItem, ShoppingItemCreate/Update
│       │   │   ├── extract.ts                  # ParsedTransaction, UploadResponse, SessionData
│       │   │   └── notifications.ts            # NotificationItem, NotificationsResponse, CategoryRiskResponse
│       │   │
│       │   ├── hooks/                          # Custom React hooks
│       │   │   ├── use-mobile.tsx              # useIsMobile() — detecção de viewport mobile
│       │   │   ├── use-toast.ts                # useToast() — sistema de notificações toast
│       │   │   └── useLimitAlerts.ts           # useLimitAlerts() — poll de /notifications a cada 30s (+ listagem inicial)
│       │   │
│       │   ├── contexts/                       # React contexts
│       │   │   ├── SidebarContext.tsx           # SidebarContext — estado open/toggle da sidebar
│       │   │   ├── AuthContext.tsx              # AuthProvider/useSession — sessão Supabase (session/user/loading) + teste
│       │   │   ├── RoleContext.tsx              # RoleProvider/useRole — deriva isAdmin de profile.role ('admin'/'user'); refetch quando o usuário autenticado troca (evita role stale após logout/login)
│       │   │   ├── AuthContext.test.tsx         # Testes do AuthContext (mock do Supabase)
│       │   │   └── RoleContext.test.tsx         # Testes do RoleContext (refetch ao trocar de conta; admin/user paths)
│       │   │
│       │   ├── test/                            # Infra de testes frontend (Vitest + jsdom + RTL)
│       │   │   └── setup.ts                     # cleanup RTL + mocks matchMedia/ResizeObserver
│       │   │
│       │   └── lib/                            # Utilitários
│       │       ├── utils.ts                    # cn() — merge de classes Tailwind (shadcn)
│       │       ├── format.ts                   # formatCurrency/formatDate/formatPercent (fonte única de formatação)
│       │       ├── format.test.ts              # Testes unitários da formatação (BRL/USD, datas, %)
│       │       ├── format.escape.test.ts       # escapeHtml() para tooltips D3
│       │       ├── supabase.ts                 # Cliente @supabase/supabase-js (VITE_SUPABASE_URL/ANON_KEY)
│       │       ├── api.ts                      # apiFetch() — injeta Authorization: Bearer em chamadas /api/* + teste
│       │       └── api.test.ts                 # Testes do apiFetch (header auth, base URL, headers)
│       │
│       ├── public/                             # Assets estáticos
│       ├── Dockerfile                          # Build multi-stage para produção (nginx)
│       ├── Dockerfile.dev                      # Dev server Vite com hot-reload
│       ├── package.json                        # Dependências npm + scripts (test = vitest run, typecheck = tsc -b)
│       ├── package-lock.json                   # Lockfile npm
│       ├── vite.config.ts                      # Configuração do Vite + bloco `test` do Vitest (jsdom)
│       ├── tsconfig.json                       # Config TypeScript
│       ├── tailwind.config.ts                  # Config Tailwind CSS
│       └── index.html                          # HTML entry point
│
├── infra/                                      # Infraestrutura
│   └── nginx.conf                              # Reverse proxy: / → frontend, /api/ → backend (único exposed)
│   ├── nginx.prod.conf.template                # Proxy de produção (80→443, TLS, CSP, HSTS; ${DOMAIN} via envsubst)
│   └── snippets/                               # Trechos compartilhados (dev e prod)
│       ├── api-locations.conf                  # /api/: bloqueio de docs, rate limit, timeouts
│       └── proxy-api.conf                      # proxy_pass para o backend sem o prefixo /api
│
├── docker-compose-prod.yml                     # Stack de produção (db + backend + frontend + nginx TLS; sem segredos)
├── scripts/
│   ├── backup-db.sh                            # pg_dump -Fc com retenção
│   └── restore-db.sh                           # Restauração com confirmação
├── docker-compose.yml                          # Orquestração: db + backend + frontend + nginx
├── .env.example                                # Variáveis de ambiente (POSTGRES_* + SUPABASE_*)
├── .gitignore                                  # Ignorados: node_modules, .venv, __pycache__, docs/, etc.
├── AGENTS.md                                   # Guia para AI agents — estrutura e comandos
└── setup-docker.sh                             # Script de setup do Docker (adicionar user ao grupo docker)
```

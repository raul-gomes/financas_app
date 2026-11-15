# Estrutura de Arquivos — financas_app

> Atualizado em: 2026-09-15

```
financas_app/
├── app/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── main.py                         # FastAPI entry point: registra CORS, 12 routers, handler global de erro 500 genérico, endpoints / e /health; lifespan inicia/para job de notificações (limit_alert_job)
│   │   │   ├── logger.py                       # Loguru (console, arquivo, JSON, rotação); redact()/log_api_request() mascaram credenciais
│   │   │   │
│   │   │   ├── core/
│   │   │   │   ├── advisory_lock.py            # try_advisory_lock(engine, key): lock consultivo do Postgres em conexão dedicada (no-op em outros dialetos); LIMIT_ALERT_JOB_LOCK_KEY
│   │   │   │   ├── config.py                   # Classe Config + require_database_url (falha na partida sem DATABASE_URL): carrega DATABASE_URL, SUPABASE_JWT_SECRET, SUPABASE_AUTH_URL do .env
│   │   │   │   ├── crypto.py                   # Cifra em repouso da chave Pluggy (Fernet/MultiFernet): encrypt_secret/decrypt_secret, validate_encryption_keys (falha na partida), SecretDecryptionError, helpers idempotentes p/ migration
│   │   │   │   ├── database.py                 # Engine async SQLAlchemy, AsyncSessionLocal, get_session() dependency
│   │   │   │   ├── br_number.py                # parse_br_amount: valor digitado em pt-BR → Decimal (None se não for valor); usado na busca de transações
│   │   │   │   ├── errors.py                   # Exceções de domínio (DomainError, NotFoundError, ConflictError, ValidationError, UnprocessableError, ForbiddenError, PayloadTooLargeError, UpstreamError, ServerConfigError) + register_exception_handlers: único ponto que traduz para HTTP (mensagens pt-BR genéricas)
│   │   │   │   ├── unit_of_work.py             # UnitOfWork (commit/rollback único por request, after_commit para efeitos colaterais) + get_unit_of_work (usar com scope="function")
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
│   │   │   │   │   ├── category.py             # CategoriaRepository: CRUD categorias + sincronização de subcategorias (só flush; erros de domínio)
│   │   │   │   │   ├── subcategory.py          # SubcategoriaRepository: CRUD subcategorias, criação em lote (só flush)
│   │   │   │   │   ├── transaction.py          # TransacaoRepository: CRUD (flush, sem commit) + parcelas + detecção de duplicatas + listagem paginada por cursor (list_page com busca por texto, valor pt-BR e nome do banco do usuário; TransactionCursor/Filters/Page) + importação de extrato em lote (create_batch_from_extract, insert em savepoint) + assign_random_banks
│   │   │   │   │   ├── dashboard.py            # DashboardRepository: queries agregadas (gastos, rendimento, extrato com agregados dos gráficos numa query GROUP BY)
│   │   │   │   │   ├── overview.py             # DashboardOverviewRepository: dashboard geral (totais, progresso mês e cartão numa única agregação SQL — MonthAggregates; status limites, parcelas, recorrentes; metas/compras só admin)
│   │   │   │   │   ├── limits.py               # LimitsRepository: leitura de limites e gastos do mês (a atualização em lote é do LimitsService)
│   │   │   │   │   ├── recurring_account.py    # ContaRecorrenteRepository: CRUD + geração de parcelas + renovação (só flush)
│   │   │   │   │   ├── goal.py                 # MetaRepository: CRUD metas + cálculo de progresso baseado em transações
│   │   │   │   │   ├── shopping.py             # ShoppingRepository: CRUD lista de compras + migração de itens não marcados
│   │   │   │   │   ├── settings.py             # SettingsRepository: perfil do usuário + gerenciamento de bancos (só flush)
│   │   │   │   │   ├── limit_alert.py          # LimitAlertRepository: CRUD alertas de limite (create, list_for_user com notificações, mark read/read-all)
│   │   │   │   │   └── users.py                # get_or_create_user_from_supabase(): identidade pelo sub (supabase_id), vincula legado pelo e-mail, IdentityConflictError; novo cadastro nasce role='user'
│   │   │   │   │
│   │   │   │   └── migrations/                 # Alembic — migrações do banco
│   │   │   │       ├── env.py                  # Configuração do Alembic (lê DATABASE_URL do env)
│   │   │   │       ├── script.py.mako          # Template para novas migrações
│   │   │   │       └── versions/               # 15 migrações (desde criar_tabelas até create limit_alerts)
│   │   │   │
│   │   │   ├── routes/                         # Rotas FastAPI (API REST)
│   │   │   │   ├── transactions_routes.py      # /transacoes — CRUD, GET /paginated (cursor + total + filtros) e detecção/resolução de duplicatas; só HTTP, regras no TransactionService
│   │   │   │   ├── dependencies.py             # Providers FastAPI por domínio: get_*_service (unit of work, escrita) e get_*_reader/get_dashboard_service (leitura, sem commit) e parse_date (DD/MM/YYYY → ValidationError/400)
│   │   │   │   ├── categories_routes.py        # /categories — CRUD categorias; só HTTP, regras no CategoryService
│   │   │   │   ├── dashboard_routes.py         # /dashboard — extrato, overview, rendimento, gastos por categoria (só HTTP; usa DashboardService)
│   │   │   │   ├── limits_routes.py            # /limits — listar e atualizar limites em lote; /limits/risk-check projeta o valor digitado (gasto atual + amount → thresholds 80/90/100); só HTTP, regras no LimitsService
│   │   │   │   ├── recurring_accounts_routes.py # /recurring-accounts — CRUD + renovação + geração; só HTTP, regras no RecurringAccountService
│   │   │   │   ├── extract_routes.py           # /extracts — upload de extrato CSV/OFX (leitura em blocos, limite 10 MB) + confirmação; só HTTP, parsing/importação no ExtractService
│   │   │   │   ├── settings_routes.py          # /settings — perfil + bancos + atribuição aleatória; só HTTP, regras no SettingsService
│   │   │   │   ├── goals_routes.py             # /goals — CRUD metas + progresso (admin); só HTTP, regras no GoalService
│   │   │   │   ├── shopping_routes.py          # /shopping — CRUD lista de compras + migração (admin); só HTTP, regras no ShoppingService
│   │   │   │   ├── pluggy_routes.py            # /pluggy — integração Open Finance (contas, sincronização, validar chave); só HTTP, regras no PluggySyncService
│   │   │   │   ├── notifications_routes.py     # /notifications — listar alertas, marcar lido (1 ou todos); só HTTP, regras no NotificationService
│   │   │   │   └── export_routes.py            # /export — exportação CSV e OFX (admin); só HTTP, arquivos gerados pelo ExportService
│   │   │   │
│   │   │   ├── schemas/                        # DTOs Pydantic (validação de request/response)
│   │   │   │   ├── transaction.py              # TransacaoCreate/Response/Update, TransacaoPageResponse (paginação) + constantes TRANSACTIONS_*_PAGE_SIZE + schemas de duplicatas
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
│   │   │       ├── transaction_service.py      # TransactionService: casos de uso de transações (create/get/update/delete, list_page, duplicatas); autorização pelo usuário autenticado; avalia limites após o commit
│   │   │       ├── category_service.py         # CategoryService: casos de uso de categorias/subcategorias (list/get/create/update/delete), só flush; invalida o cache de opções após o commit
│   │   │       ├── limits_service.py           # LimitsService: limites por categoria, gastos do mês, risk-check e atualização em lote (cada item num savepoint: erro de um item vira `errors`, os demais seguem); só flush
│   │   │       ├── goal_service.py             # GoalService: metas do usuário (list_goals/create/update/delete/complete/reactivate/progress); NotFoundError/ConflictError; só flush
│   │   │       ├── shopping_service.py         # ShoppingService: lista de compras do usuário (list_month com rollover, create/update/delete, generate_recurring); NotFoundError; só flush
│   │   │       ├── settings_service.py         # SettingsService: perfil (nome, chave Pluggy cifrada), bancos e assign_random_banks do usuário; NotFoundError/ValidationError; só flush
│   │   │       ├── recurring_account_service.py # RecurringAccountService: contas recorrentes do usuário (CRUD, renew, generate); resolve/cria categoria e subcategoria por nome; avalia limites após o commit; só flush
│   │   │       ├── extract_service.py          # ExtractService: parse_upload (CSV/OFX por extensão ou conteúdo) e confirm (importação em lote, só flush; limites avaliados após o commit no mês mais antigo)
│   │   │       ├── pluggy_sync_service.py      # PluggySyncService: contas, validar chave e sync do Pluggy do usuário (chave decifrada do usuário autenticado), detecção de duplicatas; limites após o commit; pluggy_client_for
│   │   │       ├── notification_service.py     # NotificationService: alertas de limite do usuário (list_notifications, mark_read, mark_all_read); só altera linhas carregadas, commit da unit of work
│   │   │       ├── export_service.py           # ExportService: CSV/OFX das transações do usuário no período (leitura; relógio injetável) → ExportFile
│   │   │       ├── dashboard_service.py        # DashboardService: overview e dashboard financeiro (leitura); metas/compras só para admin decididas pelo role do token
│   │   │       ├── pluggy_service.py           # Cliente HTTP para API Meu Pluggy (Open Finance)
│   │   │       ├── extract_parsers.py          # Parsers de extrato bancário (CSV e OFX via defusedxml; UnsafeOfxError é um ValidationError)
│   │   │       ├── limit_alert_service.py      # LimitAlertService: avalia limites (evaluate_limits só faz flush, _evaluate_credit_card), send_alert_emails; trigger_limit_evaluation (commit próprio e só então e-mails) e evaluate_all_users_current_month (disparos pós-commit/job)
│   │   │       ├── email_service.py            # Envio de e-mails via Resend API (opt-in EMAIL_ALERTS_ENABLED; best-effort, nunca levanta)
│   │   │       └── limit_alert_job.py          # Job periódico de avaliação de limites (run_evaluation_once, _job_loop, start/stop) — roda no lifespan
│   │   │
│   │   ├── tests/                              # Suite de testes (pytest + pytest-asyncio)
│   │   │   ├── conftest.py                     # Fixtures: SQLite in-memory, httpx.AsyncClient, make_uow (service + UnitOfWork sobre a sessão de teste), factories de payload
│   │   │   ├── test_security.py                # Testes de autenticação JWT (HS256/ES256, aud, iss, alg none, sem segredo → 401) + require_role/require_admin (403)
│   │   │   ├── test_logger_redaction.py        # Credenciais nunca chegam ao log (redact, log_api_request)
│   │   │   ├── test_ofx_parser.py              # OFX 1.x (SGML) e 2.x (XML) reais
│   │   │   ├── test_batch_from_extract.py      # Lote por nome de categoria/subcategoria (sync Pluggy)
│   │   │   ├── test_admin_guard.py             # Etapa 9: rotas admin-only → 403 para role='user' (pluggy, export, shopping, goals, extract) + acesso user a recurring-accounts (generate segue 403)
│   │   │   ├── test_auth_required.py           # Etapa 4: cada rota sem token → 401 (client_no_auth)
│   │   │   ├── test_category_isolation.py      # Etapa 5: isolamento por usuário de categorias/subcategorias (via client_user2 + clients_ctrl)
│   │   │   ├── test_transaction_isolation.py   # Etapa 6: isolamento de transações por usuário (list, get, update, delete, duplicatas, extrato, export)
│   │   │   ├── test_user_scoped_repositories.py # S5/P1: export e dashboard só retornam dados do usuário (filtro no SQL)
│   │   │   ├── test_advisory_lock.py           # P5: lock consultivo (no-op fora do Postgres, SQL no Postgres, job pula se travado) e contagem de queries sem selectin
│   │   │   ├── test_domain_errors.py           # Exceções de domínio: status/mensagem por classe, handler único, causa interna nunca vaza, 500 genérico
│   │   │   ├── test_error_leak.py              # S9: erros internos nunca chegam ao cliente (mensagem genérica; texto real só no log)
│   │   │   ├── test_user_model_columns.py      # S8: guarda — `users` não tem coluna de senha
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
│   │   │   ├── test_crypto.py                  # Cifra da chave Pluggy: roundtrip, chave errada falha alto, rotação, chaves ausentes/inválidas, helpers idempotentes
│   │   │   ├── test_pluggy_key_encryption.py   # Perfil grava cifrado, string vazia remove, rotas Pluggy recebem a chave decifrada, 500 sem vazar se não decifra
│   │   │   ├── test_pluggy_key_migration.py    # Migration b8c9d0e1f2a3: cifra texto puro, idempotente, exige a chave só se houver o que cifrar, downgrade decifra
│   │   │   ├── test_migration_graph.py         # Revisões Alembic únicas e um único head
│   │   │   ├── test_startup_config.py          # B4: DATABASE_URL e PLUGGY_KEY_ENCRYPTION_KEYS obrigatórios (falha na partida) e descrição padrão do sync Pluggy
│   │   │   ├── test_goals.py                   # CRUD metas + progresso + duplicatas
│   │   │   ├── test_unit_of_work.py            # UnitOfWork: commit/rollback únicos, callbacks pós-commit (falha não desfaz o commit), dependência com scope="function"
│   │   │   ├── test_category_service.py        # CategoryService: nada comitado antes do UoW, rollback desfaz, cache invalidado após commit, isolamento entre usuários, 409 em nome duplicado
│   │   │   ├── test_limits_service.py          # LimitsService: bulk com item falhando isolado por savepoint (sem vazar texto), rollback, isolamento entre usuários, projeção do risk-check
│   │   │   ├── test_goal_service.py            # GoalService: nada comitado antes do UoW, rollback desfaz a categoria "Metas", 409 em nome duplicado, isolamento entre usuários, concluir/reativar
│   │   │   ├── test_shopping_service.py        # ShoppingService: nada comitado antes do UoW, rollback, isolamento entre usuários, completed_at ao marcar, rollover do mês
│   │   │   ├── test_settings_service.py        # SettingsService: rollback, bancos isolados por usuário, chave Pluggy cifrada/removida, assign_random_banks só com os bancos do usuário
│   │   │   ├── test_recurring_account_service.py # RecurringAccountService: rollback desfaz conta+parcelas+categoria, nomes resolvidos, 422, isolamento, desativar cancela futuras, limites avaliados após commit
│   │   │   ├── test_extract_service.py         # ExtractService: parse (extensão/conteúdo/OFX hostil), confirm só flush + rollback, limites após commit no mês mais antigo, falha do lote vira erro sem poluir a sessão
│   │   │   ├── test_pluggy_sync_service.py     # PluggySyncService: importação do usuário, rollback, duplicatas só do usuário, sem chave → 400, chave ilegível → 500 sem vazar, validate_key
│   │   │   ├── test_notification_service.py    # NotificationService: lista só do usuário (severity computada), marcar lido só vale após o commit, id alheio/inexistente = success False
│   │   │   ├── test_export_service.py          # ExportService: CSV/OFX exatos com relógio fixo, fim em aberto = hoje, só dados do usuário, data inválida → 400
│   │   │   ├── test_transactions_search.py     # GET /transacoes/paginated: busca por valor pt-BR (exato) e por nome do banco do usuário, OR com texto, total, isolamento entre usuários
│   │   │   ├── test_br_number.py               # parse_br_amount: formas aceitas (120, 120,50, 1.234,56, R$) e texto ignorado
│   │   │   ├── test_transaction_service.py     # TransactionService: nada comitado antes do UoW, rollback desfaz categoria auto-criada, limites avaliados após commit, isolamento entre usuários
│   │   │   ├── test_transactions_pagination.py # GET /transacoes/paginated: ordem estável (data desc, id desc), cursor, total, filtros, teto de página, isolamento
│   │   │   ├── test_dashboard_sql_parity.py    # Agregações SQL do dashboard/overview x referência em Python (PF/PJ, 2 usuários) + teto de queries
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
│       │   │   ├── ui/                         # shadcn-ui primitives + compostos (button, dialog, card, responsive-modal, confirm-dialog, bank-logo, bank-select, bank-search, currency-input, stat-card, empty-state, page-header, segmented-control, chip-group, etc.); smoke tests Vitest colocados (*.test.tsx ao lado). Obs: carousel.tsx e command.tsx REMOVIDOS (não usados; deps embla-carousel-react/cmdk removidas)
│       │   │   │
│       │   │   ├── charts/                     # Componentes de gráficos D3
│       │   │   │   ├── D3BarChart.tsx           # Gráfico de barras anual (income/expenses/investment por mês)
│       │   │   │   ├── D3DailyChart.tsx         # Gráfico de barras diário (breakdown do mês selecionado)
│       │   │   │   ├── D3HorizontalBarChart.tsx # Gráfico de barras horizontal (breakdown por categoria)
│       │   │   │   ├── D3LineChart.tsx          # Gráfico de linha (evolução temporal)
│       │   │   │   ├── D3PieChart.tsx           # Gráfico de pizza (proporção por categoria)
│       │   │   │   ├── FlippableChart.tsx       # Container 3D flip: frente (anual) + verso (diário)
│       │   │   │   ├── IncomeChart.tsx          # Gráfico de entradas por subcategoria
│       │   │   │   └── MonthlyBarsChart.tsx     # Barras agrupadas entradas × saídas (6 meses, mobile): legenda embaixo, toque lê o valor (+ teste)
│       │   │   │
│       │   │   ├── dialogs/                    # Componentes de modal/diálogo
│       │   │   ├── dialogs/                    # Componentes de modal/diálogo
│       │   │   │   ├── AddTransactionDialog.tsx      # Modal "Nova Transação" (bottom sheet no mobile): fluxo de criar (validação, checagem de duplicidade, API); os campos vêm do formulário compartilhado (components/transactions)
│       │   │   │   ├── AddTransactionDialog.test.tsx # Testes do aviso de limite estourado, tradução pt-BR, máscara de data dd/mm/yyyy, payload ISO e banco em linha inteira
│       │   │   │   ├── TransactionDialogsMobile.test.tsx # Testes do formulário no celular (segmentado, chips, Salvar em largura total) e do Editar
│       │   │   │   ├── EditTransactionDialog.tsx     # Modal "Editar Transação": mesmo formulário do Add, começando pelos valores da transação
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
│       │   │   │   ├── FinancialDashboard.tsx   # Dashboard financeiro: orçamento, gráfico flip (diário a partir de daily_totals), categorias; cartão com barra de % (>=80 warning, estourado destructive + badge "Estourando")
│       │   │   │   ├── ChartAnchors.tsx         # Âncoras de navegação que rolam até cada gráfico/seção do dashboard
│       │   │   │   ├── ChartAnchors.test.tsx    # Testes das âncoras (render, scrollIntoView, seção inexistente)
│       │   │   │   ├── PaymentKpiCards.tsx      # Cards Pix/Crédito/Débito/Parcelas: carrossel snap no mobile, grid de 4 colunas no md+; detalhe por banco; lê só os agregados do statement (expenses_by_payment_method/expenses_by_bank/installments_due), sem linhas
│       │   │   │   ├── PaymentKpiCards.test.tsx # Testes dos KPIs (totais, carrossel, detalhe por banco vindo do servidor, parcelas, estouro do limite)
│       │   │   │   ├── FixedVariableCard.tsx    # Card Gastos Fixos vs Variáveis (extraído do FinancialDashboard)
│       │   │   │   ├── FinancialMobile.tsx      # /financial abaixo de md: mês no topo, chips de seção, KPIs, gráfico de 6 meses, lançamentos por dia, categorias
│       │   │   │   ├── OverviewDashboard.tsx    # Dashboard geral da página inicial: indicadores, progresso mês, cartão (badge "Estourando" e tone 80/100), status limites, parcelas, recorrentes, metas/compras (admin); dados via useOverviewQuery (react-query)
│       │   │   │   ├── OverviewDashboard.test.tsx # Testes do dashboard geral (render, refetch por entidade, cache ao voltar de filtro, esqueleto/erro, isAdmin, badge cartão estourando)
│       │   │   │   ├── OverviewMobile.tsx       # Início no mobile (cards do mock): Ambos/PF/PJ, saldo do mês, progresso + cartão, perto do limite, a pagar, parcelas, metas/compras (admin) com "Ver tudo"
│       │   │   │   ├── OverviewMobile.test.tsx  # Testes do layout mobile (hero, perto do limite, listas limitadas a 3, admin, segmentado)
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
│   │   │               │   ├── AppLayout.tsx             # Layout principal: header desktop (md+, com links de Recorrentes e Extrato bancário para admin), barra superior e de abas mobile, `+` global (AddTransactionDialog; a página não remonta, o cache é invalidado), conteúdo com padding para a barra
│   │   │               │   ├── AppLayout.test.tsx        # Testes: + não remonta a página e invalida o cache; links de admin no header desktop
│   │   │               │   ├── MobileTabBar.tsx          # Barra de abas inferior (Início, Financeiro, +, Limites, Mais): ≥44px, safe-area, aria-current
│   │   │               │   ├── MobileTabBar.test.tsx     # Testes da barra de abas
│   │   │               │   ├── MobileTopBar.tsx          # Barra superior mobile (logo/título, slot de mês `MobileTopBarSlot`, sino)
│   │   │               │   ├── MonthStepper.tsx          # Seletor de mês compacto (‹ nov 2026 ›) para o slot da barra superior; addMonths/YearMonth (+ teste)
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
│       │   │   │   ├── LimitsTab.tsx             # Aba de limites por categoria: tabela no desktop, cards (LimitsCards) no mobile; aviso de % pré-save (banner colorido 80/90/100) e toast antes de persistir
│       │   │   │   ├── LimitsTab.test.tsx        # Testes do aviso pré-save (cores por threshold, some ao aumentar limite, toast no save)
│       │   │   │   ├── limitsModel.ts            # Modelo editável dos limites (Category, transformCategory, buildLimitsPayload, limitAlertFor, limitStatus) — funções puras
│       │   │   │   ├── limitsModel.test.ts       # Testes do modelo (payload novo/modificado/duplicado, alerta 80/90/100, status Restam/Passou)
│       │   │   │   ├── useLimitsDraft.ts         # Rascunho editável dos limites (react-query + ações + salvar) compartilhado por desktop e mobile
│       │   │   │   ├── LimitAlertBanner.tsx      # Banner de % de uso pré-save (data-testid limit-alert-*)
│       │   │   │   ├── LimitsCards.tsx           # Aba Categorias no mobile: um card por limite (barra, "Restam R$ X"/"Passou R$ X do limite"), + no topo cria
│       │   │   │   ├── LimitEditSheet.tsx        # Folha de edição de um limite: nome, valor com teclado decimal, subcategorias, excluir com confirmação
│       │   │   │   ├── LimitEditSheet.test.tsx   # Testes da folha de edição
│       │   │   │   ├── RecorrentesTab.tsx        # Aba de contas recorrentes
│       │   │   │   ├── MetasTab.tsx              # Aba de metas financeiras
│       │   │   │   ├── ComprasTab.tsx            # Aba de lista de compras
│       │   │   │   └── ContaForm.tsx             # Formulário de criação/edição de conta recorrente
│       │   │   │
│       │   │   ├── recorrentes/                  # Feature compartilhada de contas recorrentes
│       │   │   │   └── RecurringBillsTable.tsx    # Tabela única usada por /recorrentes e aba Limites (helpers currentInstallment/isEndingSoon exportados); virtualizada (useVirtualizer, sticky header)
│       │   │   │
│       │   │   ├── TransactionList.tsx          # Extrato paginado no servidor (useInfiniteQuery + "Carregar mais", busca com debounce, filtros período/PF-PJ); virtualizado (useVirtualizer); estados vazio/erro/carregando
│       │   │   ├── TransactionList.test.tsx     # Testes do extrato paginado (carregar mais, filtros no servidor, busca debounced, vazio, erro/tentar de novo)

│       │   │   ├── TransactionListMobile.tsx    # Lançamentos no mobile: Extrato (admin), busca + PF/PJ, linhas por dia, folha de detalhe (Editar/Excluir com confirmação)
│       │   │   ├── TransactionListMobile.test.tsx # Testes da lista mobile (agrupamento, valor com sinal, sem lixeira na linha, confirmação de exclusão)
│       │   │   ├── transactions/               # Peças da lista de lançamentos
│       │   │   │   ├── TransactionRowMobile.tsx   # Linha: ícone, descrição (2 linhas), categoria · pagamento, valor com sinal e cor
│       │   │   │   ├── TransactionDetailSheet.tsx # Folha de detalhe com Editar/Excluir (confirma antes de excluir)
│       │   │   │   └── transactionTone.ts         # Tokens de cor por tipo (income/expense/investment)
│       │   │   │   ├── transactionFormModel.ts    # Valores do formulário, máscara de data, valores iniciais (vazio/da transação), valor da parcela — funções puras
│       │   │   │   ├── transactionFormModel.test.ts # Testes do modelo do formulário
│       │   │   │   ├── useTransactionForm.ts      # Estado e carga de dados do formulário (categorias por PF/PJ e tipo, bancos, risco de limite) para criar e editar
│       │   │   │   ├── TransactionFormFields.tsx  # Escolhe o layout: folha mobile ou diálogo desktop
│       │   │   │   ├── TransactionFieldsDesktop.tsx # Layout do desktop (radios + switch PF/PJ, grids de 2 colunas)
│       │   │   │   ├── TransactionFieldsMobile.tsx  # Layout do mobile: Saída/Entrada/Investimento segmentado, valor grande, categoria + data lado a lado, chips de pagamento e PF/PJ
│       │   │   │   ├── TransactionSelects.tsx     # Campos de categoria, subcategoria e banco (com "Outra"/novo banco), usados pelos dois layouts
│       │   │   │   └── CategoryRiskBanner.tsx     # Aviso não bloqueante de % projetada do limite (80/90/100)
│       │   │   ├── CategoryBreakdownSection.tsx # Seção de breakdown de gastos por categoria
│       │   │   ├── ComprasList.tsx              # Lista de compras do mês com checkbox e CRUD (useShoppingItems + invalidação)
│       │   │   ├── MetasList.tsx                # Lista de metas com progresso e ações (useGoalsProgress + invalidação)
│       │   │   └── AnimatedNumber.tsx           # Componente de número com animação de contagem
│       │   │
│       │   ├── pages/                          # Páginas (rotas da aplicação)
│       │   │   ├── Index.tsx                   # Página inicial: Visão Geral (OverviewDashboard)
│       │   │   ├── More.tsx                    # Página "Mais" (mobile): menu admin (recorrentes, extrato, investimentos), configurações, notificações, sair
│       │   │   ├── More.test.tsx               # Testes do menu Mais (admin vs usuário, sair)
│       │   │   ├── Financial.tsx               # Página financeira: dashboard + transações + sidebar
│       │   │   ├── Financial.test.tsx          # Testes da página (altura, queries por bloco, PF/PJ, geração de recorrentes antes dos dados, virada de mês, exclusão recarrega)
│       │   │   ├── Settings.test.tsx           # Testes das Configurações (perfil/bancos em cache, remover banco, salvar nome, toast de erro)
│       │   │   ├── Investments.tsx             # Página de investimentos (placeholder)
│       │   │   ├── Limits.tsx                  # Página de limites: tabs por role no desktop; chips (Categorias/Recorrentes/Metas/Compras) + PF/PJ segmentado no mobile
│       │   │   ├── Limits.test.tsx             # Testes das abas por role (user: sem Metas/Compras)
│       │   │   ├── RecurrentBills.tsx          # Página de contas recorrentes: lista (react-query) + CRUD que invalida contas e lançamentos (+ RecurrentBills.test.tsx)
│       │   │   ├── BankExtract.tsx             # Página de extrato bancário: upload + preview + confirmação; categorias/bancos via react-query (+ BankExtract.test.tsx)
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
│       │   │   ├── useTransactionList.ts       # Dados da lista de lançamentos (paginada, busca com debounce, nomes de bancos) para desktop e mobile
│       │   │   ├── use-toast.ts                # useToast() — sistema de notificações toast
│       │   │   ├── useLimitAlerts.ts           # useLimitAlerts() — poll de /notifications a cada 30s (+ listagem inicial)
│       │   │   ├── useDebouncedValue.ts        # useDebouncedValue(value, ms) — usado na busca do extrato (+ teste ao lado)
│       │   │   └── queries/                    # Hooks react-query (um por domínio); a chave vem de lib/queryKeys
│       │   │       ├── useTransactionQueries.ts # useTransactionsInfinite (cursor), useYearInvestments, useTransactionMutations, invalidateTransactionData (+ teste)
│       │   │       ├── useFinancialQueries.ts   # Extrato do período, rendimento anual, categorias, useCategoryOptions (selects da importação), geração de recorrentes (admin)
│       │   │       ├── useOverviewQuery.ts      # Overview do mês (GET /dashboard/overview)
│       │   │       ├── useLimitsQueries.ts      # Limites, gastos do mês, recorrentes, metas, compras + invalidateDomain
│       │   │       ├── useRecurringQueries.ts   # invalidateRecurringData: atualiza as contas recorrentes e os lançamentos que elas geram/cancelam (+ teste)
│       │   │       ├── useSettingsQueries.ts    # Perfil e bancos (compartilhados com o extrato)
│       │   │       └── useErrorToast.ts         # Toast pt-BR quando uma query falha
│       │   │
│       │   ├── contexts/                       # React contexts
│       │   │   ├── SidebarContext.tsx           # SidebarContext — estado open/toggle da sidebar
│       │   │   ├── AuthContext.tsx              # AuthProvider/useSession — sessão Supabase (session/user/loading) + teste
│       │   │   ├── RoleContext.tsx              # RoleProvider/useRole — deriva isAdmin de profile.role ('admin'/'user'); refetch quando o usuário autenticado troca (evita role stale após logout/login)
│       │   │   ├── AuthContext.test.tsx         # Testes do AuthContext (mock do Supabase)
│       │   │   └── RoleContext.test.tsx         # Testes do RoleContext (refetch ao trocar de conta; admin/user paths)
│       │   │
│       │   ├── test/                            # Infra de testes frontend (Vitest + jsdom + RTL)
│       │   │   ├── setup.ts                     # cleanup RTL + mocks matchMedia/ResizeObserver
│       │   │   └── queryWrapper.tsx             # QueryClient de teste (retry off) + renderWithQuery/createQueryWrapper
│       │   │
│       │   └── lib/                            # Utilitários
│       │       ├── utils.ts                    # cn() — merge de classes Tailwind (shadcn)
│       │       ├── format.ts                   # formatCurrency/formatDate/formatPercent (fonte única de formatação)
│       │   │       ├── transactionGroups.ts        # Agrupa lançamentos por dia ("Hoje · 14 nov") e formata valor com sinal (+ teste)
│       │   │       ├── statementAggregates.ts      # Funções puras sobre os agregados do /dashboard/statement: gráfico diário (buildDailyData), total por forma de pagamento, itens por banco, parcelas (+ teste)
│       │   │       ├── months.ts                   # YearMonth, addMonths, toYearMonth, SHORT_MONTHS (+ teste)
│       │   │       ├── recentMonths.ts             # Janela dos últimos 6 meses a partir dos payloads anuais (+ teste)
│       │   │       ├── transactionLabels.ts        # Rótulos pt-BR de forma de pagamento, categoria automática e tipo (+ teste)
│       │   │       ├── reportLoadError.ts          # reportLoadError(toast, "os bancos", erro): log + toast pt-BR para carga em segundo plano que falhou (+ teste)
│       │       ├── format.test.ts              # Testes unitários da formatação (BRL/USD, datas, %)
│       │       ├── format.escape.test.ts       # escapeHtml() para tooltips D3
│       │       ├── supabase.ts                 # Cliente @supabase/supabase-js (VITE_SUPABASE_URL/ANON_KEY)
│       │       ├── queryClient.ts              # createQueryClient(): defaults (stale 5 min, gc 30 min, retry 1) e log único de erros de query
│       │       ├── queryKeys.ts                # Fábrica de chaves de cache (transactions, financial, overview, limits, recurring, goals, shopping, settings)
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

# Lineage de Dados — financas_app

> Documento de linhagem (lineage) dos dados: origem, transformações, armazenamento e consumo.
>
> **Última atualização:** 2026-11-14
> **Head do Alembic:** `c5d6e7f8a9b0` (29 migrações)
>
> ⚠️ **Manutenção obrigatória**: qualquer alteração em models (`app/db/models/`), migrações
> (`app/db/migrations/versions/`), repositories ou rotas que mude o fluxo de dados deve
> refletir aqui. Ver [Regras de Manutenção](#9-regras-de-manutenção).

---

## 1. Visão Geral

```
FONTES EXTERNAS            TRANSFORMAÇÃO (backend)         POSTGRESQL              CONSUMO
─────────────────          ───────────────────────          ─────────────           ───────────────────
Input manual (frontend) ─────────────────────────►┐
Upload CSV/OFX (parsers) ─► parse → staging HTTP ─┤
Pluggy API (Open Finance) ─► mapeamento DEBIT/CRIT┤──► transacoes ◄── recurring_accounts ──► Dashboard / Charts /
BrasilAPI (busca bancos) ─► cache em memória      │      ▲    ▲        (gera parcelas)       TransactionList / Export
                                                  │      │    │
                                                  ├──► categorias / subcategorias (resolve-ou-cria)
                                                  │                    │
                                                  │                    ├── target_amount ≠ null ⇒ "Metas"
                                                  │                    └── progresso = Σ transacoes/mês
                                                  │
├──► users / user_banks (perfil + chave Pluggy)
  └──► shopping_items (lista mensal, isolada — rollover de não-comprados p/ meses seguintes)

Sink (somente saída): GET /export/csv e /export/ofx → download de arquivo
```

**Hub central: tabela `transacoes`.** Recebe dados de 3 fontes externas + 1 fonte interna
(`recurring_accounts`) e alimenta dashboard, metas (progresso), limites (comparação) e export.

### 1.1 Isolamento de Dados por Usuário (concluído em Etapas 4–9)

A aplicação agora é **multi-usuário**: cada usuário é autenticado via JWT Supabase
(`get_current_user`) e vê **somente os seus dados**. As tabelas de dados possuem `user_id`
FK scoping as queries por usuário:

| Tabela | Escopo por `user_id` | Etapa |
|---|---|---|
| `categorias` | isolamento + unicidade `(name, entity_type, user_id)` | 5 |
| `transacoes` | isolamento em list/get/update/delete/duplicatas/extrato/export | 6 |
| `recurring_accounts` | isolamento + parcelas geradas herdam `user_id` | 7 |
| `shopping_items` | isolamento em list/create/update/delete/recurrent (rollover não-comprados) | 8 |
| `users` / `user_banks` | FK nativa | base |

**Roles (Etapa 9):** coluna `users.role` (string `admin`/`user`). Todo novo cadastro nasce
`role='user'` (sem bootstrap admin — promoção manual no banco). Apenas `pluggy`, `export`,
`shopping`, `goals`, `extract` e `recurring-accounts/generate` são **admin-only**
(`Depends(require_admin)` → 403 p/ `role='user'`). `recurring-accounts` (CRUD/leitura) é
acessível a qualquer role autenticada. `require_role(*roles)` está pronto p/ multi-role.

---

## 2. Catálogo de Tabelas

### 2.1 `transacoes` — fato central (`TransactionORM`)
| Coluna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | Integer PK | ✗ | autoincrement | index |
| `group_id` | String | ✗ | `uuid4()` | index — agrupa parcelas |
| `amount` | Float | ✗ | — | sempre positivo (sinal vai em `type`) |
| `description` | String | ✗ | — | max 255 na importação Pluggy/extrato |
| `installment_number` | Integer | ✓ | — | parcela atual (i/N) |
| `total_installments` | Integer | ✓ | — | total de parcelas |
| `is_installment` | Boolean | ✗ | `'false'` (server) | |
| `transaction_date` | DateTime | ✗ | — | data da movimentação |
| `created_at` / `updated_at` | DateTime | ✓ | `now()` | `updated_at` onupdate |
| `type` | String | ✗ | — | `income` \| `expense` \| `investment` |
| `entity_type` | String | ✗ | — | `individual` (PF) \| `business` (PJ) |
| `payment_method` | String | ✗ | — | ex: pix, credito, debito |
| `bank_code` | String | ✓ | NULL | 3 primeiros dígitos do banco (Pluggy) |
| `external_id` | String(64) | ✓ | NULL | id da transação no provedor (Pluggy); NULL em lançamento manual/extrato |
| `external_source` | String(16) | ✓ | NULL | origem do `external_id` (`pluggy`) |
| `category_id` | FK → `categorias.id` | ✗ | — | |
| `subcategory_id` | FK → `subcategorias.id` | ✗ | — | |
| `recurring_account_id` | FK → `recurring_accounts.id` | ✓ | NULL | index — marca despesa fixa |
| `user_id` | FK → `users.id` ON DELETE CASCADE | ✗ | — | index `ix_transacoes_user_id` — isolamento por usuário (Etapa 6) |

### 2.2 `categorias` — dimensão (`CategoryORM`)
| Coluna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | Integer PK | ✗ | — | index |
| `name` | String UNIQUE(name, entity_type, user_id)* | ✗ | — | *constraint `uq_categorias_name_entity_type_user` (Etapa 5) |
| `entity_type` | String | ✗ | — | `individual` \| `business` |
| `limit` | Float | ✓ | 0 | orçamento mensal da categoria |
| `type` | String | ✓ | NULL | `income` \| `expense` \| `investment` \| NULL (especial) |
| `user_id` | FK → `users.id` ON DELETE CASCADE | ✗ | — | index `ix_categorias_user_id` — ponto único de isolamento por usuário (Etapa 5) |

Relationships: `subcategories` 1:N cascade `all, delete-orphan`. Unicidade por usuário (mesmo nome pode existir p/ usuários diferentes).

### 2.3 `subcategorias` — dimensão + Metas (`SubcategoryORM`)
| Coluna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | Integer PK | ✗ | — | index |
| `name` | String | ✗ | — | |
| `category_id` | FK → `categorias.id` ON DELETE CASCADE | ✓ | — | isolada transitivamente via categoria pai (sem `user_id` próprio — Etapa 5) |
| `target_amount` | Float | ✓ | NULL | ≠ null ⇒ subcategoria é uma **Meta** |
| `completed` | Boolean | ✗ | false | meta concluída |
| `completed_at` | Date | ✓ | NULL | data de conclusão |

### 2.4 `recurring_accounts` — config de contas fixas (`RecurringAccountORM`)
| Coluna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | Integer PK | ✗ | — | index |
| `description` | String | ✗ | — | |
| `amount` | Float | ✗ | — | valor por parcela |
| `due_day` | Integer | ✗ | — | dia de vencimento |
| `category_id` / `subcategory_id` | FK → categorias/subcategorias | ✗ | — | |
| `entity_type` | String | ✗ | — | |
| `payment_method` | String | ✗ | — | |
| `bank_code` | String | ✓ | NULL | |
| `start_date` / `end_date` | DateTime | ✗ / ✓ | — | vigência |
| `active` | Boolean | ✗ | true | desativar deleta transações futuras |
| `group_id` | String | ✗ | `uuid4()` | index — liga conta às parcelas geradas |
| `total_installments` | Integer | ✗ | 12 | parcelas a gerar |
| `user_id` | FK → `users.id` ON DELETE CASCADE | ✗ | — | index `ix_recurring_accounts_user_id` — isolamento por usuário (Etapa 7) |

### 2.5 `shopping_items` — lista de compras (`ShoppingItemORM`)
| Coluna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | Integer PK | ✗ | — | index |
| `name` | String | ✗ | — | |
| `reference_month` | Date | ✗ | — | mês de referência |
| `checked` | Boolean | ✗ | false | seta/limpa `completed_at` automaticamente |
| `completed_at` | Date | ✓ | NULL | |
| `created_at` | DateTime | ✓ | `now()` | |
| `entity_type` | String | ✗ | `'individual'` (server) | |
| `user_id` | FK → `users.id` ON DELETE CASCADE | ✗ | — | index `ix_shopping_items_user_id` — isolamento por usuário (Etapa 8) |

> **Isolada por usuário**: não possui FK para outras tabelas de dados; itens não-comprados (checked=false) de meses
> anteriores aparecem rollover no `GET /shopping/?month=` até serem marcados. Não existe fluxo automático item → transação.

### 2.6 `users` — perfil (`UserORM`)
| Coluna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | Integer PK | ✗ | — | index |
| `name` | String | ✗ | `""` | |
| `email` | String UNIQUE | ✗ | — | segue o e-mail do Supabase (atualizado no login) |
| `supabase_id` | String(64) UNIQUE | ✓ | NULL | claim `sub` do Supabase: identidade estável; linhas antigas são vinculadas pelo e-mail no próximo login |
| `pluggy_api_key` | String | ✓ | NULL | chave Open Finance por usuário; **cifrada em repouso** (Fernet, `core/crypto.py`, chaves em `PLUGGY_KEY_ENCRYPTION_KEYS`; só o token `gAAAAA…` vai ao banco); **nunca devolvida pela API** (`has_pluggy_key`); decifrada só em `routes/pluggy_routes.py` para chamar a Pluggy (S2) |
| `role` | String(32) | ✗ | `'user'` (server) | enum: `admin`, `user` (pronto p/ multi-role) — substitui a coluna `is_admin` legada na Etapa 9; todo cadastro nasce `user` (admin só por promoção manual) |

Relationships: `banks` 1:N cascade `all, delete-orphan`.

### 2.7 `user_banks` — bancos do usuário (`UserBankORM`)
| Coluna | Tipo | Null | Default |
|---|---|---|---|
| `id` | Integer PK | ✗ | — |
| `user_id` | FK → `users.id` ON DELETE CASCADE | ✗ | — |
| `bank_code` | String | ✗ | — |
| `bank_name` | String | ✗ | — |
| `created_at` | DateTime | ✓ | `now()` |

### 2.8 `limit_alerts` — alertas de limite (etapa notificações) (`LimitAlertORM`)
| Coluna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| `id` | Integer PK | ✗ | — | |
| `user_id` | FK → `users.id` ON DELETE CASCADE | ✗ | — | index `ix_limit_alerts_user_id` — isolamento por usuário |
| `category_id` | FK → `categorias.id` ON DELETE CASCADE | ✗ | — | index `ix_limit_alerts_category_id`; é a própria categoria quando `scope='category'`, ou a categoria "Limite Cartao Credito" quando `scope='credit_card'` |
| `scope` | String(32) | ✗ | `'category'` | `category` \| `credit_card` |
| `month` | String(7) | ✗ | — | `YYYY-MM` — mês de referência do alerta |
| `threshold` | Integer | ✗ | — | 70 \| 80 \| 90 \| 100 |
| `exceeded` | Boolean | ✗ | `'false'` | `percent_used > 100` |
| `percent_used` | Float | ✗ | `0.0` | arredondado 1 casa |
| `read_at` | DateTime | ✓ | — | marcado quando usuário lê no frontend |
| `email_sent` | Boolean | ✗ | `'false'` | e-mail Resend já enviado |
| `created_at` | DateTime | ✓ | `now()` | |

Constraint única: `uq_limit_alerts_user_cat_month_threshold` `(user_id, category_id, month, threshold)`
→ a avaliação de limites é **idempotente** (alerta não duplica ao reavaliar o mesmo mês).

**Sink:** para fora da aplicação via Resend API (`services/email_service.py`, opt-in
`EMAIL_ALERTS_ENABLED`). A tabela **só é escrita pelo job/serviço de notificações** — nunca por input do usuário.

---

## 3. Fontes de Dados (entradas)

### 3.1 Pluggy API / Open Finance (`services/pluggy_service.py`)
- Origem: `https://api.pluggy.ai`, autenticado por `X-API-Key` lida de `users.pluggy_api_key` (decifrada em memória por `pluggy_client_for`).
- Endpoints externos chamados: `GET /items` (conexões), `GET /accounts`, `GET /transactions`
  (paginado, limite de segurança `MAX_PAGES = 50`).
- **Não persiste nada diretamente** — a escrita ocorre apenas em `POST /pluggy/sync`.

### 3.2 Upload CSV/OFX (`services/extract_parsers.py`) — parsers puros, sem acesso ao BD
Saída comum: `{date: 'DD/MM/YYYY', description, amount(abs), type: 'expense'|'income'}`.

| Parser | Entrada | Transformações |
|---|---|---|
| `parse_csv(content, delimiter=None)` | CSV textual | Delimitador auto-detectado (`;` → `\t` → `,`); mapeamento fuzzy de colunas PT/EN (data/date, valor/amount, descricao/description) com fallback posicional; 6 formatos de data + 2 fallbacks regex; valores BR (`1.234,56`); sinal negativo ⇒ expense; linhas inválidas descartadas silenciosamente |
| `parse_ofx(content)` | OFX/QFX SGML | Limpeza de tags via regex; blocos `STMTTRN`; `DTPOSTED` `%Y%m%d`; descrição = `MEMO` ou `NAME`; mesmo tratamento de sinal/data/abs do CSV |

### 3.3 Input manual do frontend
Formulários (transações, categorias, metas, compras, contas recorrentes, perfil/bancos)
enviados como JSON pelas rotas REST.

### 3.4 BrasilAPI (externa, somente leitura no cliente)
`https://brasilapi.com.br/api/banks/v1` — busca de bancos para cadastro em `user_banks`;
cache estático em memória (`SettingsService.#banksCache`). Não toca no backend.

---

## 4. Transformações Principais

| # | Transformação | Onde | Detalhes |
|---|---|---|---|
| T1 | **Geração de parcelas** | `POST /transacoes/`, `POST /extracts/confirm` (se `total_installments > 1`) | N linhas em `transacoes` com mesmo `group_id` (uuid); datas +1 mês preservando dia (clamp ao último dia); descrição `"desc - parcela i/N"`; última parcela ajustada para compensar arredondamento |
| T2 | **Resolve-ou-cria categoria/subcategoria** | criação/edição de transação, extrato, Pluggy, contas recorrentes | Busca por nome (+ entity_type); cria como efeito colateral se não existir |
| T3 | **Geração de parcelas recorrentes** | `POST /recurring-accounts/`, `/{id}/renew`, `/generate` | Cria `total_installments` transações mensais em `transacoes` vinculadas por `recurring_account_id` + `group_id`; tipo fixo `expense`; **idempotente por group_id + ano-mês**; `renew` move `start_date` e gera +12 |
| T4 | **Desativação/exclusão de recorrente** | `PUT/DELETE /recurring-accounts/{id}` | Desativar ⇒ DELETE transações futuras (data ≥ início do mês corrente); excluir ⇒ DELETE de todas as transações vinculadas (cascade manual) antes da conta |
| T5 | **Sync Pluggy → transacoes** | `POST /pluggy/sync` | Mapeamento `DEBIT→expense` / `CREDIT→income`; abs(); `payment_method` de `paymentMethod/category` (default "pix"); `bank_code` = 3 primeiros dígitos da conta BANK; força `entity_type=PF` + categoria "Importado"/sub "Pluggy" (auto-criadas); descrição truncada a 255; depois **detecta duplicatas e apenas reporta** |
| T6 | **Detecção/resolução de duplicatas** | `POST /transacoes/check-duplicates` e `/resolve-duplicates` | Match por mesmo dia (ignora hora) + mesmo valor; ações: `keep_both`, `keep_new` (deleta existente), `keep_existing` (deleta nova) |
| T7 | **Importação de extrato** | `POST /extracts/upload` + `/confirm` | Upload = staging stateless (resposta HTTP, sem persistência; máx 10 MB; totais income/expense agregados). Confirm = `ExtractService.confirm` → `TransacaoRepository.create_batch_from_extract` (lote único, flush; 1 commit pela UnitOfWork; o insert do lote roda num savepoint), converte `DD/MM/YYYY` → datetime, suporta parcelamento |
| T8 | **Bulk update de limites** | `PUT /limits/` | 3 listas: `deleted` (exclui cats), `new` (cria cat+subs), `modified` (atualiza cat + cria/atualiza subs); sincronização nunca deleta subcategorias via `PUT /categories` |
| T9 | **Progresso de metas** | `GET /goals/progress` | `SUM(transacoes.amount)` agrupado por `subcategory_id` no mês ⇒ `% = atual/target×100` |
| T10 | **Assign aleatório de bancos (demo)** | `POST /settings/assign-random-banks` | UPDATE `transacoes.bank_code` com banco aleatório de `user_banks` onde NULL |

---

## 5. Matriz Rota → Tabelas (backend)

Legenda: 📖 lê · ✏️ escreve · 🗑 delete

| Rota | Método(s) | Repositório/Serviço | Lê | Escreve | Transformação |
|---|---|---|---|---|---|
| `/transacoes` | POST, GET, GET/{id}, PUT, DELETE | TransactionService → TransacaoRepository (1 commit por request via UnitOfWork) | transacoes, categorias, subcategorias, limit_alerts* | transacoes (+cats/subs via T2, no mesmo commit), limit_alerts* (*disparo após o commit: `trigger_limit_evaluation` avalia limites e grava alertas) | T1, T2, T6 |
| `/transacoes/paginated` | GET | TransactionService → TransacaoRepository.list_page | transacoes (+joins cats/subs) + user_banks (busca por nome do banco) | — | página por cursor (keyset `transaction_date desc, id desc`) + `total`; filtros período, PF/PJ, tipo, categoria e texto (`ILIKE` em descrição, categoria, subcategoria, forma de pagamento e nome do banco do usuário via `user_banks.bank_code`) e valor pt-BR (`amount` exato ao centavo) |
| `/transacoes/check-duplicates` · `/resolve-duplicates` | POST | TransactionService → TransacaoRepository | transacoes | transacoes (🗑 em resolve) | T6 |
| `/extracts/upload` | POST | ExtractService.parse_upload → extract_parsers | — (arquivo em memória) | **nada** | T7 (staging stateless) |
| `/extracts/confirm` | POST | ExtractService → TransacaoRepository.create_batch_from_extract (1 commit por request via UnitOfWork) | categorias, subcategorias, limit_alerts* | transacoes (+dims T2), limit_alerts* (*disparo post-commit, mês = menor data do lote) | T7, T1 |
| `/dashboard/statement` | GET | DashboardService → DashboardRepository | transacoes (+joins cats/subs), user_banks (nomes) | — | totais (entradas/saídas/investido/fixos/variáveis) agregados em SQL numa query; agregados dos gráficos (`daily_totals`, `expenses_by_payment_method`, `expenses_by_bank`, `installments_due`) numa única query `GROUP BY` dia/tipo/forma/banco/parcelado (+ nomes dos bancos em `user_banks`); sem lista de linhas (o frontend pagina em `/transacoes/paginated`); fixed vs variable por `recurring_account_id`; metas mensais das categorias **"Mensal PF"/"Mensal PJ"**; limite cartão de **"Limite Cartao Credito"** (fallback 1000.0) |
| `/dashboard/overview` | GET | DashboardService → DashboardOverviewRepository | transacoes, categorias, recurring_accounts, subcategorias, shopping_items | — | **dashboard geral da página principal** (totais, progresso até hoje e cartão vêm de **uma** agregação SQL com SUM condicional): totais + progresso até hoje + cartão de crédito + status de categorias com limite (só ≥70%: warning/over — estouradas ou quase) + parcelas do mês + recorrentes a pagar; metas/compras **somente admin** (reusa LimitsRepository, MetaRepository, ShoppingRepository, ContaRecorrenteRepository) |
| `/dashboard/period-income` | GET | DashboardService → DashboardRepository | transacoes, categorias | — | GROUP BY mês/tipo |
| `/dashboard/expenses-by-category` · `/income-by-category` · `/category-options` | GET | DashboardService → DashboardRepository | transacoes, categorias, subcategorias | — | `GROUP BY` categoria/subcategoria em SQL (1 query) |
| `/categories` | CRUD | CategoryService → CategoriaRepository / SubcategoriaRepository (1 commit por request via UnitOfWork) | categorias | categorias, subcategorias (sync no PUT) | T8 parcial |
| `/limits` | GET, PUT | LimitsService → LimitsRepository (leitura) + CategoriaRepository / SubcategoriaRepository (PUT em lote: cada item num savepoint, 1 commit por request) | categorias, subcategorias | categorias, subcategorias | T8 |
| `/limits/risk-check` | GET | LimitsService.category_risk → LimitsRepository.get_limits_with_spending | categorias, subcategorias, transacoes (spending) | — | projeção de risco p/ o mês do usuário: `spent` + `amount` (valor digitado) → `projected_spent`/`projected_percent_used`/`thresholds_hit` (80/90/100)/`severity`/`is_over_limit` (banner do AddTransactionDialog "Segure a mão") |
| `/recurring-accounts` | POST, GET, PUT, DELETE | RecurringAccountService → ContaRecorrenteRepository (+ Categoria/SubcategoriaRepository para resolver nomes; 1 commit por request) | recurring_accounts, transacoes, categorias, subcategorias | recurring_accounts, transacoes | T3, T4 |
| `/recurring-accounts/{id}/renew` · `/generate` | POST | idem | idem | transacoes, recurring_accounts, limit_alerts* (*disparo no generate, mês = start_date) | T3 |
| `/goals` | CRUD | GoalService → MetaRepository | subcategorias, categorias | subcategorias (+cat "Metas") | metas = subcategorias com `target_amount ≠ null` |
| `/goals/progress` | GET | GoalService → MetaRepository | subcategorias, transacoes | — | T9 |
| `/goals/{id}/complete` · `/reactivate` | PUT | GoalService → MetaRepository | subcategorias | subcategorias | completed/completed_at |
| `/shopping` | GET, POST, PUT, DELETE | ShoppingService → ShoppingRepository | shopping_items | shopping_items | **ROLLOVER no GET**: inclui itens NÃO-marcados (não comprados) de meses anteriores além do mês atual; toggle checked ⇄ completed_at |
| `/settings/profile` | GET, PUT | SettingsService → SettingsRepository | users | users | chave Pluggy cifrada (Fernet); e-mail e senha ficam no Supabase |
| `/settings/banks[...]` | GET, POST, DELETE | SettingsService → SettingsRepository | user_banks | user_banks | — |
| `/settings/assign-random-banks` | POST | SettingsService → SettingsRepository + TransacaoRepository | user_banks | transacoes | T10 |
| `/pluggy/accounts` · `/validate-key` | GET | PluggySyncService → PluggyService (cliente HTTP) | users (api key) | — | consulta externa, sem persistência |
| `/pluggy/sync` | POST | PluggySyncService → PluggyService (cliente HTTP) + TransacaoRepository (1 commit por request via UnitOfWork) | users; API Pluggy | transacoes (+dims T2), limit_alerts* (*disparo, mês atual) | T5 |
| `/export/csv` · `/export/ofx` | GET | ExportService → ExportRepository (leitura) | transacoes (+cats/subs) | **sink** — download | CSV 11 colunas; OFX 1.0 SGML gerado manualmente |
| `/notifications` | GET | NotificationService → LimitAlertRepository | limit_alerts | — | lista alertas do usuário + `unread_count`; `severity`/`message` computados no schema por **threshold 80/90/100** (BFF, cores separadas) |
| `/notifications/{id}/read` · `/read-all` | PUT | NotificationService → LimitAlertRepository (commit pela UnitOfWork) | limit_alerts | limit_alerts (`read_at`) | marca como lido (id único ou todos do usuário) |
| `/health` | GET | — | — | — | — |

---

## 6. Grafo de Fluxo entre Tabelas

```
                        ┌──────────────────────────────────────────────┐
                        │                FONTES EXTERNAS               │
                        │  Pluggy API · CSV/OFX upload · input manual  │
                        └───────────────┬──────────────────────────────┘
                                        │ T5 / T7 / direto
                                        ▼
 users.pluggy_api_key ── autentica ─► transacoes ◄═════╗
                          (sync/import)   ▲  ▲          ║ T3 (gera parcelas,
                                          │  │          ║     idempotente/mês)
                     T1 (parcelamento) ───┘  │          ║
                                          │  │   recurring_accounts ═╝
                                          │  │     │  │
                              T2 ─────────┘  │     │  └─ desativar ⇒ DELETE futuras (T4)
                              (auto-cria)    │     └──── excluir  ⇒ DELETE todas (T4)
                              ┌──────────────┴──┐
                              ▼                 ▼
                         categorias ◄──── subcategorias
                              │                 │
             limit "Mensal PF/PJ",            target_amount ≠ null ⇒ METAS
             "Limite Cartao Credito"                ▲
                              │                     │ T9: progresso =
                              ▼                     │ Σ transacoes.amount (mês)
                       dashboard/* (leitura) ───────┤
                                                    │
 shopping_items ── ROLLOVER (query-time, GET por mês) ──► meses seguintes até comprar

 users ──1:N CASCADE──► user_banks ── T10 (demo) ──► transacoes.bank_code
 transacoes ── export csv/ofx ──► ARQUIVO (sink, sem escrita)

 limite de categoria / cartão
      └──► limit_alerts (80/90/100% + exceeded) ──► e-mail Resend (sink, opt-in)
                                      ▲      disparedo por:
                                      │        · create/update/delete transação (mesmo mês)
                                      │        · extrato confirm (menor data) · pluggy sync (mês atual)
                                      │        · recurring generate (start_date)
                                      └────────· job periódico /limit_alert_job (todos usuários, mês atual)
```

---

## 7. Consumo no Frontend (banco → API → telas)

Base URL: `VITE_API_URL || '/api'` (proxy nginx `/api/` → backend :8000).
**Nenhum uso de localStorage/sessionStorage** — única persistência durável é o PostgreSQL;
staging de extrato vive em React state (perdido ao recarregar).

| Service | Endpoint(s) | Dado | Tela(s) |
|---|---|---|---|
| financialService | `/dashboard/statement`, `/period-income`, `/expenses-by-category`, `/income-by-category`, `/category-options`, `/transacoes` (GET/POST/PUT/DELETE), `/transacoes/check-duplicates`, `/categories`, `/limits`, `/limits/with-spending` | resumo, gráficos, CRUD transações, limites (+ % pré-save no LimitsTab) | Financial, AddTransactionDialog, TransactionList, BankExtract, LimitsTab |
| recurringAccountService | `/recurring-accounts` (CRUD, renew, generate) | contas recorrentes | RecurrentBills, RecorrentesTab; `generate` disparado pelo Financial ao trocar período |
| overviewService | `/dashboard/overview` | dashboard geral (indicadores, status limites, parcelas, recorrentes, crédito, metas, compras) | **Index (página principal)** via OverviewDashboard |
| goalsService | `/goals` (CRUD, complete, reactivate, progress) | metas + progresso | MetasTab (Limits), MetasList (dashboard) |
| shoppingService | `/shopping` (CRUD) | lista de compras | ComprasTab (Limits) |
| extractService | `/extracts/upload`, `/extracts/confirm` | parse + persistência de extrato | ExtratoUploadModal (TransactionList), BankExtract |
| settingsService | `/settings/profile`, `/settings/banks`, `/pluggy/validate-key`, `/pluggy/accounts`, `/pluggy/sync`, `/export/csv`, `/export/ofx` | perfil, bancos, sync Open Finance, downloads | Settings; banks também usados em BankExtract e ContaForm |
| notificationService | `/notifications` (GET), `/notifications/{id}/read` e `/notifications/read-all` (PUT), `/limits/risk-check?category_id=` | alertas de limite (bell no header) + risco da categoria no AddTransactionDialog | NotificationBell (poll 30s via useLimitAlerts), AddTransactionDialog (banner "Segure a mão") |

Endpoints sem chamadores (código morto): `getAllTransactions`, `resolveDuplicates`,
`GET /recurring-accounts/{id}`, `POST /shopping/generate-recurring`.

---

## 8. Histórico de Migrações (Alembic)

Cadeia linear (root → head):

| # | Revision | Migração | Efeito |
|---|---|---|---|
| 1 | `a1b2c3d4e5f6` | criar_todas_tabelas | Cria `categorias` (categoria_nome, natureza, limite), `subcategorias`, `transacoes`, `contas_recorrentes` (nomes PT) |
| 2 | `b2c3d4e5f6a7` | add conta_recorrente_id to transacoes | Coluna `conta_recorrente_id` + índice/FK |
| 3 | `c3d4e5f6a7b8` | add tipo to categorias | Coluna `tipo` (income/expense/investment/null) |
| 4 | `c4d5e6f7a8b9` | add total_parcelas to contas_recorrentes | `total_parcelas` default 12 |
| 5 | `d5e6f7a8b9c0` | add users and user_banks | Novas tabelas `users` e `user_banks` |
| 6 | `e6f7a8b9c0d1` | add bank_code to transacoes | Coluna nullable |
| 7 | `f7a8b9c0d1e2` | add valor_alvo to subcategorias + create shopping_items | `valor_alvo` + nova tabela `shopping_items` |
| 8 | `a1b2c3d4e5f7` | add pluggy_api_key to users | Coluna nullable |
| 9 | `b1c2d3e4f5f6` | add concluida/data_conclusao | `concluida`+`data_conclusao` em subcategorias; `data_conclusao` em shopping_items |
| 10 | `c1d2e3f4f5f6` | add bank_code to contas_recorrentes | Coluna nullable |
| 11 | `d1e2f3a4b5c6` | add is_parcelado to transacoes | Boolean default false |
| 12 | `a0b1c2d3e4f5` | normalize_english_names | Renomeia todas as colunas PT→EN; `contas_recorrentes` → `recurring_accounts` |
| 13 | `e0f1a2b3c4d5` | add entity_type to shopping_items | String default 'individual' |
| 14 | `dfc6bf881c13` | unique(name) → unique(name, entity_type) em categorias | Constraint `uq_categorias_name_entity_type` |
| 15 | `36a95d2e5251` | add_recurring_fields_to_shopping_items | Campos recorrentes em shopping_items |
| 16 | `1078188c8bbe` | add_composite_indexes_transacoes (Fase 1 perf) | Índices `idx_transacoes_entity_date`, `idx_transacoes_type_date`, `idx_transacoes_cat_date`, `idx_transacoes_recurring`, `idx_transacoes_group` |
| 17 | `2a3b4c5d6e7f` | add_recurring_and_subcat_indexes (Fase 4.1 perf) | Índices `idx_recurring_entity_start` (recurring_accounts) e `idx_transacoes_subcat_date` (transacoes) |
| 18 | `3b4c5d6e7f80` | add_is_admin_to_users | Coluna `is_admin` Boolean (legada — migrada para `role` na Etapa 9 via `e3f4a5b6c7d8`) |
| 19 | `a7b8c9d0e1f2` | add_user_id_to_categorias (Etapa 5) | `categorias.user_id` FK NOT NULL + índice `ix_categorias_user_id`; backfill p/ user 1; unicidade `(name, entity_type)` → `(name, entity_type, user_id)` |
| 20 | `b9c0d1e2f3a4` | add_user_id_to_transacoes (Etapa 6) | `transacoes.user_id` FK NOT NULL + índice `ix_transacoes_user_id`; backfill p/ user 1 |
| 21 | `c1d2e3f4a5b6` | add_user_id_to_recurring_accounts (Etapa 7) | `recurring_accounts.user_id` FK NOT NULL + índice `ix_recurring_accounts_user_id`; backfill p/ user 1 |
| 22 | `d2e3f4a5b6c7` | add_user_id_to_shopping_items (Etapa 8) | `shopping_items.user_id` FK NOT NULL + índice `ix_shopping_items_user_id`; backfill p/ user 1 |
| 23 | `e3f4a5b6c7d8` | replace_is_admin_with_role (Etapa 9) | `users.is_admin` Bool → `role` String(32) default `'user'`; `TRUNCATE`/`UPDATE` admin→'admin' / user→'user'; remove `is_admin` |
| 24 | `f0a1b2c3d4e5` | create limit_alerts (notificações de limites) | Nova tabela `limit_alerts` (alertas 80/90/100 + exceeded, scope category/credit_card, `read_at`/`email_sent`), FKs CASCADE p/ users/categorias, constr. única `(user_id, category_id, month, threshold)`, índices `ix_limit_alerts_user_id`/`ix_limit_alerts_category_id` |
| 25 | `c9d0e1f2a3b4` | add users.supabase_id | Coluna `supabase_id` String(64) nullable + índice único `ix_users_supabase_id`; identidade pelo `sub` em vez do e-mail (S4) |
| 26 | `b8c9d0e1f2a3` | encrypt_pluggy_api_key (S2) | Só dados: cifra com Fernet os `users.pluggy_api_key` em texto puro (idempotente: pula valores `gAAAAA…`; exige `PLUGGY_KEY_ENCRYPTION_KEYS` só se houver o que cifrar); downgrade decifra. Sem mudança de tipo (VARCHAR sem limite). Também: `c9d0e1f2a3b4` ganhou id próprio (antes duplicava `a7b8c9d0e1f2`, e o Alembic via dois heads) |
| 27 | `a2b3c4d5e6f7` | align_indexes_with_models | Renomeia `ix_contas_recorrentes_group_id`/`_id` e `ix_transacoes_conta_recorrente_id` para os nomes dos models; remove o duplicado `idx_transacoes_group`. Os índices compostos passaram a ser declarados nos models (`alembic check` zerado) |
| 28 | `b3c4d5e6f7a8` | drop_users_password_hash | Remove `users.password_hash` (legado, nunca lido); o downgrade recria a coluna nullable (S8) |
| 29 | `c5d6e7f8a9b0` | add_external_id_to_transacoes (**HEAD**) | `transacoes.external_id` (String 64) e `external_source` (String 16), ambos NULL; índice único parcial `uq_transacoes_user_external` em `(user_id, external_source, external_id)` onde `external_id IS NOT NULL` (dedupe do sync Pluggy) |

---

## 9. Regras de Manutenção

Este documento **deve ser atualizado** quando qualquer um destes mudar:

1. **Models** (`app/backend/app/db/models/*.py`) — nova tabela, coluna, FK, constraint ou relationship
   ⇒ atualizar [Catálogo de Tabelas](#2-catálogo-de-tabelas) e, se afetar fluxos, as seções 4–6.
2. **Migrações** (novo arquivo em `app/db/migrations/versions/`) ⇒ adicionar linha na
   [seção 8](#8-histórico-de-migrações-alembic) com revision, nome e efeito; atualizar o head no topo do documento.
3. **Repositories/Routes** que passem a ler ou escrever outra tabela ⇒ atualizar
   [Matriz Rota → Tabelas](#5-matriz-rota--tabelas-backend) e o [grafo](#6-grafo-de-fluxo-entre-tabelas).
4. **Services** com nova fonte externa ou transformação ⇒ atualizar
   [Fontes de Dados](#3-fontes-de-dados-entradas) e [Transformações](#4-transformações-principais).
5. **Frontend services** consumindo novo endpoint ou tela ⇒ atualizar [seção 7](#7-consumo-no-frontend-banco--api--telas).
6. Sempre atualizar o campo **"Última atualização"** no topo.
7. **Atenção**: o script de seed (`app/scripts/seed.py`) recria o schema via
   `Base.metadata.drop_all/create_all` — ou seja, a partir dos **models**, não das migrações.
   Se um model ficar divergente das migrações Alembic, o seed reconstruirá o banco com o
   schema errado (ex.: `CategoryORM.name unique=True` em vez de `UNIQUE(name, entity_type, user_id)`
   da migração `a7b8c9d0e1f2`). Manter models e migrações sempre alinhados (o CI roda `alembic upgrade head` + `alembic check` num Postgres descartável).

Comando útil após criar migração:
```sh
cd app/backend && DATABASE_URL=postgresql+asyncpg://<usuário>:<senha>@localhost:5436/financas alembic upgrade head
```

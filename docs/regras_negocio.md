# Relatório de Regras de Negócio — financas_app

> **Gerado em:** 2026-08-24; **revisado em 2026-11-14** contra o código (papéis, alertas de limite, perfil, segurança)  
> **Baseado na análise do código:** models, repositories, routes, schemas, services  
> **Versão do projeto:** histórico de migrações e head atual em [`lineage_data.md`](lineage_data.md) (seção 8)

---

## 1. Visão Geral da Aplicação

O **financas_app** é um sistema de gestão financeira pessoal/empresarial com:
- **Backend:** FastAPI (Python 3.12) + SQLAlchemy Async + PostgreSQL
- **Frontend:** Vite + React 18 + TypeScript + shadcn/ui + D3.js
- **Infra:** Docker Compose (nginx:8087 → backend:8000 / frontend:8080)

### Entidades Principais
| Entidade | Tabela | Descrição |
|----------|--------|-----------|
| **Transação** | `transacoes` | Fato central: receitas, despesas, investimentos |
| **Categoria** | `categorias` | Dimensão agrupadora (única por `name + entity_type`) |
| **Subcategoria** | `subcategorias` | Dimensão filha; `target_amount ≠ null` ⇒ **Meta** |
| **Conta Recorrente** | `recurring_accounts` | Configuração de despesas fixas mensais (gera parcelas) |
| **Lista de Compras** | `shopping_items` | Isolada por mês; migração manual entre meses |
| **Usuário** | `users` | Perfil local ligado à identidade Supabase (`supabase_id`); papel `user`/`admin` (todo cadastro nasce `user`; admin só por promoção manual no banco); chave Pluggy. Não guarda senha (login é do Supabase) |
| **Alerta de limite** | `limit_alerts` | Aviso de 80/90/100% do limite de uma categoria ou do cartão, por mês (ver 2.9) |
| **Bancos do Usuário** | `user_banks` | Lista de bancos para atribuição aleatória (demo) |

---

## 2. Regras de Negócio por Domínio

### 2.1 Transações (`/transacoes`)

#### Criação
- **Obrigatórios:** `amount > 0`, `description`, `transaction_date`, `type` (income/expense/investment), `entity_type` (individual/business), `payment_method`
- **Categoria/Subcategoria:** Aceita `category_id` OU `category_name` (auto-cria se não existir); idem para subcategoria
- **Parcelamento:** Se `total_installments > 1` → gera N transações com mesmo `group_id` (UUID), datas +1 mês (preserva dia, clamp no último dia do mês), descrição `"desc - parcela i/N"`, última parcela ajustada para compensar arredondamento
- **group_id:** UUID único por grupo de parcelas (ou transação única)
- **is_installment:** Boolean indicando se é parcela
- **bank_code:** Opcional (3 dígitos COMPE)

#### Duplicatas
- **Detecção:** Mesma data (ignorando hora) + mesmo valor
- **Endpoints:** `POST /check-duplicates` (single/bulk) e `POST /resolve-duplicates`
- **Resolução:** `keep_both` | `keep_new` (deleta existente) | `keep_existing` (deleta nova)

#### Listagem/Filtros
- `GET /transacoes` (legado, `limit`/`offset`): filtro por `start_date` / `end_date` (DD/MM/YYYY), ordenação `transaction_date DESC`
- `GET /transacoes/paginated` (usado pelo frontend): página por cursor opaco (`next_cursor`), ordem estável `transaction_date DESC, id DESC`, `total` do filtro, `limit` máx. `TRANSACTIONS_MAX_PAGE_SIZE`; filtros combináveis (AND): período, PF/PJ (`entity_type`), `type`, `category_id` e `search`
- **Busca (`search`, máx. 100 caracteres, sem diferenciar maiúsculas/minúsculas, `%` e `_` são literais):** um registro entra se o texto aparece na descrição, na forma de pagamento, no nome da categoria ou da subcategoria, **no nome de um banco que o próprio usuário cadastrou** (`user_banks.bank_name`, ligado pelo `bank_code` da transação), **ou** se o texto é um valor em pt-BR igual ao `amount` da transação (comparação exata, ao centavo)
- **Valor digitado:** aceita `120`, `120,5`, `120,50`, `1.234,56`, `1.234` (= 1234) e prefixo `R$`; `120.50` (um ponto + 1–2 dígitos) vale como decimal. Texto que não é valor (`abc`, `1,234.56`, `120,555`, sinais) é ignorado para o valor e só vale como texto. A busca por valor e por banco nunca enxerga dados de outro usuário

#### Importação de Extrato (CSV/OFX)
- **Upload:** Stateless, máx 10 MB, retorna preview com totais income/expense
- **Parsers:** Auto-detecta delimitador CSV (; → tab → ,); fuzzy mapping colunas PT/EN; 6 formatos de data; valores BR (`1.234,56`); sinal negativo ⇒ expense
- **Confirmação:** `ExtractService.confirm` importa tudo num lote (uma transação por request, 1 commit pela unit of work); linhas inválidas voltam em `errors`; suporta parcelamento; limites reavaliados após o commit

#### Pluggy Sync (Open Finance)
- Requer `pluggy_api_key` no perfil
- Mapeamento: `DEBIT→expense`, `CREDIT→income`; `amount = abs()`
- `payment_method` = `paymentMethod` ou `category` (default "pix")
- `bank_code` = 3 primeiros dígitos conta tipo BANK
- Força `entity_type=PF`, categoria "Importado"/sub "Pluggy" (auto-criadas)
- Descrição truncada a 255 chars
- **Dedupe exato pelo id do provedor:** cada linha guarda `external_id` (id da transação no Pluggy) e `external_source="pluggy"`. Re-sincronizar pula as linhas cujo id o usuário já tem (e repetições do mesmo id no mesmo lote); a resposta traz `skipped`. Índice único parcial `(user_id, external_source, external_id)` garante isso no banco. Duas compras reais do mesmo valor no mesmo dia (ids diferentes) são importadas e **não** são sinalizadas
- **Adoção de linhas antigas (pré-id):** antes de inserir uma linha com id novo, procura uma linha do mesmo usuário sem id do provedor, mesmo dia, mesmo valor e mesma descrição (a que a importação antiga gravou); a de menor id recebe o `external_id`/`external_source` em vez de um insert (conta em `skipped` e em `linked`). Com várias candidatas, vincula uma por id recebido, em ordem de id; as que sobrarem são inseridas. Assim o primeiro re-sync após o deploy não duplica o histórico
- **Aviso de possível duplicata** (só reporta, não resolve): vale apenas para linhas importadas **sem** id do provedor; procura outra transação do mesmo usuário com a mesma data e valor (a linha do lote é identificada pelo id, não pela descrição)

---

### 2.2 Categorias e Subcategorias (`/categories`)

#### Unicidade
- **Constraint:** `UNIQUE(name, entity_type)` — mesmo nome permitido para PF e PJ
- **entity_type:** `individual` | `business`
- **type:** `income` | `expense` | `investment` | `NULL` (categorias especiais: "Mensal PF", "Mensal PJ", "Limite Cartao Credito", "Metas")

#### Subcategorias
- Cascade delete-orphan nas subcategorias ao deletar categoria; categoria com transações vinculadas não pode ser excluída (409 "Categoria possui transações vinculadas", nada é alterado)
- **Meta:** Subcategoria com `target_amount ≠ null` ⇒ aparece em `/goals`
- `completed` + `completed_at` (data de conclusão)

#### Atualização (PUT)
- Sincroniza subcategorias: atualiza as com `id`, cria as sem `id`; **nunca deleta** subcategorias existentes via PUT

#### Limites (`/limits`)
- **Bulk update:** 3 listas — `new` (cria cat+subs), `modified` (atualiza cat + cria/atualiza subs), `deleted` (exclui categorias)
- Usado para orçamento mensal por categoria

---

### 2.3 Contas Recorrentes (`/recurring-accounts`)

#### Criação
- **Campos:** `description`, `amount`, `due_day` (1-31), `category_id`/`name`, `subcategory_id`/`name`, `entity_type`, `payment_method`, `bank_code`, `start_date`, `end_date` (opcional), `active` (default true), `total_installments` (default 12, max 12)
- **Auto-gera 12 parcelas mensais** na criação (idempotente por `group_id + ano-mês`)

#### Geração de Parcelas (T3)
- Para cada mês: dia = `min(due_day, último_dia_do_mês)`
- Pula se `transaction_date > end_date`
- Tipo fixo: `expense`
- Vincula via `recurring_account_id` + `group_id` (UUID da conta)

#### Renovação (`POST /{id}/renew`)
- Reativa conta (`active=true`)
- Move `start_date` para mês atual (ou próximo se já tem parcela neste mês)
- Gera +12 novas parcelas

#### Desativação
- `PUT active=false` → **DELETE transações futuras** (data ≥ 1º dia do mês corrente)

#### Exclusão
- **DELETE** → apaga TODAS as transações vinculadas (manual cascade) + a conta

#### Geração Legada (`POST /generate`)
- Gera parcelas para contas ativas no range `start_date` a `end_date` (compatibilidade)

---

### 2.4 Metas (`/goals`)

#### Conceito
- **Meta = Subcategoria** com `target_amount > 0` na categoria **"Metas"** (auto-criada por `entity_type`)
- Não é entidade separada; reusa `subcategorias`

#### CRUD
- `POST /goals` → cria subcategoria na cat "Metas" com `target_amount`
- `PUT /goals/{id}` → atualiza nome e/ou `target_amount`
- `DELETE /goals/{id}` → deleta subcategoria

#### Status
- `PUT /goals/{id}/complete` → `completed=true`, `completed_at=hoje`
- `PUT /goals/{id}/reactivate` → `completed=false`, `completed_at=null`

#### Progresso (`GET /goals/progress`)
- **Cálculo:** `SUM(transacoes.amount)` onde `subcategory_id = meta.id` no mês/ano informado
- `% progresso = (atual / target_amount) × 100`
- Agrupado por `subcategory_id` em 1 query (GROUP BY)
- Filtros: `completed` (true/false/null), `entity_type`

---

### 2.5 Lista de Compras (`/shopping`)

#### Isolamento
- Tabela **sem FK** para outras tabelas
- Itens pertencentes a um `reference_month` (Date, 1º dia do mês)
- `entity_type`: `individual` | `business` (default individual)

#### Operações
- CRUD padrão: `checked` (boolean) ⇄ `completed_at` (date, setado ao marcar)
- **ROLLOVER automático**: `GET /shopping?month=M` inclui, além dos itens do mês M, itens **não-marcados**
  (não comprados) de meses anteriores — eles "arrastam" para o próximo mês até serem marcados como comprados

---

### 2.6 Dashboard (`/dashboard`)

#### Extrato Financeiro (`/statement`)
- Período + `entity_type` (individual/business/all; `all` = Ambos soma PF e PJ nos totais, gráficos, rendimento anual e categorias)
- Retorna: `total_income`, `total_expenses`, `monthly_goal`, `credit_card_limit`, `total_invested`, `fixed_expenses` (com `recurring_account_id`), `variable_expenses` (sem lista de transações: as linhas do período vêm de `GET /transacoes/paginated`)
- **Agregados para os gráficos (calculados no SQL, nunca somando as linhas):** `daily_totals` (entradas/saídas/investimentos por dia, só dias com dados, `YYYY-MM-DD`), `expenses_by_payment_method` (saídas por forma de pagamento), `expenses_by_bank` (saídas por forma de pagamento e banco; `bank_name` vem dos bancos do próprio usuário, senão o código) e `installments_due` (parcelas a pagar das saídas parceladas: `(total_installments - installment_number) x amount`, quantidade de parcelas e de transações, e o detalhe por banco; sem banco = "Sem banco")
- **`transactions` foi removida da resposta:** o frontend lê só os agregados acima e `total_invested`; a lista de lançamentos pagina em `GET /transacoes/paginated`. O statement roda em no máximo 4 queries (totais, limites, agregados dos gráficos, nomes dos bancos), qualquer que seja o volume
- **Meta mensal:** Categoria "Mensal PF" (PF) ou "Mensal PJ" (PJ) → coluna `limit`
- **Limite cartão:** Categoria "Limite Cartao Credito" (por entity_type) → fallback 0

#### Rendimento por Período (`/period-income`)
- Agregação mensal (Jan-Dez) de income/expense por ano
- Inclui `limit` mensal (mesma regra do extrato)

#### Gastos/Entradas por Categoria
- Agrupa por categoria + subcategoria
- Filtro por `type` (income/expense)
- Retorna `total`, `limit` da categoria, subcategorias com valores

#### Opções de Categorias (`/category-options`)
- Lista categorias + subcategorias para selects
- Filtros: `entity_type`, `type` (income/expense/investment + NULL para especiais)

---

### 2.7 Configurações (`/settings`)

#### Perfil
- `GET/PUT /settings/profile` atuam sobre o usuário autenticado (nunca sobre um `user_id` enviado pelo cliente)
- Só `name` e `pluggy_api_key` são editáveis; e-mail e senha ficam no Supabase. A API devolve `has_pluggy_key`, nunca a chave; `pluggy_api_key=""` remove a chave
- `pluggy_api_key` armazenada **cifrada** (Fernet, `PLUGGY_KEY_ENCRYPTION_KEYS`)
- A chave Pluggy não vai para logs (campos de credencial são redigidos)

#### Bancos do Usuário
- CRUD em `user_banks` (código FEBRABAN + nome)
- Usado no `BankSelect` (frontend) e atribuição aleatória

#### Atribuição Aleatória de Bancos (Demo)
- `POST /settings/assign-random-banks` → UPDATE `transacoes.bank_code` onde NULL com banco aleatório da lista do usuário

---

### 2.8 Exportação (`/export`)

#### CSV
- 11 colunas: Data, Descrição, Valor, Tipo, Natureza, Forma Pagamento, Categoria, Subcategoria, Banco, Parcela, Total Parcelas
- Filtro por período (default: 01/01/2000 até hoje)

#### OFX/QIF
- Gera OFX 1.0 SGML manualmente
- `TRNTYPE`: DEBIT (expense) / CREDIT (income/other)
- `MEMO`: "Categoria/Subcategoria: Descrição" (max 255)

---

### 2.9 Alertas de limite (`/notifications`)

#### Quando um alerta nasce
- **Limites:** `THRESHOLDS = 80, 90, 100` (% do limite). Cada limiar atingido no mês gera **um** alerta por (usuário, categoria, mês, limiar); reavaliar não duplica
- **Categoria:** só categorias com `limit > 0`; percentual = soma das despesas (`type=expense`) do mês nas subcategorias da categoria ÷ `limit` × 100. Ficam de fora as categorias especiais "Limite Cartao Credito" e "Metas" (comparação sem diferenciar maiúsculas)
- **Cartão (`scope=credit_card`):** limite = soma dos limites das categorias "Limite Cartao Credito" do usuário; usado = despesas do mês com `payment_method=credit`; mesmos limiares
- `exceeded=true` quando o percentual passa de 100 (o alerta de 100% sozinho, com percentual exatamente 100, não é "estourado")
- Gravados via `limit_alerts` (escopo `category` ou `credit_card`, mês `YYYY-MM`)

#### Quando é avaliado
- Após criar/editar/excluir transação, confirmar extrato, gerar recorrentes e sincronizar Pluggy (falha na avaliação não derruba a operação; vai para o log)
- Job periódico no backend (`ALERT_CHECK_INTERVAL`, padrão 1800 s) para todos os usuários; com várias réplicas só uma roda por vez (advisory lock do Postgres)

#### Como aparece
- `GET /notifications`: `unread_count` + itens com mensagem pronta e `severity`: 80 → `warning`, 90 → `critical`, 100 → `destructive`
- `PUT /notifications/{id}/read` e "marcar todas como lidas"
- E-mail (Resend) por alerta novo só se `EMAIL_ALERTS_ENABLED=true` e `RESEND_API_KEY` configurada; falha de envio é registrada e não interrompe

---

## 3. Regras Transversais

### 3.1 Resolve-ou-Cria (T2)
Aplicado em: criação/edição de transação, extrato, Pluggy, contas recorrentes
- Busca categoria por `name + entity_type`; se não existe → cria com `limit=0`, `type=tipo_da_transação`
- Busca subcategoria por `name + category_id`; se não existe → cria

### 3.2 Entity Type (PF/PJ)
- **individual** = Pessoa Física
- **business** = Pessoa Jurídica
- Todas as entidades principais têm `entity_type`
- Filtro `entity_type='all'` ignora o filtro

### 3.3 Datas
- Formato API: **DD/MM/YYYY** (entrada) / ISO 8601 (saída)
- Parsers aceitam 6 formatos + regex fallbacks
- `transaction_date` armazenado como `DateTime` (hora preservada)
- Duplicatas comparam apenas **data** (ignora hora)

### 3.4 Valores Monetários
- `amount` **sempre positivo** (sinal vai no `type`)
- Arredondamento: 2 casas decimais
- Última parcela ajustada para fechar valor total

### 3.5 Segurança
- Autenticação: JWT do Supabase (algoritmo/`aud`/`iss` verificados); o backend não guarda nem valida senha
- Autorização: papel lido do banco (`users.role`), nunca do token nem do cliente; ver 3.6
- `pluggy_api_key`: cifrada em repouso (`PLUGGY_KEY_ENCRYPTION_KEYS`, rotação por lista de chaves), decifrada só para chamar a Pluggy, nunca devolvida pela API nem registrada em logs
- Erros internos: o cliente recebe mensagem genérica; o detalhe só vai para o log do servidor
- Upload: limite 10 MB, decode UTF-8 com replace, parsing defensivo
- SQL: parameterizado via SQLAlchemy ORM (sem concatenação)
- Nginx: único ponto de entrada externo (porta 8087)

### 3.6 Papéis e permissões
- Papéis em `users.role`: **`user`** (padrão, todo novo cadastro) e **`admin`** (só por promoção manual no banco). O banco não restringe os valores (ver perguntas em aberto)
- **Qualquer usuário autenticado** (isolado por `user_id`): `/transacoes`, `/categories`, `/limits`, `/dashboard`, `/notifications`, `/settings` e o CRUD de `/recurring-accounts`
- **Somente `admin`** (403 para `user`): `/goals`, `/shopping`, `/extracts`, `/pluggy`, `/export` e `POST /recurring-accounts/generate`
- Decisão do dono (2026-11-14, `pendencias.md`): o **MVP é o produto do usuário comum** (transações, categorias, limites, dashboards, configurações); as rotas só de admin são implementações em andamento, fora do MVP

---

### 3.7 Perguntas em aberto para o dono do produto
Descrevem lacunas; o código atual não decide por elas.
1. Metas, compras, extrato, Pluggy e exportação continuam só para `admin` depois do MVP, ou viram do usuário comum? Se viram, quais?
2. O limiar de 100% deve contar como "estourado" (`exceeded`) ou só acima de 100%? Hoje só acima.
3. Alertas de limite: novos limiares ou canais (push, e-mail por padrão)? O e-mail hoje é opt-in por variável de ambiente, não por usuário.
4. O alerta de cartão considera só `payment_method=credit`; outros meios (débito virtual, parcelas futuras) entram?
5. As categorias "Mensal PF"/"Mensal PJ" (meta mensal) geram alerta de categoria como as demais quando têm limite; é o desejado? Hoje só "Metas" e "Limite Cartao Credito" ficam de fora.
6. Papel: existem outros além de `user`/`admin`? Convém restringir os valores no banco?
7. Excluir uma conta recorrente apaga todas as transações vinculadas (inclusive as passadas): é o desejado?
8. Produto: uso pessoal apenas ou também empresarial (PF/PJ)? (Nome decidido: **Placo**.)

---

### 3.8 Erros e transações (backend)
- **Erros de domínio:** services e repositórios levantam exceções de `app/core/errors.py` (`NotFoundError` 404, `ConflictError` 409, `ValidationError` 400, `UnprocessableError` 422, `ForbiddenError` 403, `PayloadTooLargeError` 413, `UpstreamError` 502, `ServerConfigError` 500); um único handler (`register_exception_handlers`) converte para `{"detail": "<mensagem pt-BR fixa>"}`. Qualquer outra exceção vira 500 com "Erro interno do servidor" (o texto real só vai para o log). Mensagens nunca carregam texto de exceção, SQL ou dados de outro usuário.
- **Uma transação por requisição:** a `UnitOfWork` faz um único commit quando a rota retorna e rollback se levantar. Itens de operações em lote (PUT `/limits` e o insert do lote de extrato) rodam em savepoint: o item com erro volta em `errors` e os demais seguem; o item que falha desfaz o próprio trabalho parcial (categoria criada + subcategoria que falhou saem juntas).
- **Avaliação de limites** (alertas 80/90/100 e e-mail) roda sempre DEPOIS do commit (criar/editar/excluir transação, confirmar extrato, gerar recorrentes, sync Pluggy) e tem transação própria; falha só vai para o log.

---

## 4. Fluxos de Dados Principais

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Fontes     │────►│ Transform.   │────►│ PostgreSQL  │
│ Externas    │     │ (Backend)    │     │ (Tabelas)   │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                 │
                    ┌──────────────┐             │
                    │  Consumos    │◄────────────┘
                    │ (Dashboard,  │
                    │  Metas,      │
                    │  Limites,    │
                    │  Export)     │
                    └──────────────┘
```

**Hub central:** `transacoes` — recebe de 4 fontes (manual, CSV/OFX, Pluggy, recorrentes) e alimenta todos os consumos.

---

## 5. Regras de Validação (Pydantic)

| Schema | Validações-Chave |
|--------|------------------|
| `TransacaoCreate` | `amount>0`, `category_id XOR category_name`, `subcategory_id XOR subcategory_name` |
| `CategoriaCreate` | `limit>=0`, `entity_type in [individual,business,all]`, `type in [income,expense,investment,null]` |
| `ContaRecorrenteCreate` | `amount>0`, `due_day 1-31`, `total_installments 1-12`, categoria/subcategoria obrigatórios |
| `MetaCreate` | `target_amount>0`, `subcategory_name` obrigatório |
| `ShoppingItemCreate` | `name`, `reference_month` (Date) |
| `ProfileUpdate` | `name` e `pluggy_api_key` opcionais (sem e-mail nem senha) |

---

## 6. Endpoints Principais (Resumo)

| Módulo | Endpoints |
|--------|-----------|
| **Transações** | `POST/GET/PUT/DELETE /transacoes`, `POST /check-duplicates`, `POST /resolve-duplicates` |
| **Extratos** | `POST /extracts/upload`, `POST /extracts/confirm` |
| **Categorias** | CRUD `/categories`, `PUT /limits` (bulk) |
| **Recorrentes** | CRUD `/recurring-accounts`, `POST /{id}/renew`, `POST /generate` |
| **Metas** | CRUD `/goals`, `PUT /{id}/complete|reactivate`, `GET /progress` |
| **Compras** | CRUD `/shopping` (GET com rollover p/ meses anteriores) |
| **Dashboard** | `GET /statement`, `/period-income`, `/expenses-by-category`, `/income-by-category`, `/category-options` |
| **Configurações** | `GET/PUT /profile`, CRUD `/banks`, `POST /assign-random-banks` |
| **Pluggy** | `GET /accounts`, `POST /sync`, `GET /validate-key` |
| **Export** | `GET /csv`, `GET /ofx` |

---

## 7. Migrações Relevantes (Histórico)

| Rev | Descrição |
|-----|-----------|
| `a1b2c3d4e5f6` | Cria tabelas iniciais (nomes PT) |
| `b2c3d4e5f6a7` | `conta_recorrente_id` em transacoes |
| `c3d4e5f6a7b8` | `tipo` em categorias |
| `c4d5e6f7a8b9` | `total_parcelas` em contas_recorrentes |
| `d5e6f7a8b9c0` | Tabelas `users` + `user_banks` |
| `e6f7a8b9c0d1` | `bank_code` em transacoes |
| `c5d6e7f8a9b0` | `external_id`/`external_source` em transacoes (+ índice único parcial por usuário) |
| `f7a8b9c0d1e2` | `valor_alvo` em subcategorias + `shopping_items` |
| `a1b2c3d4e5f7` | `pluggy_api_key` em users |
| `b1c2d3e4f5f6` | `concluida`/`data_conclusao` em subcategorias/shopping |
| `c1d2e3f4f5f6` | `bank_code` em contas_recorrentes |
| `d1e2f3a4b5c6` | `is_parcelado` em transacoes |
| `a0b1c2d3e4f5` | **Normalização PT→EN** (renomeia tabelas/colunas) |
| `e0f1a2b3c4d5` | `entity_type` em shopping_items |
| `dfc6bf881c13` | `UNIQUE(name, entity_type)` em categorias |
| `36a95d2e5251` | campos recorrentes em shopping_items |
| `1078188c8bbe` | índices compostos em transacoes |
| `2a3b4c5d6e7f` | índices recorrentes/subcat |
| `3b4c5d6e7f80` | `is_admin` em users |
| `a7b8c9d0e1f2` | Etapa 5 — `user_id` em categorias (unicidade tripla) |
| `b9c0d1e2f3a4` | Etapa 6 — `user_id` em transacoes |
| `c1d2e3f4a5b6` | Etapa 7 — `user_id` em recurring_accounts |
| `d2e3f4a5b6c7` | Etapa 8 — `user_id` em shopping_items |
| `e3f4a5b6c7d8` | Etapa 9 — `is_admin` → `role` em users |
| (demais) | Veja `lineage_data.md` (seção 8) para as migrações posteriores até o head atual |

---

## 8. Pontos de Atenção / Technical Debt

1. **Seed vs Migrations:** `scripts/seed.py` usa `drop_all/create_all` direto dos models — pode divergir das migrações (ex.: unique constraint de categorias)
2. **Export routes:** Usam `Session` direta (sem repository) — quebra padrão
3. **Código morto (frontend):** `getAllTransactions`, `resolveDuplicates`, `GET /recurring-accounts/{id}`, `POST /shopping/generate-recurring` não chamados
4. **Multi-user concluído (Etapa 4–9):** autenticação via Supabase JWT + isolamento por `user_id` + roles. Todo novo cadastro nasce `role='user'` (admin só por promoção manual). Rotas `pluggy/export/shopping/goals/extract` e `recurring-accounts/generate` são **admin-only**; `recurring-accounts` (CRUD) é liberado para `role='user'` por decisão de produto (403 p/ `role='user'` no resto)
5. **Pluggy sync:** Dedupe exato pelo id do provedor (aviso de duplicata só para linhas sem id); força `entity_type=PF` e categorias fixas
6. **N+1 evitado:** Repositories usam `selectinload` e `GROUP BY` para agregações
7. **Qualidade backend:** ruff (lint + format), pytest, `alembic check`, bandit e pip-audit rodam no CI

---

## 9. Convenções de Desenvolvimento (Obrigatórias)

- **TDD:** RED → GREEN → REFACTOR para toda feature/bugfix
- **Componentes:** Reutilizar `src/components/ui/` (shadcn); modais **sempre** `ResponsiveModal`
- **Tokens:** Apenas `primary`, `success`, `warning`, `destructive`, gradientes — **nunca hardcode cores**
- **Formatação:** Sempre `formatCurrency`, `formatDate`, `formatPercent` de `@/lib/format`
- **Lineage:** Qualquer mudança em models/migrations/repositories/routes ⇒ atualizar `docs/lineage_data.md`
- **Components:** Novo componente reutilizável ⇒ atualizar `docs/components.md`
- **Backend deps:** `uv sync` (nunca pip); `uv.lock` versionado
- **Alembic manual:** Sempre passar `DATABASE_URL` env var (alembic.ini usa SQLite)

---

*Fim do relatório*
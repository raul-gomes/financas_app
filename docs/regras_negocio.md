# Relatório de Regras de Negócio — financas_app

> **Gerado em:** 2026-08-24  
> **Baseado na análise do código:** models, repositories, routes, schemas, services  
> **Versão do projeto:** Head Alembic `e3f4a5b6c7d8` (23 migrações)

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
| **Usuário** | `users` | Perfil (todo cadastro nasce `user`; admin por promoção manual), senha bcrypt, chave Pluggy |
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
- Filtro por `start_date` / `end_date` (formato DD/MM/YYYY)
- Ordenação: `transaction_date DESC`

#### Importação de Extrato (CSV/OFX)
- **Upload:** Stateless, máx 10 MB, retorna preview com totais income/expense
- **Parsers:** Auto-detecta delimitador CSV (; → tab → ,); fuzzy mapping colunas PT/EN; 6 formatos de data; valores BR (`1.234,56`); sinal negativo ⇒ expense
- **Confirmação:** Loop `create_from_extract()` (1 commit/item), suporta parcelamento

#### Pluggy Sync (Open Finance)
- Requer `pluggy_api_key` no perfil
- Mapeamento: `DEBIT→expense`, `CREDIT→income`; `amount = abs()`
- `payment_method` = `paymentMethod` ou `category` (default "pix")
- `bank_code` = 3 primeiros dígitos conta tipo BANK
- Força `entity_type=PF`, categoria "Importado"/sub "Pluggy" (auto-criadas)
- Descrição truncada a 255 chars
- **Detecta duplicatas após importar** e apenas reporta (não resolve auto)

---

### 2.2 Categorias e Subcategorias (`/categories`)

#### Unicidade
- **Constraint:** `UNIQUE(name, entity_type)` — mesmo nome permitido para PF e PJ
- **entity_type:** `individual` | `business`
- **type:** `income` | `expense` | `investment` | `NULL` (categorias especiais: "Mensal PF", "Mensal PJ", "Limite Cartao Credito", "Metas")

#### Subcategorias
- Cascade delete-orphan ao deletar categoria
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
- Período + `entity_type` (individual/business/all)
- Retorna: `total_income`, `total_expenses`, `monthly_goal`, `credit_card_limit`, `total_invested`, `fixed_expenses` (com `recurring_account_id`), `variable_expenses`, lista de transações
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
- Single-user: `GET/PUT /settings/profile` → cria usuário padrão se não existir
- Senha: **bcrypt** via `passlib`
- `pluggy_api_key` armazenada **cifrada** (Fernet), nunca logada nem devolvida (`has_pluggy_key`); string vazia remove

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
- Senhas: bcrypt (nunca logadas)
- `pluggy_api_key`: cifrada em repouso (`PLUGGY_KEY_ENCRYPTION_KEYS`, rotação por lista de chaves), decifrada só para chamar a Pluggy, não exposta em logs nem na API
- Upload: limite 10 MB, decode UTF-8 com replace, parsing defensivo
- SQL: parameterizado via SQLAlchemy ORM (sem concatenação)
- Nginx: único ponto de entrada externo (porta 8087)

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
| `ProfileUpdate` | `email` formato, `password` hasheada no repo |

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
| `e3f4a5b6c7d8` | **HEAD** — Etapa 9 — `is_admin` → `role` em users |

---

## 8. Pontos de Atenção / Technical Debt

1. **Seed vs Migrations:** `scripts/seed.py` usa `drop_all/create_all` direto dos models — pode divergir das migrações (ex.: unique constraint de categorias)
2. **Export routes:** Usam `Session` direta (sem repository) — quebra padrão
3. **Código morto (frontend):** `getAllTransactions`, `resolveDuplicates`, `GET /recurring-accounts/{id}`, `POST /shopping/generate-recurring` não chamados
4. **Multi-user concluído (Etapa 4–9):** autenticação via Supabase JWT + isolamento por `user_id` + roles. Todo novo cadastro nasce `role='user'` (admin só por promoção manual). Rotas `pluggy/export/shopping/goals/extract` e `recurring-accounts/generate` são **admin-only**; `recurring-accounts` (CRUD) é liberado para `role='user'` por decisão de produto (403 p/ `role='user'` no resto)
5. **Pluggy sync:** Detecta duplicatas mas não resolve; força `entity_type=PF` e categorias fixas
6. **N+1 evitado:** Repositories usam `selectinload` e `GROUP BY` para agregações
7. **No linter/backend:** Apenas frontend tem eslint; backend sem formatação automatizada

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
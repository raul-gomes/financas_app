# Análise técnica para o portfólio — Placo

> Medido em 2026-11-15 na `develop` (`origin/develop` após o PR #23). Testes rodados localmente no mesmo dia; a cobertura foi medida de forma avulsa (`pytest-cov` e `@vitest/coverage-v8`), porque o projeto não tem cobertura configurada nem piso de cobertura no CI.
> Base da comparação "antes": [`analise-inicial.md`](analise-inicial.md) (2026-11-14, branch `mvp`).

## 1. Números

| Item | Valor | Como |
| --- | --- | --- |
| Commits | 204 (17/04/2026 → 15/11/2026); 69 deles em 14–15/11 (auditoria e correções) | `git rev-list --count`, `git log --since` |
| PRs mergeados | 29 | `gh pr list --state merged` |
| Backend | 10.115 linhas Python em 76 arquivos (sem migrations): 12 routers, 58 endpoints, 17 serviços, 13 repositórios | contagem em `app/backend/app` |
| Banco | PostgreSQL, 8 tabelas (`users`, `transacoes`, `categorias`, `subcategorias`, `user_banks`, `recurring_accounts`, `shopping_items`, `limit_alerts`), 29 migrations Alembic | `__tablename__`, `migrations/versions` |
| Frontend | 21.834 linhas TypeScript/TSX em 223 arquivos (sem testes), 13 páginas | contagem em `app/frontend/src` |
| Regras de negócio | `docs/regras_negocio.md` (401 linhas, com perguntas em aberto no item 3.7) | — |
| Testes backend | **563 passando + 7 de Postgres** (cobertura medida com 547) (pulados localmente, rodam no CI), 61 arquivos, 9.356 linhas, ~28 s | `pytest` |
| Testes frontend | **424 passando** (cobertura medida com 419), 71 arquivos, 6.982 linhas | `vitest run` |
| Bundle | entrada principal 124 kB (34,9 kB gzip); maior chunk 56,6 kB gzip (`react-vendor`), dentro do orçamento de 64 kB do CI | `npm run build`, `check:bundle` |
| Lint | ruff 0, ruff format 0, ESLint 0 erros e 0 avisos, `tsc` limpo | — |
| Dependências | `npm audit` 0 alertas; `pip-audit` no CI | — |

### Cobertura por camada (linhas)

| Camada | Cobertura |
| --- | --- |
| Backend total | **82%** (3.981/4.862) |
| ↳ models | 100% |
| ↳ schemas (Pydantic) | 96,8% |
| ↳ core (erros, unit of work, crypto, segurança, lock) | 95,7% |
| ↳ serviços | 88,2% |
| ↳ repositórios | 84,0% |
| ↳ rotas | 83,4% |
| Frontend total | **74,9%** das linhas (72,8% das instruções, 65,5% dos ramos) |
| ↳ `lib` (formatação, agregados, regras puras) | 99,6% |
| ↳ `schemas` (Zod) | 97,9% |
| ↳ `contexts` | 88,6% |
| ↳ `hooks` (react-query) | 82,7% |
| ↳ componentes | 60–74% |
| ↳ serviços (cliente HTTP) | 71,7% |
| ↳ páginas | 66,7% |

### Antes → depois da auditoria (14/11 → 15/11)

| Item | Antes | Depois |
| --- | --- | --- |
| Testes backend | 238 passando, **4 falhando** (dependiam da data atual) | 563 + 7 Postgres, todos verdes, relógio congelado |
| Testes frontend | 118 | 424 |
| ruff | 785 achados, 78 de 83 arquivos fora do formato | 0 |
| ESLint | 17 erros, 18 avisos | 0 e 0 |
| Chunk principal | 598 kB (177 kB gzip) | 124 kB (34,9 kB gzip) |
| CI | só frontend | frontend + backend (ruff, pytest, testes em Postgres real, `alembic check`, bandit, pip-audit), GitGuardian |
| Overview | 13 consultas | 7 (agregação em SQL) |

## 2. Arquitetura

```
Navegador (React 18 + Vite 8, responsivo: desktop e celular)
   │  JWT do Supabase Auth
   ▼
nginx ──► FastAPI (async)
            rota  ──►  serviço (regra + autorização)  ──►  repositório (SQL)
                         │  UnitOfWork: 1 commit por requisição
                         │  after_commit: alertas de limite
                         ▼
                      PostgreSQL (SQLAlchemy 2 async + asyncpg, Alembic)
            job a cada 30 min (advisory lock) ──► alertas 80/90/100% ──► e-mail (Resend) e sino
            Pluggy (Open Finance, em refação) · import CSV/OFX/QFX · export CSV/OFX
Docker Compose (db, backend, frontend, nginx) · certificados Let's Encrypt (certbot) no compose de produção
```

## 3. Decisões que valem destacar

- **Camadas com unit of work:** rota só faz HTTP; serviço recebe o usuário autenticado e decide autorização; repositório só faz SQL filtrado por `user_id` e nunca comita. Um commit por requisição; efeitos colaterais (avaliação de limites) só depois do commit.
- **Erros de domínio:** serviços levantam exceções próprias (`NotFoundError`, `ConflictError`…) e um único handler as traduz em HTTP com mensagens fixas em pt-BR; nenhum texto de exceção, SQL ou dado de outro usuário chega ao cliente.
- **API pronta para a tela (BFF):** totais, gráficos e categorias agregados no SQL; o extrato deixou de mandar a lista de transações e devolve só agregados (com teste de paridade contra a implementação de referência).
- **Paginação por cursor (keyset)** no extrato, com ordenação total e teto de página; no frontend, `useInfiniteQuery`.
- **Dedupe por id do provedor:** índice único parcial `(user_id, external_source, external_id)`; linhas antigas são adotadas em vez de duplicadas.
- **Segredo cifrado em repouso:** a chave da Pluggy é cifrada com Fernet/MultiFernet (rotação por lista) e o app recusa subir sem a chave de cifra.
- **Autenticação:** Supabase Auth; o backend valida o JWT pelo JWKS e o papel (`user`/`admin`) é imposto no servidor, nunca vindo do cliente.
- **Job de alertas com advisory lock** do Postgres: com mais de uma réplica, só uma roda a rodada.
- **Orçamento de bundle no CI:** nenhum chunk passa de 64 kB gzip.

## 4. Pontos fracos (honestos)

- **Integração Pluggy não funciona contra a API real** (modelo de credencial e chamadas erradas); análise e plano em [`analise-pluggy.md`](analise-pluggy.md).
- Sem piso de cobertura no CI; componentes e páginas do frontend em 60–74%.
- Testes de backend rodam em SQLite; só 7 rodam em Postgres real (no CI).
- Mobile testado só em Chromium emulado, não em aparelho real.
- `/investments` é um placeholder; metas, compras, recorrentes, extrato, Pluggy e export são só de admin e estão fora do MVP.
- Backup do banco com scripts prontos, mas sem agendamento nem teste de restauração; migration roda no start do container (premissa de réplica única).
- Sem deploy contínuo: o CI valida, o deploy é manual.
- Nome antigo ("financas") ainda no repositório, containers e e-mails.

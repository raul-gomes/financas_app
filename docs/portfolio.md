# Análise técnica para o portfólio — Placo

> Medido em 2026-11-17 no commit `94fdaf7` (`develop` + PR #34, correção do emissor do JWT). Testes rodados localmente no mesmo dia. A cobertura foi medida de forma avulsa (`pytest-cov` e `@vitest/coverage-v8`), porque o projeto não tem cobertura configurada nem piso de cobertura no CI.
> Medição anterior: 2026-11-15, PR #23. Base do "antes": [`analise-inicial.md`](analise-inicial.md) (2026-11-14, branch `mvp`).

## 1. Números

| Item | Valor | Como |
| --- | --- | --- |
| Commits | 232 (17/04/2026 → 17/11/2026) | `git rev-list --count` |
| PRs mergeados | 33 (mais o #34 aberto) | `gh pr list --state merged` |
| Backend | 10.017 linhas Python em 77 arquivos (sem migrations): 12 routers, 57 endpoints, 18 serviços, 13 repositórios | contagem em `app/backend/app` |
| Banco | PostgreSQL, 8 tabelas (`users`, `transacoes`, `categorias`, `subcategorias`, `user_banks`, `recurring_accounts`, `shopping_items`, `limit_alerts`), 29 migrations Alembic | `__tablename__`, `app/db/migrations/versions` |
| Frontend | 21.811 linhas TypeScript/TSX em 222 arquivos (sem testes), 13 páginas | contagem em `app/frontend/src` |
| Regras de negócio | `docs/regras_negocio.md` (413 linhas) | — |
| Testes backend | **583 passando + 7 de Postgres** (pulados localmente, rodam no CI), 64 arquivos, 9.994 linhas, ~35 s | `pytest` |
| Testes frontend | **426 passando**, 70 arquivos, 7.036 linhas | `vitest run` |
| Validação ponta a ponta | API × SQL sem divergência em 8 meses × Ambos/PF/PJ; 90 de 90 passos de escrita (PF e PJ); nenhum erro de console, no desktop e no celular | scripts avulsos contra banco semeado (18 meses, 1.110 lançamentos) |
| Bundle | entrada principal 123,9 kB (35,3 kB gzip); maior chunk 56,6 kB gzip (`react-vendor`), dentro do orçamento de 64 kB do CI | `npm run build`, `check:bundle` |
| Lint | ruff 0, ruff format 0, ESLint 0, `tsc` limpo | — |
| Dependências | `pip-audit` e `npm audit --omit=dev` bloqueantes no CI: **0 alertas em produção**. Com dev: 21 alertas altos, todos do `picomatch` (ReDoS, sem versão corrigida publicada), só em ferramentas de build | `npm audit` |

### Cobertura por camada (linhas)

| Camada | Cobertura |
| --- | --- |
| Backend total | **85%** (4.114/4.841) |
| ↳ models | 100% |
| ↳ schemas (Pydantic) | 96,9% |
| ↳ core (erros, unit of work, crypto, segurança, lock) | 96,1% |
| ↳ serviços | 88,0% |
| ↳ repositórios | 84,3% |
| ↳ rotas | 83,6% |
| Frontend total | **76,4%** das linhas (74,4% das instruções, 67% dos ramos) |
| ↳ `lib` (formatação, agregados, regras puras) | 99,6% |
| ↳ `schemas` (Zod) | 97,8% |
| ↳ `contexts` | 88,6% |
| ↳ `hooks` (react-query) | 85,9% |
| ↳ componentes | 73,9% |
| ↳ serviços (cliente HTTP) | 72,7% |
| ↳ páginas | 67,0% |

### Evolução

| Item | 14/11 (antes da auditoria) | 15/11 | 17/11 |
| --- | --- | --- | --- |
| Testes backend | 238, **4 falhando** (dependiam da data atual) | 563 + 7 Postgres | 583 + 7 Postgres |
| Testes frontend | 118 | 424 | 426 |
| Cobertura backend / frontend | — | 82% / 74,9% | 85% / 76,4% |
| ruff | 785 achados | 0 | 0 |
| ESLint | 17 erros, 18 avisos | 0 | 0 |
| Chunk principal | 598 kB (177 kB gzip) | 124 kB (34,9 kB gzip) | 123,9 kB (35,3 kB gzip) |
| CI | só frontend | frontend + backend + GitGuardian | igual |
| Overview | 13 consultas | 7 (agregação em SQL) | 7 |

### O que mudou entre 15/11 e 17/11 (validação ponta a ponta PF/PJ)

- **Saídas = despesas + investimentos** em todas as telas; saldo = entradas − saídas. `total_expenses` continua só despesas, porque é a base dos limites.
- **Categoria por natureza:** busca por nome usa primeiro a categoria da mesma natureza (PF/PJ) e depois a compartilhada; nome único por natureza.
- **Recorrentes:** filtro Ambos/PF/PJ; editar uma conta propaga os campos e o novo dia de vencimento para as parcelas do mês atual em diante; renovar só quando não há parcelas restantes (imposto no backend).
- **Metas:** meta com lançamentos vinculados não pode ser apagada (409 com mensagem).
- **Autenticação local:** o emissor esperado do JWT (`SUPABASE_JWT_ISSUER`) foi separado do endereço do JWKS; antes, o stack local rejeitava todo login.

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
- **API pronta para a tela (BFF):** totais, gráficos e categorias agregados no SQL, com teste de paridade contra a implementação de referência; a validação ponta a ponta conferiu cada número da API contra consultas SQL independentes.
- **PF e PJ no mesmo modelo:** cada lançamento, categoria e conta recorrente carrega a natureza; as telas filtram Ambos/PF/PJ e as categorias com o mesmo nome convivem nas duas naturezas.
- **Paginação por cursor (keyset)** no extrato, com ordenação total e teto de página; no frontend, `useInfiniteQuery`.
- **Dedupe por id do provedor:** índice único parcial `(user_id, external_source, external_id)`; linhas antigas são adotadas em vez de duplicadas.
- **Segredo cifrado em repouso:** a chave da Pluggy é cifrada com Fernet/MultiFernet (rotação por lista) e o app recusa subir sem a chave de cifra.
- **Autenticação:** Supabase Auth; o backend valida assinatura (JWKS para ES256/RS256, HS256 só com segredo configurado), expiração, audiência e emissor; o algoritmo nunca vem do token e o papel (`user`/`admin`) é imposto no servidor.
- **Job de alertas com advisory lock** do Postgres: com mais de uma réplica, só uma roda a rodada.
- **Orçamento de bundle no CI:** nenhum chunk passa de 64 kB gzip.

## 4. Pontos fracos (honestos)

- **Integração Pluggy não funciona contra a API real** (modelo de credencial e chamadas erradas); análise e plano em [`analise-pluggy.md`](analise-pluggy.md). Fica de lado por decisão do dono.
- **Tela de Investimentos é um placeholder** (a construir); os investimentos já entram nas saídas pela categoria.
- **`npm audit` com dev: 21 alertas altos** do `picomatch` (ReDoS), que não tem versão corrigida; só ferramentas de build com globs do próprio projeto, nada no bundle. Produção em 0 e bloqueante no CI.
- Sem piso de cobertura no CI; páginas e componentes do frontend em 67–74%.
- Testes de backend rodam em SQLite; só 7 rodam em Postgres real (no CI).
- Mobile testado em Chromium emulado, não em aparelho real.
- Recorrentes, extrato, Pluggy, compras, metas e export são só de admin; o uso inicial é pessoal.
- Mudar a data de início de uma recorrente não move as parcelas (só o dia de vencimento move).
- Backup do banco com scripts prontos, mas sem agendamento nem teste de restauração; migration roda no start do container (premissa de réplica única).
- Sem deploy contínuo: o CI valida, o deploy é manual.
- Nome antigo ("financas") ainda no repositório, containers e e-mails.

# Análise inicial — Finanças App (Placo)

> Revisão técnica de 2026-11-14, feita na branch `mvp` (commit `74ce95a`, 2026-09-15).
> Leitura do código, docs e infra; testes, lint e build rodados localmente.
> IDs (`B`, `S`, `Q`, `P`, `F-*`, `I-*`) são usados em [`pendencias.md`](pendencias.md).
> Nenhum arquivo sensível (`.env`, `senhas.txt`, `ssh_key`, `acessos.md`) foi aberto.

## 1. O que o produto faz

App web de **controle financeiro pessoal**. Cada usuário entra com conta Supabase
e vê só os próprios dados. Há dois papéis: `user` (padrão no cadastro) e `admin`
(promoção manual no banco), e o backend impõe o papel.

| Área | Usuário comum | Só admin |
| --- | --- | --- |
| Visão geral (`/`) | saldo, gráficos, alertas | |
| Financeiro (`/financial`) | transações (receita, despesa, investimento), parcelado, detecção de duplicata, dashboard D3 | |
| Limites (`/limits`) | limite por categoria com alertas 80/90/100% e projeção de risco antes de salvar | abas **Metas** (subcategoria com `target_amount`) e **Compras** (lista mensal com rollover) |
| Configurações (`/configuracoes`) | perfil, bancos | chave Pluggy |
| Recorrentes (`/recorrentes`) | | despesas fixas que geram parcelas, renovação |
| Extrato (`/extrato-bancario`) | | import CSV/OFX/QFX com validação e duplicatas |
| Investimentos (`/investments`) | | |
| Pluggy / Export | | sync Open Finance; export CSV |

Alertas de limite: job no `lifespan` do FastAPI a cada 30 min avalia todos os
usuários, grava `limit_alerts`, avisa por e-mail (Resend) e no sino do dashboard.

**Decidido (2026-11-14):** o MVP é o produto do usuário comum; as funções só de admin são implementações em andamento, fora do MVP.

**Dúvidas de produto (para o dono decidir):**
- "Placo" é o nome final? O repo, o `package.json` (`vite_react_shadcn_ts`) e a nota usam outros nomes.
- O papel `admin` é "o dono com tudo" ou um plano pago? Hoje metas, compras, recorrentes, extrato, Pluggy e export ficam fora do usuário comum.
- `regras_negocio.md` fala em uso "pessoal/empresarial": existe plano para empresas?
- O que falta para considerar o MVP pronto e sair da pausa?

## 2. Tecnologia

| Camada | Stack |
| --- | --- |
| Backend | Python ≥3.12, FastAPI ≥0.116, SQLAlchemy 2 async + asyncpg, Alembic (24 migrations), Pydantic v2, PyJWT (JWKS Supabase), Resend, cliente Pluggy, uv |
| Frontend | React 18.3, Vite 5.4, TypeScript 5.5, Tailwind 3 + shadcn-ui, D3 7, supabase-js 2, Vitest 2 |
| Dados | PostgreSQL 16 (Docker). Supabase só para autenticação (sem RLS; isolamento por `user_id` no backend) |
| Infra | Docker Compose (dev e prod), Nginx na 8087 como única porta pública, GitHub Actions |

Tamanho: backend com 12 routers e 57 endpoints; frontend com 11 páginas. 67 commits desde 2026-04-17.

## 3. Arquitetura

```
browser ──> nginx :8087 ──/api/──> FastAPI (rotas → repositórios → ORM) ──> Postgres
                         └──/────> Vite (dev) | nginx estático (prod)
FastAPI ──JWKS──> Supabase Auth     FastAPI ──> Pluggy, Resend
```

- **Backend:** rota → repositório. A camada de serviço quase não existe; a regra de negócio vive em repositórios grandes (`transaction.py` 627 linhas, `recurring_account.py` 481, `dashboard.py` 349). Sessão async por request; o repositório faz commit sozinho (sem unit of work).
- **BFF:** o dashboard e `GET /limits/with-spending` já entregam dados prontos para a tela, como pede o `AGENTS.md`.
- **Frontend:** `services/` com `apiFetch` (token do supabase-js a cada chamada), fetch manual em `useEffect` (86 ocorrências). O react-query está instalado e configurado, mas nenhum componente o usa. DTOs são interfaces escritas à mão, sem Zod.

## 4. Medições (2026-11-14)

| Verificação | Resultado |
| --- | --- |
| Backend `uv run pytest` | **238 passaram, 4 falharam** (dependem da data atual) |
| Backend `ruff check` (sem config) | 785 achados (532 auto-corrigíveis) |
| Backend `ruff format --check` | 78 de 83 arquivos fora do padrão |
| Frontend `npm run typecheck` | limpo |
| Frontend `eslint src` | 17 erros, 18 avisos |
| Frontend `vitest run` | 31 arquivos, **118 testes passaram** |
| Frontend `build` | chunk principal 598 kB (177 kB gzip), acima do aviso de 500 kB do Vite |
| CI | só frontend (typecheck, testes, build, orçamento de bundle); backend sem nada |

## 5. Pontos fortes

- Autenticação obrigatória em todos os routers e papel `admin` imposto no backend (`require_admin`), com testes de guarda.
- Isolamento por usuário com testes dedicados (transações, categorias, recorrentes, compras).
- Só ORM e parâmetros (sem SQL concatenado); Pydantic na borda do backend.
- 242 testes de backend em ~6 s (SQLite em memória) e 118 no frontend.
- Nenhum segredo no histórico do Git; `.env` nunca foi commitado.
- Rede bem separada: só o nginx é exposto; prod não usa o Vite dev server; Dockerfiles multi-stage.
- Rotas com `lazy`, `ErrorBoundary` por rota, lista de transações virtualizada.
- Regra do `ResponsiveModal` respeitada em todos os dialogs.

## 6. Achados

### Segurança

- **S1 (alta). Senha e chave Pluggy no log.** `app/routes/settings_routes.py:34` loga `payload.model_dump()` do `PUT /settings/profile`, que traz `password` e `pluggy_api_key`. O logger não redige nada.
- **S2 (alta). Chave Pluggy exposta e sem cifra.** Fica em texto puro no banco (`models/user.py`) e volta ao navegador em `ProfileResponse` (`schemas/settings.py:10`). Cifrar em repouso e devolver só `has_pluggy_key`.
- **S3 (média). JWT sem audience nem issuer.** `core/security.py:35,43` usa `verify_aud: False` e não valida `iss`; o ramo é escolhido pelo `alg` do header. Fixar o algoritmo esperado, `audience="authenticated"` e `issuer` do projeto. (Testado: segredo HS256 vazio é recusado pelo PyJWT, então não há bypass por config vazia.)
- **S4 (média). Identidade pelo e-mail, não pelo `sub`.** `repositories/users.py:11` ignora o `sub`; `PUT /settings/profile` deixa trocar o e-mail localmente (`repositories/settings.py:28`). Trocar o e-mail no Supabase cria um usuário vazio; trocar no app desvincula a conta. Guardar `supabase_id`.
- **S5 (média). `user_id` opcional nos repositórios.** `None` significa "sem filtro" em `transaction.py`, `recurring_account.py`, `shopping.py`, `dashboard.py` e `export.py`. As rotas passam o usuário hoje, mas um esquecimento vaza dados de todos. Tornar obrigatório.
- **S6 (média). Upload de extrato.** O limite de 10 MB é checado depois de ler tudo para a memória (`extract_routes.py:34`); OFX com `xml.etree` (`extract_parsers.py:54`), vulnerável a "billion laughs". Usar `defusedxml` e leitura com limite.
- **S7 (média). Borda HTTP.** CORS fixo em localhost (`main.py:50`) com `allow_credentials`; sem rate limit; sem headers de segurança (CSP, HSTS, X-Frame-Options) nos dois nginx; containers como root.
- **S8 (baixa). Senha local sobrando.** `password_hash` com passlib (pouco mantido) apesar do login ser Supabase.
- **S9 (baixa). Erros vazam detalhe.** `limits.py:55` devolve `str(e)` ao cliente; 13 `console.error` no frontend logam o objeto inteiro.

### Bugs

- **B1 (média). 4 testes falham por depender da data atual** (`test_limit_alert_job.py`, `test_notifications_routes.py`). Congelar o relógio.
- **B2 (média). Upload acima de 1 MB deve falhar com 413 no nginx**, que não define `client_max_body_size` (padrão 1 MB), enquanto o backend aceita 10 MB. A confirmar com um arquivo real.
- **B3 (média). Prod provavelmente quebrado.** `infra/nginx.conf` faz proxy para `frontend:8080`, mas a imagem de prod do frontend escuta na 80; o compose de prod publica a 443 sem bloco TLS no nginx. O `docker-compose-prod.yml` não é versionado.
- **B4 (baixa).** `database.py:9` quebra com `AttributeError` sem `DATABASE_URL`; `sync_engine` não usado. Texto `"Sin cronizar"` e `datetime.now()` sem fuso em `pluggy_routes.py`.

### Qualidade

- **Q1 (alta). CI não cobre o backend**: sem ruff, testes ou `alembic check`; sem SAST nem audit de dependências; actions sem pin por SHA; push só em `main`.
- **Q2 (média). Backend sem lint/format configurado**: 785 achados e 78 arquivos fora do padrão.
- **Q3 (média). Pouca camada de serviço**: regra de negócio nos repositórios e em rotas (`pluggy_routes.py:59-180`); commits dentro do repositório deixam lote pela metade em caso de erro.
- **Q4 (média). `except Exception` silenciosos** (~25), alguns com `continue` no parse de extrato.
- **Q5 (média). Frontend sem validação na borda**: sem Zod; `any` em `types/financial.ts:68`, gráficos D3 e `ContaForm.tsx:61`.
- **Q6 (média). Componentes gigantes**: `BankExtract.tsx` 1103 linhas, `ExtratoDialog.tsx` 905, `AddTransactionDialog.tsx` 719, `EditTransactionDialog.tsx` 564, `Settings.tsx` 512. Pares Add/Edit duplicados.
- **Q7 (média). Cores fixas** fora dos tokens (`BankExtract.tsx` 36, `ExtratoDialog.tsx` 23, `TransactionList.tsx` 10…), contra a regra do `AGENTS.md`.
- **Q8 (média). react-query sem uso**: migrar os fetches ou remover a lib.
- **Q9 (baixa).** 17 erros de ESLint; dois lockfiles (`bun.lockb` e `package-lock.json`); `index.html` com `lang="en"`; poucos `aria-label`; `.dict()` deprecated; imports mortos; dependências com `>=` sem teto e `psycopg2-binary`/`aiosqlite` em produção.
- **Q10 (baixa).** Identificadores misturam pt e en (`TransacaoRepository`); commits em pt-BR (a prática pede inglês).

### Performance

- **P1 (média).** Export busca o período de **todos** os usuários e filtra em memória (`repositories/export.py:48`).
- **P2 (média).** Overview com várias queries em sequência e agregação em Python (`overview.py:127-300`).
- **P3 (média).** Transações sem paginação no backend; sem cache no frontend.
- **P4 (baixa).** Chunk principal de 598 kB: páginas de auth carregadas de cara e D3 importado inteiro.
- **P5 (baixa).** Job de alertas sem lock entre réplicas; `selectin` de bancos em toda request autenticada.

### Infra e operação

- **I1 (alta). Sem backup do Postgres**: só o volume Docker.
- **I2 (média).** Postgres publicado no host (`docker-compose.yml:8`, porta 5436) com usuário e senha padrão no compose de dev.
- **I3 (média).** Logs sem volume (somem ao recriar o container); sem métricas ou alertas. (Correção de 2026-11-14: o loguru já tem `rotation`/`retention`.)
- **I4 (baixa).** `alembic upgrade head` no start do container, sem lock; `setup-docker.sh` sem `set -e`.

### Documentação e higiene

- **D1 (alta). `docs/` inteiro está no `.gitignore`** (`.gitignore:70`): a documentação viva exigida pelo `AGENTS.md` não é versionada. Ao mesmo tempo, `docs/senhas.txt`, `docs/acessos.md` e `docs/ssh_key` vivem ali. Mover segredos para o EnvVault ou `.private/` e versionar `docs/`.
- **D2 (média).** `regras_negocio.md` parou em 2026-08-24 (antes dos limites 80/90/100); `ideias.md` lista itens já feitos; o `AGENTS.md` cita 11 routers, 14 migrations e 12 testes (hoje 12, 24 e 29).
- **D3 (baixa).** Branches `docs/agents-cerebro` e `origin/full-code` paradas; `mvp` 10 commits à frente de `main`; não existe `develop`.

## 7. Melhorias sugeridas (ordem)

1. **Segurança imediata:** S1 (tirar o log), S2 (não devolver a chave; cifrar), S3 e S4 (JWT e identidade por `sub`).
2. **Base de qualidade:** D1 (versionar docs), B1 (testes verdes), Q1 + Q2 (ruff e pytest no CI).
3. **Robustez de dados:** S5, S6, P1.
4. **Deploy:** B2, B3, S7, I1, I2 e versionar o compose de prod sem valores de segredo.
5. **Frontend:** Q5 (Zod), Q8 (react-query ou remover), Q6 e Q7 aos poucos, ao tocar nos arquivos.
6. **Produto:** responder as dúvidas da seção 1 e definir o fim do MVP.

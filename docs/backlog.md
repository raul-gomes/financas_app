# Backlog — financas_app

Ideias e recursos futuros que **não** entram no escopo atual, mas influenciam
decisões de arquitetura hoje. Cada item deve ser suficientemente detalhado para
ser puxado para execução sem re-discussão.

> **Regra:** ao implementar (ou descartar) um item, atualize este arquivo.

---

## MULTI-01 — Multi-moeda (usuário americano cadastra em USD)

**Status:** ideia aprovada conceitualmente · **Prioridade:** futura · **Dependência:** plano de i18n (`specs/2026-08-21-i18n-plan.md`)

### Contexto

O app é brasileiro (BRL, Pluggy, valores PT-BR). A visão de produto é que uma
pessoa fora do Brasil use o app nativamente: um americano **cadastra suas
transações em USD** — não é conversão de dados existentes, é a moeda natal do
perfil dele em toda a experiência (transações, limites, metas, dashboards).

Importante distinguir dos dois recursos vizinhos:

| Recurso | Camada | O que resolve |
|---|---|---|
| i18n | display (frontend) | idioma + formato de número/data |
| **Multi-moeda (este item)** | **dados (backend)** | **em qual moeda os valores nascem** |
| Conversão/FX | dados + display | somar moedas mistas no dashboard |

### Fase 1 — Moeda global por usuário (MVP)

1. Migração Alembic: coluna `users.currency` (`String`, default `'BRL'`).
2. `GET/PUT /settings/profile` expõe `currency` (validar contra lista fixa:
   `BRL`, `USD`, `EUR`...).
3. Frontend guarda no perfil (SettingsService) e expõe via context/hook.
4. `lib/format.ts`: `formatCurrency(valor)` usa a moeda do perfil como default
   (a assinatura já aceita `currency` — preparado).
5. `CurrencyInput` (componente do roadmap do design system) com símbolo dinâmico.
6. Limites/metas criados passam a ser "na moeda do usuário" (sem conversão — só
   muda o rótulo).

### Fase 2 — Importação de extrato internacional

- Parsers CSV/OFX (`extract_parsers.py`) já têm matching fuzzy, mas assumem
  número BR (`1.234,56`) e datas DD/MM. Adicionar detecção/aceitação do padrão US
  (`1,234.56`, MM/DD/YYYY) com testes TDD.
- Extrato passa a sugerir a moeda do banco selecionado.

### Fase 3 — Contas em moedas mistas + FX (só se houver demanda)

- Coluna `currency` em `user_banks` e `transacoes` (herda do banco).
- Dashboard soma convertendo: taxa manual fixa configurável ou API de câmbio
  (ex.: AwesomeAPI/economia.awesomeapi) com cache diário.
- Histórico: decidir se converte pela data da transação ou taxa atual.

### Limitações conhecidas

- **Pluggy = Open Finance Brasil apenas.** Usuário americano não conecta bancos;
  porta de entrada é import manual CSV/OFX. Integração Plaid/MX é outro item de
  backlog se esse público se concretizar.
- Categorias/limites seeded continuam em PT (i18n de conteúdo dinâmico também
  está fora do escopo do plano de i18n).

### Preparação já feita no código

- `lib/format.ts` — `DEFAULT_CURRENCY` exportado e `formatCurrency(value,
  currency?)` parametrizável (nenhum call site precisará mudar).

### Critérios de aceite (Fase 1)

- [ ] Usuário USD vê `$` em todas as telas; usuário BRL não nota diferença
- [ ] Perfil persiste a moeda; recarregar mantém
- [ ] Novos limites/metas/transações interpretados na moeda do perfil
- [ ] Migração reversível; usuários existentes permanecem BRL

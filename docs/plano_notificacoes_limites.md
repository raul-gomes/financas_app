# Plano de Implementação — Notificações de Limites por Categoria (70/80/90/100%)

> **Criado em:** 2026-09-09
> **Objetivo:** alertar o usuário quando qualquer categoria de limite atingir 70%, 80%, 90% e 100% do limite — notificação **na tela** (com cores por severidade) e **e-mail** avisando que o limite está perto de estourar ou foi estourado.
> **Convenção:** cada etapa segue TDD (RED → GREEN → REFACTOR), princípios BFF (cálculos no backend, payload pronto para tela) e atualiza `docs/lineage_data.md` / `docs/components.md` / `docs/arvore_arquivos.md` quando aplicável.

---

## Análise da estrutura atual

### O que já existe (usado ou reutilizado)

| Item | Onde | Nota |
|------|------|------|
| Limite + gasto + `percent_used` por categoria | `app/db/repositories/limits.py:290-302` (`get_limits_with_spending`) | Já calcula `spent`, `remaining`, `percent_used` — **fonte de verdade dos thresholds** |
| Endpoint `GET /limits/with-spending` | `routes/limits_routes.py:90` | Recebe `year`, `month`, `user_id` — prontos para o alert service |
| Transações (create/update/delete) | `routes/transactions_routes.py` | Pontos naturais de disparo pós-mutação |
| Import de extrato | `routes/extract_routes.py:73` (`/confirm`) e `pluggy_routes.py:120` | Criam transações em lote |
| Parcelas recorrentes | `routes/recurring_accounts_routes.py:196` (`/generate`) | Geram transações do mês |
| Usuário + e-mail | `app/db/models/user.py:11` | `users.email` — destinatário do e-mail |
| Toasts/sonner | `src/App.tsx:3-4`, `hooks/use-toast.ts` | Base para a notificação em tela (ou componente dedicado no AppLayout) |
| Design tokens | `docs/components.md` | `warning`, `destructive`, `primary`, gradientes — cores da notificação |

### O que NÃO existe (gap)

- Tabela/registro de notificações (nenhum estado de "alerta já disparado" — sem idempotência).
- Serviço de e-mail (nenhum SMTP/provider configurado no backend).
- Endpoint de leitura de notificações para o frontend.
- UI de notificações (badge/panel/composição de toasts por severidade).
- Job de reavaliação de limites (startup/periódico) para recuperar cruzamentos.

---

## Decisões de design

1. **Thresholds:** `[70, 80, 90, 100]`. Ao cruzar um threshold (ex: passa de 68% para 72%, ou 95% para 110%), **dispara 1 notificação por threshold cruzado**, no máximo uma vez por (user, category, month, threshold). Acima de 100% vira o evento "estourado" (threshold=100, `exceeded=true`).
   - Kimi rationale: a obrigatoriedade lista os 4 patamares; disparar cada um é o comportamento literal e dá granularidade. Se quiser só o "maior cruzado", troca-se `THRESHOLDS` por enum constante — fica isolado no service.
2. **Idempotência:** tabela `limit_alerts` com unique `(user_id, category_id, month, threshold)`. Reavaliar N vezes não repete alerta/e-mail.
3. **E-mail:** serviço plugável por env vars. **Default proposto: SMTP via `aiosmtplib`** (deps leves, funciona com Gmail/SendGrid SMTP/etc.) com toggle `EMAIL_ALERTS_ENABLED` (default `false` na dev). Alternativa: API Resend (1 dep HTTP). A escolha final fica bloqueada na Etapa 3 (pedir confirmação do usuário).
4. **Disparo:** evento pós-mutação (create/update/delete de transação, confirm de extrato, sync pluggy, generate de recorrentes) **+ job de recuperação** (lifespan task periódica) para cobrir rollover de mês e imports fora do fluxo normal.
5. **BFF:** `GET /notifications` devolve payload pronto: `severity` (`warning`/`critical`/`destructive`), `threshold`, `percent_used`, `category_name`, `month`, `message` já montado. Frontend **só renderiza** (não calcula % nem mapa severidade).
6. **Delete/update para baixo:** não revoga notificação já gerada (evita fluxo complexo de "desfazer"). Se o usuário reduzir gasto, a notificação permanece como histórico; nova avaliação só gera alertas de threshold **ainda não alcançado**.
7. **E-mail mensal de resumo?** Fora de escopo nesta versão (só alertas de threshold). Registrado como possível evolução.

---

## Etapas (TDD)

### Etapa 0 — Infra de e-mail (decisão)
- [ ] Confirmar provider: **SMTP (aiosmtplib)** vs **Resend API**.
- [ ] Adicionar deps (`uv add aiosmtplib` ou `resend`) e env vars no `.env` / `.env.example`: `EMAIL_ALERTS_ENABLED`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.
- [ ] Config no `app/core/config.py`.

### Etapa 1 — Banco: modelo + migração `limit_alerts`
**Objetivo:** persistir estado de alertas por usuário/threshold.
- [ ] 1.1 Criar `app/db/models/limit_alert.py` — `LimitAlertORM`:
  - `id`, `user_id` (FK users), `category_id` (FK categorias), `month` (str `YYYY-MM`), `threshold` (int), `exceeded` (bool), `read_at` (nullable), `email_sent` (bool), `created_at`
  - `UniqueConstraint(user_id, category_id, month, threshold)` — idempotência
  - relation p/ `CategoryORM` (lazy selectin, cascata delete de categoria apaga alertas)
- [ ] 1.2 Registro em `app/db/models/__init__.py`.
- [ ] 1.3 1.3 Migration Alembic (`alembic revision --autogenerate` / manual): cria tabela + índices + FK. Rodar `DATABASE_URL=... alembic upgrade head`.
- [ ] 1.4 **TESTE (RED→GREEN):** `tests/test_limit_alert_repository.py` — CRUD/repo básico: criar alerta, unique viola no mesmo (user, cat, month, threshold), `get_by_month`, `mark_read`, `list_unread_by_user`.
- [ ] 1.5 Atualizar `docs/lineage_data.md` (nova tabela + dependências) e `docs/arvore_arquivos.md`.

### Etapa 2 — Service de avaliação de limites (idempotente)
**Objetivo:** dado user/year/month, detectar cruzamentos novos e gravar alertas.
- [ ] 2.1 Criar `app/services/limit_alert_service.py`:
  - `async evaluate_limits(user_id, year, month) -> list[LimitAlertORM]`
  - Reutiliza `LimitsRepository.get_limits_with_spending()` (1 query agregada) → classe a `percent_used`.
  - Para cada categoria com `limit > 0`: para cada `threshold in [70,80,90,100]`, se `percent_used >= threshold` e **não** existir alerta → **criar** (status: `exceeded = percent > 100`).
  - `THRESHOLDS = [70, 80, 90, 100]` (constante do service).
- [ ] 2.2 **TESTE (RED→GREEN):** `tests/test_limit_alert_service.py`:
  - 68% → nenhum alerta; 72% → alerta 70; 85% → alertas 70+80; 95% → 70+80+90; 105% → 70+80+90+100 com `exceeded=true`.
  - Reavaliar o mesmo mês **não duplica** (idempotência).
  - Categoria sem limite (`limit=0`) não gera alerta.
  - Roda sobre SQLite in-memory (conftest) com categorias/transações fake.

### Etapa 3 — Serviço de e-mail (mockado nos testes)
**Objetivo:** enviar e-mail de alerta sem travar o fluxo se o SMTP falhar.
- [ ] 3.1 Criar `app/services/email_service.py`:
  - `async send_limit_alert_email(user_email, alert_data)` → template HTML + texto ("Categoria X atingiu 80% do limite (R$Y de R$Z)" / "estourou o limite").
  - Loga erro e **não levanta** (best effort); marca `email_sent=True` só se enviado.
  - Se `EMAIL_ALERTS_ENABLED=false`, apenas loga.
- [ ] 3.2 `LimitAlertService.evaluate_limits()` chama `email_service` p/ alertas novos.
- [ ] 3.3 **TESTE:** `tests/test_email_service.py` — provider mockado: sucesso marca `email_sent`; falha não quebra avaliação e deixa `email_sent=false`.

### Etapa 4 — Endpoints de notificação (BFF)
**Objetivo:** contrato pronto para a tela.
- [ ] 4.1 Criar `routes/notifications_routes.py` (router `/notifications`):
  - `GET /notifications` → meta `{unread_count}` + itens `[{id, threshold, exceeded, percent_used, category_name, month, severity, message, created_at, read_at}]`; `severity`: `<90=warning`, `>=90 && <=100=critical`, `>100=destructive`; `message` montado no schema (`# Frontend usa: severity p/ cor do token de design`).
  - `POST /notifications/{id}/read` → seta `read_at`.
  - `POST /notifications/read-all` (opcional) para "marcar tudo como lido".
- [ ] 4.2 Schema `app/schemas/notifications.py` (`NotificationItem`, `NotificationListResponse`, `@model_validator` computando `severity`/`message`).
- [ ] 4.3 Registrar router no `app/main.py`.
- [ ] 4.4 **TESTE (RED→GREEN):** `tests/test_notifications_routes.py` — sem token 401; lista só do user logado; mark read 404 p/ alerta de outro user; `message`/`severity` presentes.
- [ ] 4.5 Atualizar `docs/lineage_data.md` (rotas novas → tabela) e `docs/arvore_arquivos.md`.

### Etapa 5 — Disparos pós-mutação
**Objetivo:** avaliar limites sempre que transações mudam.
- [ ] 5.1 Em `routes/transactions_routes.py` (`create`, `update`, `delete`): após sucesso, `await alert_service.evaluate(user.id, ano, mes da transação)` (fire-and-forget com session nova — não falha a request).
- [ ] 5.2 Em `routes/extract_routes.py` (`/confirm`) e `routes/pluggy_routes.py` (sync): avaliar após `create_batch_from_extract`.
- [ ] 5.3 Em `routes/recurring_accounts_routes.py` (`/generate`): avaliar depois de gerar parcelas.
- [ ] 5.4 **TESTE (RED→GREEN):** `tests/test_limit_alert_trigger.py` — criar transação que cruza threshold → alerta criado; sem cruzamento → nada; segunda transação não duplica.
- [ ] 5.5 Atualizar `docs/lineage_data.md` (regra: mutações de transação → tabela `limit_alerts`).

### Etapa 6 — Job de recuperação (lifespan)
**Objetivo:** cobrir rollover de mês e dados injetados fora do fluxo (mesmo se o app reiniciar).
- [ ] 6.1 Criar task `scheduled_evaluation(app)` em `app/core/lifespan.py` (ou dentro do `main.py`): loop `asyncio` a cada `ALERT_CHECK_INTERVAL` (default 30 min), avaliando **mês atual** para todos os usuários.
- [ ] 6.2 **TESTE:** teste de unidade do loop helper `evaluate_all_users_current_month()` — hook do job, não o timer.

### Etapa 7 — Frontend: notificações em tela
**Objetivo:** alerta visual por severidade usando design tokens.
- [ ] 7.1 Tipos em `src/types/notifications.ts` (`NotificationItem`, `NotificationListResponse`).
- [ ] 7.2 `src/services/notificationService.ts` (`getNotifications`, `markRead`, `markAllRead`) via `apiFetch`.
- [ ] 7.3 Hook `src/hooks/useLimitAlerts.ts` — poll `GET /notifications` (ex.: 60s) quando autenticado; expõe `unread`, `markRead`.
- [ ] 7.4 Componente `src/components/notifications/NotificationBell.tsx` (ou painel no `AppLayout.tsx`): badge com `unread_count` + dropdown listando alertas; cores por `severity` via tokens (`warning`→amber, `critical`→orange/red, `destructive`→destructive); clique marca lido e navega para `/limits`.
  - Reutilizar primitivos de `ui/` (dropdown, badge, button) — nunca duplicar.
- [ ] 7.5 (Alternativa/adicional) toast de alerta severo no topo ao detectar `destructive` novo.
- [ ] 7.6 **TESTE (RED→GREEN):** `src/components/notifications/NotificationBell.test.tsx` + `src/hooks/useLimitAlerts.test.ts` — mock `notificationService`; renderiza badge, lista, marca lido.
- [ ] 7.7 **TESTE (RED→GREEN):** `useLimitAlerts` — não chama API sem sessão; retorna unread_count.
- [ ] 7.8 Rodar `npm run test` + `npm run typecheck` (`tsc -b --noEmit`).
- [ ] 7.9 Atualizar `docs/components.md` (novo componente composto) e `docs/arvore_arquivos.md`.

### Etapa 8 — Validação final + docs
- [ ] 8.1 `uv run pytest` completo no backend.
- [ ] 8.2 `npm run test` + `npm run typecheck` no frontend.
- [ ] 8.3 Teste manual: subir `docker compose up -d --build`, cadastrar limite, lançar transações até 70/80/90/100%, ver badge/bell coloridos e e-mail (SMTP configurado).
- [ ] 8.4 Atualizar `.env.example`, `AGENTS.md` (novos comandos/env vars se houver) e resumo de regras de negócio em `docs/regras_negocio.md` se conveniente.

---

## Anexo — Como o `severity`/cor é decidida (centralizado no backend)

| `percent_used` | threshold | `severity` | Uso no frontend (token) |
|----------------|-----------|------------|--------------------------|
| >= 70 e < 80 | 70 | `warning` | componente `warning` (amber) |
| >= 80 e < 90 | 80 | `warning` | idem (pode variar intensidade) |
| >= 90 e <= 100 | 90 | `critical` | `destructive`-opacity/alert |
| > 100 | 100 | `destructive` | `destructive` (vermelho) — "limite estourado" |

## Riscos / Notas

- **E-mail em dev:** manter `EMAIL_ALERTS_ENABLED=false` por padrão; usar Mailhog/Gmail App Password na dev quando validar.
- **Volume de e-mails:** 1 e-mail por threshold por categoria/mês (máx. 4/categoria/mês) — aceitável; cooldown natural pela unique constraint.
- **Performance:** avaliação usa 1 query agregada (`with-spending`) — sem N+1; job roda no backend interno, não exposto.
- **Fire-and-forget:** disparos pós-mutação rodam em task separada (não bloqueiam resposta da API); sessão de DB própria.
- **Frontend nunca calcula:** `percent_used`, `severity`, `message` vêm prontos do backend (BFF).
# Design System — financas_app

> **Última atualização:** 2026-09-15
>
> Catálogo vivo de componentes e fundamentos visuais do frontend (`app/frontend/`).
> **Regra:** antes de implementar qualquer UI, consulte este arquivo e reutilize o que existe.
> Criou ou alterou um componente reutilizável? Atualize este arquivo na mesma mudança.

---

## 1. Objetivo

Evoluir gradualmente para um **design system completo**: tokens consistentes,
componentes base reutilizados (nunca recriados) e componentes compostos extraídos
de padrões repetidos nas telas. Consistência visual > solução avulsa.

---

## 2. Fundamentos (Design Tokens)

Definidos em `src/index.css` (variáveis CSS HSL) + `tailwind.config.ts`.
Todos os tokens têm variante **light** e **dark** — nunca hardcode cores.

### 2.1 Cores semânticas

| Token | Uso |
|---|---|
| `primary` / `primary-foreground` / `primary-glow` | Ação principal, destaques, ícones de seção |
| `success` | Receitas/income, estados positivos |
| `warning` | Investimentos, alertas (ex.: tag "Acabando") |
| `destructive` | Despesas/expense, ações destrutivas |
| `critical` / `critical-foreground` | Severidade intermediária (90% do limite), entre `warning` e `destructive` |
| `chart-1` … `chart-12` | Paleta categórica sem significado semântico (avatares de banco, séries) — `bg-chart-N`, `hsl(var(--chart-N))` |
| `muted` / `muted-foreground` | Texto secundário, fundos suaves |
| `card` / `border` / `background` | Superfícies |

Convenção por tipo de transação: **income → `text-success`**, **expense → `text-destructive`**,
**investment → `text-warning`**.

**Mapeamento ao trocar cor fixa por token** (nunca `text-red-500`, `bg-green-50`, `#hex`):

| Intenção | Token | Exemplo |
|---|---|---|
| Positivo / income / sucesso | `success` | `text-success`, `bg-success/10 border-success/30` |
| Negativo / erro / expense | `destructive` | `text-destructive`, `bg-destructive/15` |
| Alerta / pendente | `warning` | `text-warning`, `bg-warning/10` |
| Link / info / recorrente | `primary` | `text-primary`, `bg-primary/10` |
| Cinza neutro | `muted`, `muted-foreground`, `input` | `bg-muted`, `border-input` |
| Texto sobre cor sólida | `<token>-foreground` | `bg-success text-success-foreground` |

Variantes claras = opacidade do token (`/5`, `/10`, `/15`, `/30`); não use `dark:` para
cores de token (o token já muda no dark). Overlays de modal (`bg-black/80` do shadcn) são a
única cor literal aceita.

**D3:** nunca literais em `.attr('fill'|'stroke', ...)`/`.style(...)`; use `hsl(var(--token))`
(ex.: `hsl(var(--destructive))`, tooltip `hsl(var(--foreground) / 0.9)`) e sombra `var(--shadow-elegant)`.

### 2.2 Gradientes e sombras

| Classe | Uso |
|---|---|
| `bg-gradient-primary` | Botões/badges de ação principal |
| `bg-gradient-success` | Destaques positivos |
| `bg-gradient-subtle` | Fundo de página (`min-h-screen`) |
| `shadow-card`, `shadow-glow` | Elevação de cards |

---

## 3. Componentes Base (`src/components/ui/`)

Primitivos shadcn-ui sobre Radix. **Sempre importe daqui; nunca duplique** um
input, select, dialog, table etc. por conta própria.

Categorias principais:

- **Formulários**: `button`, `input`, `textarea`, `label`, `select`, `checkbox`,
  `radio-group`, `switch`, `slider`, `calendar`, `form`, `input-otp`, `toggle`
- **Superfície/navegação**: `card`, `table`, `tabs`, `accordion`, `breadcrumb`,
  `navigation-menu`, `pagination`, `menubar`, `sidebar`, `sheet`, `drawer`, `resizable`
- **Feedback**: `alert`, `alert-dialog`, `badge`, `progress`, `skeleton`, `sonner`,
  `toast`/`toaster`/`use-toast`, `tooltip`, `hover-card`
- **Overlays**: `dialog`, `responsive-modal` (ver §4), `popover`, `dropdown-menu`,
  `context-menu`
- **Utilitários**: `avatar`, `aspect-ratio`, `collapsible`, `separator`,
  `scroll-area`

Merge de classes sempre com `cn()` (`@/lib/utils`) — permite override limpo pelo chamador.

---

## 4. Componentes Compostos do Projeto

Padrões próprios construídos sobre as bases. São a referência de **como** montar UI neste projeto.

### 4.1 `ResponsiveModal` (`ui/responsive-modal.tsx`)

Modal responsivo **mobile-first**: abaixo de `md` vira **bottom sheet** (ancorado embaixo, cantos superiores arredondados, alça, `92dvh`, respeita a safe-area); de `md` em diante é uma caixa centralizada com largura por `size`. Estrutura em 3 camadas:
header fixo → corpo com scroll contido (`flex-1 min-h-0 overflow-y-auto`) → footer fixo.
O scroll **nunca** acontece no box inteiro.

```tsx
<ResponsiveModal
  open={isOpen}
  onOpenChange={(open) => !open && handleClose()}
  title="Nova Transação"
  size="md"                       // sm | md (default) | lg | xl
  footer={
    <>
      <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
      <Button type="submit" form="meu-form-id">Salvar</Button>
    </>
  }
>
  <form id="meu-form-id" onSubmit={handleSubmit} className="space-y-4">
    {/* campos */}
  </form>
</ResponsiveModal>
```

**Props**: `open?`/`onOpenChange?` (omitidos = modo não controlado p/ `DialogTrigger`),
`title?` (ReactNode; omitir = header customizado), `description?`, `children`, `footer?`,
`size?`, `className?`, `bodyClassName?`.

**Regras de uso:**

1. **Todo modal novo usa `ResponsiveModal`** — não use `Dialog`/`DialogContent` direto.
2. Botões de submit ficam no `footer` com `type="submit"` + atributo `form="<id>"`,
   apontando para o `<form id>` no corpo (mantém ações visíveis durante o scroll).
3. **Mobile-first**: base = coluna única, `w-[calc(100vw-1rem)]`, `max-h-[92dvh]`
   (respeita barra de endereço móvel). Desktop progride via `size`.
4. Em telas `sm:`, agrupe campos curtos em pares com `grid gap-4 sm:grid-cols-2`
   para reduzir altura e evitar scroll (ver `AddTransactionDialog`).
5. Inputs com fonte ≥16px no mobile (evita zoom automático do iOS).
6. **Nunca envolva o `ResponsiveModal` em um `<Dialog>` externo** para "ganhar" um
   `DialogTrigger`: cada `Dialog` (Root) do Radix tem estado próprio e o trigger
   controlaria a raiz de fora, que não renderiza conteúdo — o botão ficaria morto
   (bug real do `PluggyInfoDialog`). Para modo disparado por botão, use estado local:
   `const [open, setOpen] = useState(false)` + `onClick={() => setOpen(true)}` +
   `open`/`onOpenChange={setOpen}` no modal.

### 4.2 Gráficos D3 (`components/charts/`)

`D3BarChart`, `D3HorizontalBarChart`, `D3LineChart`, `D3PieChart`, `D3DailyChart`,
`IncomeChart`, `FlippableChart` (flip 3D anual/diário). Novos gráficos devem seguir
este padrão (D3 + wrapper React, consumindo tokens de cor do tema).

### 4.3 Domínios (`components/<domínio>/`)

- `dialogs/` — modais de negócio (todos sobre `ResponsiveModal`)
- `dashboards/`, `investments/`, `limits/`, `layout/` (`AppLayout`, `SidebarPanel`, `MobileTabBar`, `MobileTopBar`; `MobileTopBarSlot` injeta um controle, ex. seletor de mês, na barra superior mobile)
- `brand/` — `Logo` (marca Placo; cores só por tokens `primary`/`primary-foreground`)

### 4.4 `ConfirmDialog` (`ui/confirm-dialog.tsx`)

Confirmação padronizada (substitui `window.confirm` nativo). Baseado em `ResponsiveModal`,
com botões Cancelar/Confirmar no footer.

```tsx
<ConfirmDialog
  open={!!alvo}
  onOpenChange={(o) => !o && setAlvo(null)}
  title="Excluir conta recorrente?"
  description="Esta ação não pode ser desfeita."
  destructive          // botão vermelho para ações destrutivas
  confirmLabel="Excluir"
  onConfirm={() => handleDelete(alvo.id)}
/>
```

**Props**: `open`, `onOpenChange`, `title`, `description?`, `confirmLabel?` ("Confirmar"),
`cancelLabel?` ("Cancelar"), `destructive?` (false), `onConfirm`.
Padrão de uso: guardar o alvo em state (`pendingDeleteId` etc.) e abrir o dialog a partir dele.

### 4.5 `BankLogo` (`ui/bank-logo.tsx`)

Logo de banco por código FEBRABAN com **fallback automático** (badge com o código) se
falhar o carregamento — elimina os blocos duplicados `img + logoErrors` e garante o
mesmo comportamento de ícone (fonte: CDN do repositório GitHub `wesguirra/brazil-bank-data`)
em **Settings e no modal de transação** (banco adicionado pela busca também exibe o ícone).

```tsx
<BankLogo code={bank.bank_code} size="sm" />
<BankLogo code={bank.bank_code} size="lg" className="rounded-xl p-1 shadow-sm"
          fallback={<BankLogoFallback name={bank.bank_name} index={idx} size="lg" />} />
```

**Props do `BankLogo`**: `code?` (FEBRABAN; ausente ⇒ fallback), `size?` (`xs` w-4 | `sm` w-5 |
`md` w-6 | `lg` w-10), `className?` (extras aplicados ao img e fallback),
`alt?`, `fallback?` (ReactNode custom para falha/sem código).

Também exporta `bankLogoUrl(code)`, `bankInitials(name)`, `BANK_COLORS` (12 bg solid) e
`BankLogoFallback` (spans coloridas com iniciais, mesma regra de iniciais e paleta do Settings).

### 4.6 `EmptyState` (`ui/empty-state.tsx`)

Estado vazio padronizado: ícone em círculo `bg-muted` + mensagem + texto de apoio + CTA opcional.

```tsx
<EmptyState icon={Target} title="Nenhuma meta definida">
  <Button variant="link" size="sm" onClick={...}>Create primeira meta</Button>
</EmptyState>
```

**Props**: `icon?: LucideIcon`, `title`, `description?`, `children?` (ação), `className?`.

### 4.7 `PageHeader` (`ui/page-header.tsx`)

Cabeçalho padronizado de página: ícone em quadrado `bg-primary/10 rounded-xl` +
título `text-2xl font-bold` + descrição, com ação opcional à direita
(coluna no mobile, linha no `sm:`).

```tsx
<PageHeader
  icon={RefreshCw}
  title="Recurring Accounts"
  description="Gerencie suas despesas mensais fixas"
  action={<Button className="bg-gradient-primary">Nova Conta</Button>}
/>
```

**Props**: `icon?: LucideIcon`, `title`, `description?`, `action?: ReactNode`,
`className?` (default `mb-6`).

---

## 4.8 Utilitários de formatação (`src/lib/format.ts`)

Fonte única para formatação — **não crie `Intl.NumberFormat` inline**:

- `formatCurrency(value, currency?)` — Intl cacheado por moeda; default
  `DEFAULT_CURRENCY` (`'BRL'`). O parâmetro existe para a futura multi-moeda
  (ver `docs/backlog.md`, MULTI-01) — call sites não precisam passar nada hoje.
  Tudo em **pt-BR**: `R$ 5.865,00` (espaço sem quebra entre o símbolo e o valor).
- `formatDate(dateStr)` — `dd/mm/aaaa`; aceita `'YYYY-MM-DD'` ou ISO completo; anexa `T12:00:00`
  quando é só data (evita deslocamento de fuso)
- `formatPercent(value, digits?)` — vírgula decimal (`12,35%`)
- `formatNumber(value, options?)` — número pt-BR sem símbolo
- `formatCompactNumber(value)` — abreviado para eixos de gráfico (`5 mil`)
- Proibido `toFixed`/`toLocaleString('en-US')`/`R$ ` + número em texto de UI.

## 4.9 `CurrencyInput` (`ui/currency-input.tsx`)

Input monetário com prefixo **R$** e máscara pt-BR. Substitui `<Input type="number">`
em valores de dinheiro (adotado no `AddTransactionDialog`).

- **Máscara ao digitar**: separador de milhar ao vivo (`1234567` → `1.234.567`),
  decimais preservados sem arredondar até o blur (`1.234,56`)
- Desfocado exibe `1.234,50` (2 casas); em foco aceita dígitos, `,` e `.` (bloqueia letras)
- **Contrato com formulários**: `value`/`onChange` sempre em string canônica com
  ponto decimal (`"1234.56"`, `""` = vazio) — compatível com o `parseFloat` existente
- Testes: `currency-input.test.tsx` (inclui máscara ao vivo)

**Data `dd/mm/yyyy`:** o `AddTransactionDialog` usa um `Input` mascarado (helpers
`maskDateBR`/`brToIso`/`isoToBr`) que exibe `dd/mm/aaaa` e converte para ISO
(`yyyy-mm-dd`) no payload — o navegador de estrutura não usa `type="date"` nativo.

## 4.10 `StatCard` (`ui/stat-card.tsx`)

Cartão de métrica/resumo (kpi). Use em grids de resumo acima de tabelas/dashboards.

```tsx
<StatCard icon={Wallet} label="Total mensal ativo"
          value={formatCurrency(total)} hint="8 conta(s) ativa(s)" />
<StatCard icon={AlertTriangle} tone="warning" label="Acabando" value="2" />
```

**Props**: `icon?`, `label`, `value: ReactNode`, `hint?`,
`tone?: 'default' | 'success' | 'warning' | 'destructive'` (tokens do tema).
Adotado na linha de resumo de `/recorrentes`.

## 4.11 `BankSelect` (`ui/bank-select.tsx`)

Select de bancos do usuário (via `SettingsService.listBanks()`) com opção
**"+ Add new bank"**: revela mini-formulário (código FEBRABAN + nome), cria via
`addBank` e já seleciona o banco criado. Extrai o padrão que existia inline no
`ContaForm` — novos formulários que precisarem de banco devem usá-lo.

**Props**: `value?: string` (bank_code), `onValueChange(code | undefined)`,
`disabled?`, `className?`.

## 4.12 `BankSearchInput` (`ui/bank-search.tsx`)

Busca de bancos na **Brasil API** com autocomplete + criação via
`SettingsService.addBank`, disparando `onBankAdded(bank)` com o banco criado.

**Comportamento (idêntico ao de Configurações):**
- Busca só com ≥2 caracteres (debounce 300ms), dropdown com código + ISPB
- Navegação por setas ↑/↓ + Enter (adiciona o destacado), Escape fecha
- Criação via API e toast "Banco adicionado" (ou erro destrutivo)
- Extraído de `Settings.tsx`; usado também no `AddTransactionDialog`
  (box "Adicionar novo banco" em linha inteira, `new-bank-box`)

**Props**: `onBankAdded?`, `disabled?`, `className?`.
**Testes**: `bank-search.test.tsx` (não busca <2 chars, clica para adicionar, Enter).

## 4.13 `RecurringBillsTable` (`recorrentes/RecurringBillsTable.tsx`)

Tabela única de contas recorrentes, usada por `/recorrentes` e pela aba
Recorrentes de Limites (única diferença: `showBank`). Exporta também os helpers
`currentInstallment(conta)` e `isEndingSoon(conta)` — fonte única da regra da tag
"Acabando" (parcela ≥ 10 de 12).

**Props**: `contas`, `onToggleActive`, `onEdit`, `onDelete`, `onRenew?`,
`renewingId?`, `showBank?: boolean`.

## 4.14 `ErrorBoundary` (`components/ErrorBoundary.tsx`)

Barreira de erro **por rota** (classe React): crash de runtime em uma página não
derruba mais sidebar/app inteiro — só a área envolvida mostra fallback com a
mensagem do erro, botões "Tentar novamente" (reseta o estado interno) e "Voltar
ao início". Integração canônica nas rotas:

```tsx
<Route path="/x" element={guarded(<X />)} />  // guarded = helper no App.tsx
```

Toda rota nova DEVE ser envolvida.

## 4.15 `PageSkeleton` (`components/layout/PageSkeleton.tsx`)

Fallback de carregamento exibido pelo `<Suspense>` em `App.tsx` enquanto o chunk
de uma rota code-split (`React.lazy`) baixa. Composto por skeletons (`ui/skeleton`)
de cabeçalho, cards e bloco de conteúdo, com `aria-busy`/`aria-live` para a11y.
Não possui estado nem props — é estático por design.

## 4.16 `OverviewDashboard` (`components/dashboards/OverviewDashboard.tsx`)

Dashboard geral da página inicial (`Index.tsx`). BFF: consome **um único endpoint**
`GET /dashboard/overview` via `OverviewService.getOverview(year, month, entityType)`
e renderiza tudo sem joins/agregações no cliente:

- **Props:** `isAdmin?: boolean` (default `false`) — controla a exibição das seções
  Metas e Compras (admin-only, espelhando a regra do backend).
- **Navegação:** arrows de mês (‹/›) e toggle de entidade **Ambos/PF/PJ**
  (`all`/`pf`/`pj` → parâmetro `entity_type`) com refetch ao trocar.
- **Seções:** StatCards de Entradas/Saídas/Saldo/Cartão (citado do `ui/stat-card`),
  barra de progresso do mês até hoje (`month_progress.percent` 0-1), cards de
  categorias com limite + badge de status (Estourado/Para estourar/OK), parcelas
  do mês e recorrentes a pagar (badge "Acabando"), e rodapé com investido/saldo.
- **Cartão de crédito:** StatCard "Cartão" com `tone` por % usado — `>=100`
  `destructive` com badge **"Estourando"**, `>=80` `warning`, abaixo `success`
  (mesma escala 80/90/100 das notificações de limite).
- **Valores:** `formatCurrency` (pt-BR, `R$ 3.200,00`) e percentuais via `Math.round`.

---

## 4.16 `ChartAnchors` (`components/dashboards/ChartAnchors.tsx`)

Barra de navegação com âncoras que rolam (smooth `scrollIntoView`) até cada
gráfico/seção do dashboard da tela Financeiro.

- **Props:** `items: {id, label}[]` — o click busca `document.getElementById(id)`
  e rola até o elemento; se não existir, não faz nada (fail-safe).
- **Uso:** `Financial.tsx` renderiza abaixo do cabeçalho (date range + sidebar)
  com 4 âncoras: Métricas, Rendimento, Fixos vs Variáveis e Categorias — mirando
  os `id`s `dashboard-ancora-*` declarados nas seções do `FinancialDashboard`.
- **Estilo:** pills (botões) reutilizados de `ui/button` — primitivos não duplicados.

---

## 4.17 `NotificationBell` (`components/notifications/NotificationBell.tsx`)

Sino de alertas de limite no header do `AppLayout`. BFF: consome
`GET /notifications` via `useLimitAlerts` e só renderiza.

- **Dados:** `NotificationService.listNotifications()` → `{unread_count, items[]}`;
  `useLimitAlerts` faz poll a cada 30s e derruba a lista quando a página volta ao foco.
- **Badge:** contador de não lidas no ícone de sino (oculto quando 0).
- **Severidade (cor por threshold — cores separadas):** `warning` (âmbar) p/ 80%,
  `critical` (laranja) p/ 90%, `destructive` (vermelho) p/ 100%/estourado —
  computada no backend (`NotificationItem.from_orm`), o bell só renderiza o `Badge`.
- **Popover** (`ui/popover` + `ui/scroll-area`): lista de alertas com
  `Badge` de severidade e mensagem já formatada no backend. Ações: "Marcar todas"
  (PUT `/notifications/read-all`) e botão por item (PUT `/notifications/{id}/read`).
- **Acessibilidade:** `aria-label="Alertas (N não lidas)"` no botão do sino.

Conexão com o AddTransactionDialog: ao **digitar o valor + selecionar categoria** de
despesa, o front chama `GET /limits/risk-check?category_id=&amount=` e o backend
projeta `gasto atual + valor digitado`. O box (não-bloqueante) mostra a % projetada
com **cores por threshold** (`data-severity`): âmbar 80%, laranja 90%, vermelho 100%
("Segure a mão!" quando estoura) — sem badges, só a mensagem (testes em
`AddTransactionDialog.test.tsx`).

> **Design:** novos tipos de alerta devem reusar `AlertTriangle`, `Badge` com variantes
> `warning`/`destructive` e tokens existentes — nunca cores hardcoded.

## 4.18 `LimitsTab` — banner de % pré-save (`components/limits/LimitsTab.tsx`)

Aba de gerenciamento de limites que avisa **antes de persistir** quando o limite
digitado deixará a categoria perto/estourada do gasto real do mês.

- **Dados:** `FinancialService.getLimitsWithSpending(year, month)`
  (`GET /limits/with-spending`) → mapa `nome|pf/pj → spent` usado para calcular
  `% = gasto do mês ÷ limite digitado` (field do formulário). Backend também
  computa `percent_used` — o front apenas converte e exibe.
- **Banner colorido** (`data-testid="limit-alert-<nome>"`, `data-severity`):
  - `warning` (âmbar) `>=80%` — "Este limite deixará 'X' com 80% de uso neste mês"
  - `critical` (laranja) `>=90%`
  - `destructive` (vermelho) `>=100%` — sufixo "(estoura agora!)"
  - Some ao aumentar o limite (`<80%`); não aparece para `limit <= 0`.
- **Toast no save:** `handleSave` monta a lista nome+% das categorias `>=80%` e
  dispara um toast "Atenção: limites próximos do estouro" **antes** de persistir
  (não-bloqueante — o save segue normalmente).
- **Testes:** `LimitsTab.test.tsx` (banner some ao subir o limite, cores por
  threshold, toast antes do persistir).

## 5. Convenções de criação

1. **Genérico e reutilizável?** → `src/components/ui/` (primitivo, estilo shadcn/Radix).
2. **Padrão de negócio recorrente?** → extrair para `src/components/<domínio>/`.
3. Sempre: TypeScript tipado, props com defaults sensatos, `cn()` para overrides,
   acessibilidade (Radix quando aplicável), mobile-first.
4. Antes de criar, procure aqui e em `ui/` — **reutilizar > criar > duplicar**.

## 6. Roadmap do design system

Candidatos a extração (padrões hoje repetidos inline nas telas):

- [x] `PageHeader` — ver §4.7
- [x] `StatCard` — ver §4.10
- [x] `EmptyState` — ver §4.6
- [x] `StatusBadge` — resolvido com a variante **`warning`** do `Badge`
      (`<Badge variant="warning">` + ícone; usado na tag "Acabando")
- [x] `CurrencyInput` — ver §4.9
- [x] `ConfirmDialog` — ver §4.4
- [x] Unificar tabelas de contas recorrentes — ver §4.12 (`RecurringBillsTable`)
- [x] `BankSelect` — ver §4.11
- [ ] Adotar `CurrencyInput` nos demais formulários (ContaForm, Add/EditInvestmentDialog)
- [ ] Adotar `StatCard` em dashboards que ainda usam blocos ad-hoc

## 7. Regras de manutenção

Este arquivo **deve ser atualizado** quando:

1. Novo componente reutilizável criado ⇒ adicionar seção/tabela com props e exemplo.
2. Componente existente sofre mudança de API (props/behavior) ⇒ atualizar documentação.
3. Novo token de cor/gradiente/sombra ⇒ registrar na seção 2.
4. Padrão novo consolidado (ex.: forma canônica de montar formulários) ⇒ documentar na seção 5.
5. Formatação de moeda/data/porcentagem ⇒ sempre importar de `@/lib/format` (§4.8).

---

## 8. Mobile (fase 2): primitivos de página

Abaixo de `md` (< 768 px) as páginas usam estes primitivos; no desktop o visual segue o de antes.
Todo alvo de toque tem **>= 44 px** no mobile.

### 8.1 `SegmentedControl` (`ui/segmented-control.tsx`)

Seletor segmentado (`role="radiogroup"`, setas movem a seleção) para PF/PJ, Ambos/PF/PJ, Entrada/Saída.
**Props**: `options: {value, label, selectedClassName?}[]`, `value`, `onChange`, `aria-label` (obrigatório),
`size?: 'md' | 'compact'` (compact = visual pequeno do desktop), `fill?` (opções dividem a largura), `className?`.

### 8.2 `ChipGroup` (`ui/chip-group.tsx`)

Fileira de chips que **rola na horizontal** (nunca quebra nem estoura a tela): filtros, forma de pagamento, seções.
`variant="radio"` (escolha de formulário) ou `variant="tabs"` (`tablist`, troca de seção). **Props**: `options`, `value`, `onChange`, `aria-label`, `variant?`, `className?`.

### 8.3 `MonthStepper` (`layout/MonthStepper.tsx`)

"‹ nov 2026 ›" para o slot da barra superior (`MobileTopBarSlot`). Exporta `addMonths(ym, delta)` e o tipo `YearMonth` (`month` 1-12).

### 8.4 `lib/transactionGroups.ts`

`groupTransactionsByDay(lista, agora)` (grupos por dia, ordem preservada), `formatDayHeading(data, agora)`
("Hoje · 14 nov", "Ontem · 13 nov", "12 nov", ano só se diferente) e `signedAmount(t)` ("+R$ 10,00" / "−R$ 10,00" com sinal de menos real).

### 8.5 Alvos de toque (>= 44 px abaixo de `md`)

`Button` (`default`/`sm`/`icon`) vira `h-11` no mobile; `Input`, `SelectTrigger` e `CurrencyInput` ficam com `h-12` (48 px, campos de formulário);
`Checkbox`, `Switch` e `RadioGroupItem` ganham uma área de toque estendida (pseudo-elemento) de 44 px. No desktop nada muda.

### 8.6 `/financial` no mobile

`FinancialMobile` (`dashboards/`) monta a página abaixo de `md` na ordem do mock: seletor de mês no `MobileTopBarSlot`, chips de seção (`ChartAnchors`, rolam na horizontal),
`PaymentKpiCards` (carrossel com snap), `MonthlyBarsChart` (6 meses, legenda embaixo, toque lê o valor) e `TransactionListMobile`
(lançamentos agrupados por dia; tocar na linha abre `TransactionDetailSheet` com Editar/Excluir; a lixeira não aparece na linha), depois `FixedVariableCard` e as categorias.
O desktop segue com `FinancialDashboard` + `TransactionList` (os dois usam `PaymentKpiCards`, `FixedVariableCard` e o hook `useTransactionList`).
`useRecentMonths` (em `useFinancialQueries`) lê o ano do mês final e, se a janela cruza o ano, o anterior.

### 8.7 Início (`/`) no mobile

`OverviewDashboard` escolhe `OverviewMobile` abaixo de `md` (o desktop não muda): controle segmentado Ambos/PF/PJ, cartão de destaque "Saldo do mês" com entradas e saídas,
progresso do mês com o uso do cartão, "Perto do limite" (3 piores categorias, link "Ver limites" para `/limits`), "A pagar este mês", "Parcelas do mês" e, para admin, "Metas" e "Compras".
Listas longas mostram 3 itens e o botão "Ver tudo"/"Ver menos". O seletor de mês (`MonthStepper`) vai para o `MobileTopBarSlot`; o `h1` da página some no mobile (a barra superior já tem o título).

### 8.8 Limites (`/limits`) no mobile

`Limits` troca as abas por `ChipGroup variant="tabs"` (Categorias, Recorrentes; Metas e Compras só para admin) e põe PF/PJ num `SegmentedControl`.
Na aba Categorias, `LimitsCards` mostra um card por limite (mensal, cartão e categorias): barra de progresso e "Restam R$ X" ou "Passou R$ X do limite" —
os números vêm do backend (`/limits/with-spending`), sem recalcular no cliente. Tocar no card abre `LimitEditSheet` (nome em largura total, valor com `inputMode="decimal"`,
subcategorias, excluir com confirmação); o "+" da barra superior cria uma categoria. Salvar grava só aquela categoria. O estado editável e o salvar ficam em `useLimitsDraft`
(compartilhado com a tabela do desktop); a lógica pura está em `limitsModel.ts`.

### 8.9 Formulário de transação (criar e editar unificados)

`AddTransactionDialog` e `EditTransactionDialog` deixaram de duplicar campos (Q6): ambos usam `useTransactionForm` (estado, categorias por PF/PJ + tipo, bancos via `useBanks`, risco de limite)
e `TransactionFormFields`, que escolhe o layout por largura. O **desktop** manteve o visual de antes (radios + switch PF/PJ, grids de 2 colunas). No **mobile** (bottom sheet) o formulário segue o mock:
tipo em `SegmentedControl` (Saída/Entrada/Investimento), valor grande e centralizado com `inputMode="decimal"`, campos de 48 px, categoria e data lado a lado, chips (`ChipGroup`) para forma de pagamento e PF/PJ,
"Parcelado" como linha com switch e botão **Salvar** em largura total no rodapé. O Editar agora tem os mesmos campos mascarados do Add (valor com `CurrencyInput`, data `dd/mm/aaaa`) e os textos em português.
Lógica pura e testada em `transactions/transactionFormModel.ts`.

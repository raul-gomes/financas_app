# Análise da integração com a Pluggy

> Escrita em 2026-11-15 a partir do código em `develop` e da documentação oficial da Pluggy (docs.pluggy.ai, repositório `pluggyai/meu-pluggy`).
> Status: **proposta**. As decisões da seção 5 são do dono do produto e devem ser tomadas antes de codar.

## 1. Resumo

A integração atual **não funciona contra a API real da Pluggy**. Ela só passa nos testes porque eles simulam as respostas.

O modelo de credencial está errado. O código supõe que cada usuário cola uma "API Key" permanente do Meu Pluggy, mas na Pluggy:
- a API Key é gerada pelo **servidor**, com `client_id` e `client_secret` (`POST /auth`), e **expira em 2 horas**;
- os dados de cada pessoa ficam em **items** (uma conexão com um banco), e é pelo `itemId` que se chega às contas.

Além disso, o sync:
- relê todo o histórico a cada clique;
- ignora atualizações e exclusões;
- trata cartão de crédito e transações pendentes como lançamentos comuns;
- grava a data em UTC;
- pode cortar transações em silêncio.

A integração precisa ser refeita em torno de **items**, **contas mapeadas** e **sync incremental por webhook**. As fases estão na seção 6.

## 2. Como a Pluggy funciona (o que importa para nós)

| Conceito | Como é |
| --- | --- |
| Credenciais | `client_id` e `client_secret` de uma *Application* no Dashboard da Pluggy. Ficam só no servidor (no nosso caso, no EnvVault). |
| API Key | `POST /auth` com as credenciais. Vale 2 h, vai no header `X-API-KEY` e dá acesso total. |
| Connect Token | `POST /connect_token`. Vale 30 min, é seguro entregar ao navegador e serve para abrir o widget Pluggy Connect. Aceita `clientUserId`, que liga o item ao nosso usuário. |
| Item | Uma conexão de um usuário com uma instituição. Tem status (atualizado, atualizando, erro de login, esperando ação do usuário). |
| Meu Pluggy | App gratuito para **pessoa física**. A pessoa conecta os bancos via Open Finance em meu.pluggy.ai e depois autoriza uma Application de desenvolvedor por OAuth, uma vez por banco. Para o desenvolvedor, cada banco autorizado vira um **item**. Só dá para conectar contas enquanto o trial de 15 dias do Dashboard está ativo; depois disso, as conexões existentes continuam funcionando. |
| Contas | `GET /accounts?itemId=…`, com **`itemId` obrigatório**. Tipos: `BANK` ou `CREDIT`. Cartão traz `creditData` (limite, limite disponível, fechamento, vencimento). |
| Transações | `GET /v2/transactions?accountId=…` com cursor (`after`/`next`, 500 por página). Filtros: `dateFrom`/`dateTo`, `createdAtFrom` (para achar as **novas**, já que uma nova pode ter data passada) e `ids` (até 500). O `GET /transactions` paginado por número está **depreciado**. |
| `id` da transação | Estável entre syncs. Uma pendente que liquida mantém o id e chega como *updated*. Reconectar um banco cria um item novo, **com ids novos**. |
| Data | ISO 8601 em **UTC**. É preciso converter para `America/Sao_Paulo` antes de pegar o dia. |
| Sinal | Use `type` (`DEBIT` = saída, `CREDIT` = entrada). No cartão, valor positivo é compra e negativo é pagamento ou estorno. |
| Status | `PENDING` (fatura aberta, parcela futura, agendado) ou `POSTED` (liquidado). |
| Cartão | `creditCardMetadata.installmentNumber`/`totalInstallments`, mais `billId` (só em Open Finance). `operationType` diz `PAGAMENTO_FATURA`, `ESTORNO`, `PIX`, `TED`, `BOLETO`… |
| Atualização | A Pluggy atualiza cada item **todo dia**. Processos em lote do nosso lado são **proibidos** pelos termos. A janela de releitura é de 7 dias em Open Finance. Histórico inicial: até 12 meses. |
| Webhooks | `item/created`, `item/updated`, `item/error`, `item/waiting_user_action`, `item/deleted`, `transactions/created` (traz o `createdTransactionsLink`), `transactions/updated` e `transactions/deleted` (trazem `transactionIds`). Responder 2xx rápido; a Pluggy tenta de novo e depois desiste. Segurança: um header secreto configurado no webhook, mais a checagem do `clientId`. |
| Extras pagos | Categoria (`category`) e `merchant` exigem a assinatura Pro. Sem ela, só vem o `categoryId`. |

## 3. O que existe hoje

- **Backend:**
  - `services/pluggy_service.py`: cliente httpx;
  - `services/pluggy_sync_service.py`: casos de uso;
  - `routes/pluggy_routes.py`: rotas `/pluggy/accounts`, `/pluggy/sync` e `/pluggy/validate-key`, todas de admin;
  - `users.pluggy_api_key`: cifrada com Fernet;
  - `transacoes.external_id`/`external_source`: dedupe por id do provedor.
- **Frontend:**
  - em `pages/Settings.tsx`: campo da chave, botões "Validar" e "Sincronizar", e lista de contas;
  - `PluggyInfoDialog.tsx`: o passo a passo para o usuário;
  - `lib/pluggySync.ts`: o resumo do sync.
- **Já está bom e deve ficar:**
  - dedupe por `external_id` com índice único parcial;
  - adoção de linhas antigas;
  - `UnitOfWork`;
  - avaliação de limites depois do commit;
  - rotas só de admin;
  - nenhum detalhe de erro vazando para o cliente.

## 4. Problemas encontrados

Gravidade: **A** quebra a integração ou grava dado errado; **M** gera dado incompleto ou trabalho manual; **B** é acabamento.

| # | Grav. | Problema | Onde |
| --- | --- | --- | --- |
| P1 | A | **Modelo de credencial errado.** O usuário cola uma chave e o cliente manda `X-API-Key: <chave>` direto. A API Key real vem de `POST /auth` com `client_id`/`client_secret` e expira em 2 h, então uma chave colada para de funcionar em 2 h (ou nunca funcionou). | `pluggy_service.py` (`__init__`), `Settings.tsx`, `PluggyInfoDialog.tsx` |
| P2 | A | **`GET /accounts` sem `itemId`.** O parâmetro é obrigatório, então `list_accounts` e `sync` falham sempre na API real. O app não guarda nenhum `itemId`. | `fetch_accounts` |
| P3 | A | **`validate_api_key` usa `GET /items` para listar items.** Não achei esse endpoint de listagem na referência atual (só `GET /items/{id}`); com o P1, a validação nunca diz algo útil. | `fetch_items`, `validate_api_key` |
| P4 | A | **Data em UTC.** Faz `strftime` direto do ISO em UTC, então uma compra às 22h de Brasília cai no dia seguinte (e às vezes no mês seguinte), o que distorce os limites mensais. | `_to_import_row` |
| P5 | A | **Pagamento de fatura contado duas vezes.** A saída na conta corrente (`BOLETO`/"pagamento de fatura") vira despesa, e no cartão o pagamento (`CREDIT`, `PAGAMENTO_FATURA`) vira **entrada**. As compras do cartão já são as despesas. Resultado: despesa em dobro e uma receita falsa. | `_to_import_row` |
| P6 | A | **`PENDING` importado como definitivo.** Parcelas futuras e compras da fatura aberta entram como transações comuns. Quando liquidam, chegam como *updated*, mas o app ignora atualizações (P8), então valor ou data podem ficar errados. | `_to_import_row`, `sync` |
| P7 | A | **Truncamento silencioso.** Usa o `GET /transactions` depreciado, com `MAX_PAGES = 50` e o tamanho de página padrão. Contas com mais transações perdem as mais antigas sem aviso. | `fetch_transactions` |
| P8 | M | **Atualizações e exclusões ignoradas.** Uma transação alterada ou apagada na Pluggy fica como estava no app. | `sync` |
| P9 | M | **Sync completo a cada clique.** Não manda `dateFrom` nem `createdAtFrom`, então relê todo o histórico de todas as contas, em série e dentro da requisição HTTP (risco de timeout). O texto do diálogo fala em "últimos 90 dias", mas não existe esse filtro. | `sync`, `fetch_transactions`, `PluggyInfoDialog.tsx` |
| P10 | M | **Sem mapeamento de contas.** Toda linha vira PF, com categoria "Importado/Pluggy". O `bank_code` sai dos 3 primeiros dígitos do **número da conta**, e não do banco. Cartões não alimentam o limite do cartão. | `_to_import_row` |
| P11 | M | **Forma de pagamento errada.** Usa `paymentMethod` ou `category` em minúsculas (por exemplo "transfers"). Deveria derivar de `operationType` e do tipo de conta (`CREDIT` → crédito). | `_to_import_row` |
| P12 | M | **Parcelas do cartão perdidas.** `creditCardMetadata` é ignorado (`is_installment=False`), então uma compra em 10x vira 10 transações soltas, sem grupo. | `_to_import_row` |
| P13 | M | **Status do item invisível.** Erro de login, consentimento vencido ou ação pendente do usuário não aparecem; o sync só "não traz nada". | — |
| P14 | M | **Sem webhooks.** O app depende de alguém clicar em "Sincronizar". Como a Pluggy já atualiza todo dia, o certo é ouvir os eventos. | — |
| P15 | B | **Adoção de linha antiga sem olhar categoria nem conta.** Um lançamento manual igual (mesmo dia, valor e descrição) é adotado. | `_drop_already_imported` |
| P16 | B | **Classes que não são usadas.** `PluggyAccount`, `PluggyTransaction` e `PluggyItem` são declaradas mas não validadas: o código lê `dict` cru, sem Pydantic na borda. | `pluggy_service.py` |
| P17 | B | **Texto do diálogo desatualizado.** Fala em chave "plk_", "Criar nova chave" e 90 dias; nada disso bate com o fluxo real. | `PluggyInfoDialog.tsx` |

## 5. Decisões do dono (antes de codar)

1. **Para quem é a integração?**
   - (a) **Só uso pessoal (admin), via Meu Pluggy:** uma Application nossa no Dashboard e os bancos do dono autorizados por OAuth. É gratuito depois do trial, mas só é possível conectar bancos novos durante o trial.
   - (b) **Produto, para qualquer usuário, via Pluggy Connect:** widget no app e `clientUserId` = nosso usuário. Exige plano pago da Pluggy, termos de uso e LGPD (somos nós que tratamos os dados).

   Recomendação: **(a) agora**, com o modelo de dados já pronto para (b), que é o que as fases abaixo fazem. Hoje as rotas da Pluggy já são só de admin e estão fora do MVP.
2. **O que fazer com a coluna `users.pluggy_api_key` e o Fernet?** No modelo novo não existe chave por usuário: as credenciais da Application vão para o EnvVault e o banco guarda só `itemId`s, que não são segredo. Recomendação: apagar a coluna com uma migration nova e manter `core/crypto.py` só se outro segredo precisar dele (senão, apagar também e tirar `PLUGGY_KEY_ENCRYPTION_KEYS`).
3. **Pendentes:**
   - (a) importar já, marcadas como pendentes e atualizadas quando liquidarem;
   - (b) importar só as `POSTED`.

   Recomendação: **(b) para conta corrente** e **(a) para cartão** (a fatura aberta é justamente o que o limite precisa ver). Precisa de uma coluna `status` em `transacoes`.
4. **Pagamento de fatura:** ignorar o lado do cartão (`PAGAMENTO_FATURA`) e marcar o lado da conta corrente como **transferência** (fora de receitas e despesas)? Recomendação: sim. A despesa real são as compras do cartão.
5. **Parcelas do cartão:** usar as parcelas que a Pluggy manda (cada uma com seu id) e agrupá-las, **sem** gerar parcelas do nosso lado para linhas importadas? Recomendação: sim. Gerar as nossas causaria duplicata quando a parcela real chegasse.
6. **Categorias:** sem o plano Pro, só vem `categoryId`. Proposta:
   - uma tabela de regras por usuário (`categoryId` da Pluggy ou trecho da descrição → nossa categoria e subcategoria), aprendida quando o usuário recategoriza;
   - o que não casar vai para "Importado", como hoje.
7. **PF/PJ:** definido **por conta**, no mapeamento da conta (uma conta PJ importa tudo como PJ)? Recomendação: sim.
8. **Excluídas na Pluggy:** apagar no app ou só marcar? Recomendação: apagar, se a linha não foi editada pelo usuário; se foi, marcar e avisar.

## 6. Proposta de arquitetura

### 6.1 Dados (migrations novas)
- `pluggy_items`: `id`, `user_id`, `item_id` (único), `connector_name`, `status`, `execution_status`, `last_updated_at`, `consent_expires_at`, `created_at`.
- `pluggy_accounts`: `id`, `pluggy_item_id`, `account_id` (único), `type` (BANK/CREDIT), `subtype`, `name`, `number_masked`, `entity_type` (PF/PJ), `bank_id` (FK para os bancos do usuário), `credit_limit`, `close_day`, `due_day`, `import_enabled`, `last_synced_at` (marca d'água para o `createdAtFrom`).
- `transacoes`:
  - nova coluna `status` (`posted`/`pending`);
  - nova coluna `pluggy_account_id`;
  - o `external_id` atual continua;
  - parcelas reais agrupadas pelo `installment_group_id` existente.
- `pluggy_webhook_events`: `event_id` (único), `event`, `received_at`, `processed_at`, `error`. Garante idempotência e auditoria.
- Sai `users.pluggy_api_key` (decisão 2).

### 6.2 Backend
- **`PluggyClient`** (substitui o `PluggyService`):
  - credenciais do EnvVault (`PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`);
  - API Key de `POST /auth` em cache, renovada antes de 2 h e de novo em caso de 401;
  - métodos `get_item`, `list_accounts(item_id)`, `iter_transactions(account_id, date_from | created_at_from | ids)` com cursor até `next = null` (sem teto silencioso: se houver um limite de segurança, ele **falha alto**), `create_connect_token(client_user_id, item_id=None)` e `update_item(item_id)`;
  - respostas validadas com **Pydantic** na borda (P16);
  - mantém o tratamento de erros atual (`UpstreamError`, sem vazar detalhe).
- **`PluggyMapper`** (funções puras, fáceis de testar com JSON de exemplo):
  - data UTC → `America/Sao_Paulo` (P4);
  - sinal por `type`, com regra própria para cartão;
  - `operationType` → forma de pagamento (P11) e detecção de pagamento de fatura (P5);
  - `creditCardMetadata` → parcela (P12);
  - PF/PJ e banco a partir de `pluggy_accounts` (P10);
  - regras de categoria (decisão 6).
- **`PluggySyncService`:**
  - `connect_item(item_id)` registra o item e as contas;
  - `initial_import(account)` traz até 12 meses com `dateFrom`;
  - `import_created(account, since)` usa `createdAtFrom` da marca d'água;
  - `apply_updated(account, ids)` e `apply_deleted(ids)` (P8);
  - tudo idempotente pelo `external_id`, com o advisory lock por usuário que já existe (`core/advisory_lock.py`).
- **`POST /pluggy/webhook`** (sem login de usuário):
  - valida o header secreto e o `clientId`;
  - grava o evento em `pluggy_webhook_events` (o `eventId` repetido é ignorado);
  - responde 202 **na hora**;
  - o processamento roda fora da requisição (BackgroundTasks agora, fila depois) (P14, P9).
- **Rotas de admin novas:**
  - `GET /pluggy/items` (status de cada conexão);
  - `POST /pluggy/connect-token` (para o widget, opção 1b);
  - `PUT /pluggy/accounts/{id}` (mapeamento: PF/PJ, banco, importar ou não);
  - `POST /pluggy/items/{id}/refresh` (atualização manual, com limite de frequência);
  - `POST /pluggy/sync`, que vira "processar agora" usando a marca d'água, nunca o histórico todo.

### 6.3 Frontend (Configurações → Open Finance)
- Lista de **conexões**: banco, status com cor, última atualização, "Reconectar" quando há erro ou consentimento vencido (P13).
- Para cada conexão, as **contas**: PF/PJ, banco do app, importar sim ou não, e limite e fechamento do cartão.
- "Adicionar banco":
  - na opção 1a, um passo a passo do Meu Pluggy mais um campo para colar o `itemId`;
  - na opção 1b, o widget Pluggy Connect com o connect token.
- Revisão pós-import: possíveis duplicatas (já existe) e itens sem categoria, com "aplicar a todos parecidos" (alimenta as regras da decisão 6).
- Reescrever o `PluggyInfoDialog` (P17).

### 6.4 Testes
- Fixtures JSON reais e anonimizadas de cada formato:
  - conta corrente com PIX, TED e boleto;
  - cartão com compra parcelada, pagamento de fatura e estorno;
  - pendente que vira liquidada;
  - transação às 23h UTC−3.
- Mapper: um teste por regra (data, sinal, fatura, parcela, forma de pagamento, PF/PJ).
- Cliente: `respx` simulando `/auth` (inclusive a expiração), cursor com várias páginas e 401 que renova a chave.
- Webhook: secret errado → 401; `clientId` estranho → ignorado; `eventId` repetido → processado uma vez; created, updated e deleted aplicados de forma idempotente.
- Postgres (marcador `postgres`): unicidade de `item_id`, `account_id` e `event_id`.

## 7. Fases sugeridas

| Fase | Entrega | Resolve |
| --- | --- | --- |
| 0 | Decisões da seção 5. Criar a Application no Dashboard e guardar `PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET` no EnvVault (o dono). | — |
| 1 | `PluggyClient` com `/auth` e cursor, mais Pydantic; tabelas `pluggy_items`/`pluggy_accounts`; registrar item por `itemId` (Meu Pluggy); tela de conexões e contas. | P1, P2, P3, P7, P13, P16, P17 |
| 2 | `PluggyMapper` (data, sinal, fatura, forma de pagamento, PF/PJ, banco, parcelas); import inicial de 12 meses; marca d'água com `createdAtFrom`. | P4, P5, P9, P10, P11, P12 |
| 3 | Webhook com idempotência; `transactions/updated` e `transactions/deleted`; coluna `status` (pendente/liquidada). | P6, P8, P14 |
| 4 | Regras de categoria aprendidas; adoção de linha antiga restrita por conta; refresh manual com limite. | P15, decisão 6 |
| 5 (opcional) | Pluggy Connect para qualquer usuário, `clientUserId`, termos e LGPD. | decisão 1b |

## 8. Riscos e pontos em aberto

- **Trial do Meu Pluggy:** bancos novos só podem ser conectados enquanto o trial do Dashboard está ativo. É bom conectar todos de uma vez.
- **Consentimento do Open Finance:** expira (normalmente em até 12 meses). Precisa de aviso antes de vencer.
- **Reconectar um banco gera ids novos:** a adoção por data, valor e descrição continua necessária, agora restrita à mesma conta.
- **Webhook exige URL pública com HTTPS** (produção). Em dev, usar o botão "processar agora" ou um túnel.
- **Termos da Pluggy proíbem sync em lote periódico do nosso lado:** nada de cron relendo tudo, só webhook e refresh manual com limite.
- **Não validei contra uma conta real.** Esta análise vem do código e da documentação pública; a fase 1 começa confirmando os formatos com um item de verdade (sem gravar dado pessoal nas fixtures).

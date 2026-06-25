# Validação de Duplicatas em Transações

**Data:** 2026-06-25
**Status:** Aprovado

## Resumo

Implementar detecção de duplicatas ao criar transações (manual, upload de extrato e sincronização Pluggy), usando **data + valor** como critério. Quando uma duplicata é encontrada, o usuário escolhe entre: **Manter** (pular a nova), **Excluir** (remover a existente e inserir a nova) ou **Editar** (ajustar antes de salvar).

## 1. Critério de Duplicata

Uma transação é considerada duplicata quando existe outra com:
- **`data_transacao`** mesma data (ignorando hora) 
- **`valor`** exatamente igual

Não há tolerância ou fuzzy matching — critério rígido de data + valor.

## 2. Arquitetura

### 2.1 Backend — Novo Endpoint

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/transacoes/check-duplicates` | Verifica duplicatas (single ou bulk) |

**Request body (single):**
```json
{ "data_transacao": "2026-06-15", "valor": 150.00 }
```

**Request body (bulk):**
```json
{
  "transacoes": [
    { "index": 0, "data_transacao": "2026-06-15", "valor": 150.00 },
    { "index": 1, "data_transacao": "2026-06-16", "valor": 89.90 }
  ]
}
```

**Response:**
```json
{
  "results": [
    {
      "index": 0,
      "has_duplicate": true,
      "duplicates": [
        { "id": 42, "descricao": "Mercado", "valor": 150.0, "data_transacao": "2026-06-15T00:00:00", "tipo": "saida", ... }
      ]
    },
    {
      "index": 1,
      "has_duplicate": false,
      "duplicates": []
    }
  ]
}
```

### 2.2 Método no Repositório

Em `TransacaoRepository`:
```python
async def check_duplicates(self, data_transacao: date, valor: float) -> list[TransacaoORM]:
    """Busca transações com a mesma data (CAST de datetime para date) e valor."""
```

Usa `CAST(data_transacao AS DATE)` ou range de `>= data 00:00:00 AND < data+1 00:00:00`.

### 2.3 Pluggy — Modificação no Sync

O endpoint `POST /pluggy/sync` atualmente cria transações sem verificação. Novo comportamento:
1. Importa **todas** as transações normalmente (sem travar em duplicatas)
2. Após a importação, detecta duplicatas entre as recém-criadas e as existentes
3. Retorna campo adicional `duplicates` no response

**Response estendido:**
```json
{
  "total_criadas": 45,
  "transacoes": [...],
  "duplicates": [
    { "new_id": 101, "existing_id": 42, "descricao": "Mercado", "valor": 150.0, "data_transacao": "2026-06-15" }
  ]
}
```

### 2.4 Endpoint de Resolução (Pluggy)

Novo endpoint para o usuário resolver duplicatas após sync:

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/transacoes/resolve-duplicates` | Aplica resoluções do usuário |

**Request:**
```json
{
  "resolutions": [
    { "new_id": 101, "existing_id": 42, "action": "keep_both" | "keep_new" | "keep_existing" }
  ]
}
```

- `keep_both`: não faz nada (mantém as duas)
- `keep_new`: deleta a existente (existing_id), mantém a nova
- `keep_existing`: deleta a nova (new_id), mantém a existente

## 3. Fluxos do Frontend

### 3.1 Criação Manual

1. Usuário preenche formulário e clica "Salvar"
2. Frontend chama `POST /transacoes/check-duplicates` com `{ data_transacao, valor }`
3. Se `has_duplicate == false`: prossegue com `POST /transacoes/` normal
4. Se `has_duplicate == true`:
   - Exibe `DuplicateDialog` com dados da transação existente
   - Ações:
     - **Manter**: não cria nada (skip)
     - **Excluir**: dispara `DELETE /transacoes/{existing.id}`, depois `POST /transacoes/` com a nova
     - **Editar**: fecha o diálogo de duplicata e reabre o AddTransactionDialog com os campos pré-preenchidos com os dados originais, permitindo ao usuário ajustar valor, data ou descrição antes de salvar

### 3.2 Upload de Extrato

1. Usuário faz upload, revisa as transações, clica "Confirmar"
2. Frontend coleta todas as transações do payload e chama `POST /transacoes/check-duplicates` (bulk)
3. Se `results` contiver algum `has_duplicate == true`:
   - Exibe diálogo de resolução em lote
   - Navegação entre conflitos com "Aplicar a todos"
   - Usuário resolve cada conflito
   - Frontend filtra/ajusta o payload de confirmação:
     - "Manter" → remove transação do array
     - "Excluir" → adiciona `DELETE` para a existente, mantém transação no array
     - "Editar" → remove a transação conflitante do array e reabre o AddTransactionDialog pré-preenchido para o usuário ajustar; ao salvar, passa pela verificação de duplicata novamente
4. Se não houver duplicatas: prossegue com `POST /extractos/confirm` normal

### 3.3 Pluggy Sync

1. Usuário clica "Sincronizar Pluggy"
2. Frontend chama `POST /pluggy/sync`
3. Backend executa sync completo e retorna `{ total_criadas, transacoes, duplicates }`
4. Se `duplicates` não vazio:
   - Exibe modal com lista de duplicatas encontradas
   - Para cada duplicata: ações **Manter** (keep_both), **Excluir nova**, **Excluir antiga**
   - Após resolução do usuário, chama `POST /transacoes/resolve-duplicates` com as ações escolhidas
5. Se sem duplicatas: mostra toast de sucesso

## 4. Componentes Frontend

### DuplicateDialog

- `open: boolean`
- `transactions: Array<{ existing: Transaction, newData: { descricao, valor, data_transacao } }>`
- `onResolve: (action: 'keep' | 'replace' | 'edit', index: number) => void`
- `onResolveAll: (action: 'keep' | 'replace') => void` (opcional, para bulk)

Exibe:
- Título: "Duplicata encontrada"
- Tabela comparativa: original vs. nova
- 3 botões de ação
- No modo bulk: contador "X de Y" + botão "Aplicar a todos"

### Hooks

- `useDuplicateCheck()` — encapsula chamada ao endpoint e estado de resolução
- `usePluggySync()` — encapsula sync + resolução de duplicatas pós-sync

## 5. Alterações nos Arquivos

### Backend

| Arquivo | Mudança |
|---------|---------|
| `app/db/repositories/transacao.py` | Novo método `check_duplicates(data, valor)` |
| `app/routes/transacoes_routes.py` | Nova rota `POST /check-duplicates` |
| `app/routes/pluggy_routes.py` | Modificar sync para retornar duplicatas |
| `app/schemas/transacao.py` | Novo schema `DuplicateCheckRequest`, `DuplicateCheckResponse` |
| `app/schemas/pluggy.py` | Estender response com `duplicates` |

### Frontend

| Arquivo | Mudança |
|---------|---------|
| `src/services/financialService.ts` | Novo método `checkDuplicates()` |
| `src/services/extractoService.ts` | Novo método `checkDuplicates()` (reutiliza o mesmo endpoint) |
| `src/services/pluggyService.ts` | Ajustar tipagem do retorno |
| `src/components/AddTransactionDialog.tsx` | Adicionar duplicate check antes de salvar |
| `src/components/ExtratoDialog.tsx` | Adicionar duplicate check em lote antes de confirmar |
| `src/components/limits/ComprasTab.tsx` | (fora do escopo, apenas transações financeiras) |
| `src/components/DuplicateDialog.tsx` | **Novo** — componente de diálogo de resolução |
| `src/hooks/useDuplicateCheck.ts` | **Novo** — hook para lógica de verificação |
| `src/types/financial.ts` | Adicionar tipos de resolução |

## 6. Testes

### Backend
- Testar `check_duplicates` com data exata, data diferente, valor diferente
- Testar bulk check com múltiplas transações
- Testar fluxo de resolução (keep_both, keep_new, keep_existing)
- Testar Pluggy sync com duplicatas

### Frontend
- Testar abertura do diálogo quando duplicata detectada
- Testar cada ação (manter, excluir, editar)
- Testar bulk "Aplicar a todos"

## 7. Não Escopo

- Edição de transação (PUT) — não verificamos duplicatas ao editar
- Fuzzy matching ou similaridade de texto
- Detecção de duplicatas em contas recorrentes (já existe)
- Validação no backend para casos onde frontend não chama check-duplicates (medida de segurança extra pode ser adicionada em versão futura)

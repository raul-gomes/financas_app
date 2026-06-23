# Extrato Dialog — Sessões por Arquivo

**Data:** 2026-06-23  
**Status:** Approved

## 1. Problema

O modal de extrato atual exibe todas as transações de todos os arquivos em uma única tabela plana. Não há separação visual entre arquivos, não há associação de transações a um banco específico, e o usuário precisa confirmar tudo de uma vez — o que é arriscado quando há muitos arquivos/transações.

## 2. Solução

Redesign do `ExtratoDialog` para organizar o review em **sessões independentes**, uma por arquivo enviado. Cada sessão contém:

- Cabeçalho com nome do arquivo + seletor de banco + botão "Confirmar"
- Tabela de transações editável (mesmas regras do `AddTransactionDialog`)
- Estado visual: pendente (amarelo), confirmado (verde), sem banco (desabilitado)

## 3. Arquitetura

### 3.1 Fluxo de Dados

```
Upload (dropzone)
  ↓ upload individual por arquivo (API /extractos/upload)
  ↓
SessionData[] no frontend
  ├── filename: string
  ├── bankCode: string (selecionado pelo usuário)
  ├── isConfirmed: boolean
  └── transactions: ParsedTransaction[]
  ↓
Confirmação por sessão ou "Confirmar Todas"
  ↓
POST /extractos/confirm  (payload com bank_code por transação)
  ↓
Backend cria transações via create_from_extracto (agora com bank_code)
```

### 3.2 Backend — Schemas

**`ParsedTransaction`** (já existe, adicionar campo):
```python
class ParsedTransaction(BaseModel):
    data: str
    descricao: str
    valor: float
    tipo: str
    categoria_id: Optional[int] = None
    subcategoria_id: Optional[int] = None
    forma_pagamento: Optional[str] = None   # já existe na versão atual? verificar
    natureza: Optional[str] = None
```

**`ConfirmTransaction`** (adicionar campo):
```python
class ConfirmTransaction(BaseModel):
    data: str
    descricao: str
    valor: float
    tipo: str
    categoria_id: int
    subcategoria_id: int
    forma_pagamento: str = 'pix'
    natureza: str = 'pf'
    bank_code: Optional[str] = None          # NOVO
```

### 3.3 Backend — Repositório

**`create_from_extracto`** recebe novo parâmetro `bank_code: Optional[str] = None` e salva no ORM.

### 3.4 Frontend — Tipos

**`ParsedTransaction`** (frontend):
```typescript
export interface ParsedTransaction {
  data: string;
  descricao: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  categoria_id?: number;
  subcategoria_id?: number;
  forma_pagamento: string;
  natureza: string;
}
```

**Novo `SessionData`**:
```typescript
export interface SessionData {
  filename: string;
  bankCode: string;
  isConfirmed: boolean;
  transactions: ParsedTransaction[];
}
```

### 3.5 Frontend — Serviço

`ExtractoService.uploadMultiple` alterado para retornar `SessionData[]` em vez de merged result. Cada sessão = resultado de um arquivo individual.

```typescript
static async uploadMultiple(files: File[]): Promise<SessionData[]>
```

## 4. Layout do Modal

### 4.1 Fase de Upload (inalterada)

Dropzone atual, aceita múltiplos arquivos .csv/.ofx/.qfx.

### 4.2 Fase de Review (redesenhada)

#### Top Bar
- Cards de resumo: Total, Entradas, Saídas
- Botão "Confirmar Todas" (desabilitado se todas sessões já confirmadas ou se alguma sem banco)

#### Sessão (um por arquivo)

Cada sessão é um card com borda e background de acordo com o estado:

```
┌──────────────────────────────────────────────────────┐
│  📄 extrato-junho.csv          Banco: [Nubank ▾] [+] │
│  25 transações                   [✓ Confirmar]       │
├──────────────────────────────────────────────────────┤
│  ┌─────────┬──────────┬───────┬──────┬──────────────┐│
│  │ Data    │ Descrição│ Valor │ Tipo │ Forma Pagto  ││
│  ├─────────┼──────────┼───────┼──────┼──────────────┤│
│  │ 01/07   │ Amazon   │ -19,90│ Saída│ [Crédito ▾]  ││
│  │ ...     │          │       │      │              ││
│  └─────────┴──────────┴───────┴──────┴──────────────┘│
└──────────────────────────────────────────────────────┘
```

**Estados visuais:**
- **Pendente (⚠️):** borda amarela, fundo do header claro, botão Confirmar habilitado (se banco selecionado)
- **Sem banco (⛔):** borda amarela, botão Confirmar desabilitado, dropdown de banco com destaque
- **Confirmado (✅):** borda verde, fundo esverdeado, tabela colapsada/readonly, badge "Confirmado"

### 4.3 Inline "Adicionar Banco"

Quando o usuário seleciona "+ Adicionar novo banco" no dropdown, um mini-formulário aparece expandido abaixo do select:

```
Código: [_______]
Nome:   [_______]
[Cancelar] [Adicionar]
```

Após adicionar, o banco é salvo via API e o select é atualizado automaticamente.

## 5. Regras da Tabela

Cada linha da tabela segue as mesmas regras dos diálogos de criação/edição:

| Coluna | Comportamento |
|--------|--------------|
| Data | Somente leitura (veio do extrato) |
| Descrição | Input editável inline |
| Valor | Somente leitura, cor verde/vermelho |
| Tipo | Badge fixo (entrada/saída) |
| Forma Pagto | Select com opções + "Outros..." → input inline |
| Natureza | Select PF/PJ |
| Categoria | Select filtrado por tipo + "Outros..." → input inline |
| Subcategoria | Select filtrado pela categoria + "Outros..." → input inline |

## 6. Fluxo de Confirmação

### Por Sessão
1. Usuário clica "Confirmar" na sessão
2. Valida: banco selecionado, todas transações com categoria+subcategoria preenchidas
3. Se falhar: toast com motivo, sessão permanece editável
4. Se ok: envia `POST /extractos/confirm` com payload das transações + bank_code
5. Sucesso: badge "Confirmado ✓", tabela fica readonly, botão desabilitado
6. Erro: toast com erro, sessão permanece editável

### Confirmar Todas
1. Itera sobre sessões pendentes
2. Para cada, executa validação + envio
3. Se uma falhar: mostra erro, para o processo
4. Se tudo ok: todas marcadas como confirmadas

## 7. Tratamento de Erros

- **Rede/API:** toast de erro, sessão não é marcada como confirmada
- **Validação local:** toast com descrição do problema (banco não selecionado, categoria faltando)
- **Sessão já confirmada:** botão fica disabled, não permite re-envio

## 8. Arquivos Afetados

### Backend
- `backend/app/schemas/extracto.py` — add bank_code to ConfirmTransaction, add forma_pagamento/natureza to ParsedTransaction
- `backend/app/db/repositories/transacao.py` — add bank_code to create_from_extracto
- `backend/app/routes/extracto_routes.py` — pass bank_code on confirm

### Frontend
- `frontend/src/types/extracto.ts` — add SessionData, update ParsedTransaction/ConfirmTransaction
- `frontend/src/services/extractoService.ts` — return SessionData[] from uploadMultiple
- `frontend/src/components/ExtratoDialog.tsx` — complete redesign with sessions

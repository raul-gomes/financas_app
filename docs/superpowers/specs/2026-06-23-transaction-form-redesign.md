# Transaction Form Redesign

**Date:** 2026-06-23
**Status:** Approved for implementation

## Overview

Redesign the Add/Edit Transaction dialog to:
- Replace the PJ checkbox with a PF/PJ toggle switch
- Add a Banco (bank) dropdown showing the user's registered banks
- Replace credit-card-only installment logic with a universal "Parcelado" toggle
- Implement installments for both income (entrada) and expenses (saída)

## Form Layout (final order)

```
Tipo [radio: Saída | Entrada | Investimento]   PF [⚫___] PJ [switch]
Valor
Descrição
Categoria [select] | Subcategoria [select]
Banco [dropdown — user's registered banks]
Forma de Pagamento [select]   Parcelado [switch ON/OFF]
  └─ [if ON] Bloco: Total de Parcelas [input] + Valor por parcela (calc)
Data
[Cancelar] [Adicionar]
```

## Changes by Layer

### 1. Backend — Database Model (`TransacaoORM`)

**Add column:**
- `bank_code: String, nullable=True` — stores the COMPE code (e.g., "341", "001")

**Migration:**
- New Alembic migration adding `bank_code` to `transacoes` table

### 2. Backend — Schemas (`transacao.py`)

**`TransacaoBase`**: add `bank_code: Optional[str] = None`
**`TransacaoCreate`**: inherits `bank_code` from base
**`TransacaoResponse`**: inherits `bank_code` from base
**`TransacaoUpdate`**: add `bank_code: Optional[str] = None`

### 3. Backend — Repository (`transacao.py`)

**Change installment condition:**
- Remove the `forma_pagamento == CREDITO` requirement from the installment splitting logic
- New condition: if `total_parcelas is not None and total_parcelas > 1` → split into installments, regardless of payment method

**No change needed in:**
- `_create_transacaoes_parceladas` — it already works independently of payment method
- `_calcular_valor_parcela` — division logic is universal

### 4. Frontend — Types (`financial.ts`)

Add to `Transaction` interface:
```ts
bank_code?: string | null;
```

Also add to any payload types (`TransactionCreate`, etc.) — currently the frontend builds payloads ad-hoc in `handleSubmit`.

### 5. Frontend — AddTransactionDialog

**State changes:**
- Add `parcelado: boolean` (controls whether parcelas block is shown; default: `false`)
- Add `bank_code: string` (selected bank code)
- Add `banks: UserBank[]` (loaded banks list)
- Remove implicit `forma_pagamento === 'credito'` → installments logic

**New JSX blocks:**

**a) Natureza switch (PF/PJ) — inline with Tipo radio:**
```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
  <span>PF</span>
  <Switch checked={formData.natureza === 'pj'} onCheckedChange={...} />
  <span>PJ</span>
</div>
```
Placed at the end of the Tipo radio group row, right-aligned.

**b) Banco dropdown — after Subcategoria:**
```tsx
<Select value={formData.bank_code} onValueChange={...}>
  <SelectTrigger><SelectValue placeholder="Selecione um banco" /></SelectTrigger>
  <SelectContent>
    {banks.map(b => (
      <SelectItem key={b.id} value={b.bank_code}>
        <div style="display:flex;align-items:center;gap:8px">
          <BankLogo code={b.bank_code} />
          {b.bank_name} ({b.bank_code})
        </div>
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

**c) Parcelado switch — same row as Forma de Pagamento:**
```tsx
<div className="flex items-center gap-2">
  <Switch checked={parcelado} onCheckedChange={setParcelado} />
  <Label>Parcelado</Label>
</div>
```

**d) Parcelas block — conditional on `parcelado` (not on payment method):**
```tsx
{parcelado && (
  <div className="border border-dashed border-primary/40 rounded-lg p-4 bg-primary/5">
    <Label>Total de Parcelas</Label>
    <Input type="number" min="2" value={...} onChange={...} />
    <p className="text-sm text-muted-foreground mt-1">
      Valor de cada parcela: R$ {calculateParcelValue()}
    </p>
  </div>
)}
```

**e) Submit payload changes:**
- Always include `bank_code` if selected
- Include `parcela: 1` and `total_parcelas: N` only when `parcelado === true` (regardless of payment method or tipo)

**f) Reset state on close:**
- Reset `parcelado` to `false`
- Reset `bank_code` to `''`

### 6. Frontend — EditTransactionDialog

Same changes as AddTransactionDialog, with these differences:
- Pre-populate `parcelado` based on `total_parcelas > 1` from existing transaction
- Pre-populate `bank_code` from existing transaction
- Keep validation: if `parcelado` is true, `total_parcelas` is required

### 7. Loading Banks

Both dialogs need to load the user's banks. Options:
- **Option A (chosen):** Load banks in the dialog component using `SettingsService.listBanks()` on open
- **Option B:** Pass banks as a prop from the parent page (Financial.tsx)

Option A is simpler and keeps the dialog self-contained. Cache the banks list so it's not fetched on every re-render.

### 8. Bank Logo in Dropdown

Reuse the `getBankLogoUrl` + `onError` fallback pattern from Settings.tsx:
```tsx
<img src={getBankLogoUrl(code)} className="w-5 h-5 rounded object-contain" onError={...} />
```

## Data Flow

```
User opens dialog
  → fetch banks via SettingsService.listBanks()
  → render form with all fields

User fills form
  → selects Banco (bank_code)
  → selects Forma de Pagamento
  → toggles Parcelado (parcelado = true)
  → enters Total de Parcelas
  → sees calculated parcel value update live

User submits
  → payload includes: bank_code (if selected), parcela/total_parcelas (if parcelado)
  → backend stores bank_code on the transaction
  → backend splits into installments if total_parcelas > 1 (regardless of payment method)
```

## ExtratoDialog Considerations

The ExtratoDialog (imported transactions) will NOT be updated in this iteration. It doesn't have parcelas or bank fields today. Future iteration if needed.

## Files Changed

| File | Change |
|------|--------|
| `backend/app/db/models/transacao.py` | Add `bank_code` column |
| `backend/app/schemas/transacao.py` | Add `bank_code` to all schemas |
| `backend/app/db/repositories/transacao.py` | Remove credit-only condition for installments |
| `backend/app/db/migrations/versions/` | New migration for `bank_code` column |
| `frontend/src/types/financial.ts` | Add `bank_code` to Transaction |
| `frontend/src/components/AddTransactionDialog.tsx` | Full redesign |
| `frontend/src/components/EditTransactionDialog.tsx` | Full redesign |
| `frontend/src/services/settingsService.ts` | Export `UserBank` type (already exported) |

## Not in Scope

- ExtratoDialog (bank import) — no parcelas or bank assignment
- Recurrent bills — no parcelas form fields (separate feature)
- Transaction list/filter — no bank filter column in this iteration

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, Pencil, RefreshCw, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BankLogo } from "@/components/ui/bank-logo";
import { formatCurrency } from "@/lib/format";
import type { ContaRecorrente } from "@/types/recurringAccount";

/** Altura fixa estimada de cada linha da tabela (px). */
const ROW_HEIGHT = 52;

interface RecurringBillsTableProps {
  contas: ContaRecorrente[]
  onToggleActive: (conta: ContaRecorrente) => void
  onEdit: (conta: ContaRecorrente) => void
  onDelete: (id: number) => void
  /** Omitido = coluna de renovação não renderiza. */
  onRenew?: (id: number) => void
  renewingId?: number | null
  /** Exibe a coluna Banco (logo + código FEBRABAN). */
  showBank?: boolean
}

/** Parcela atual = total - restantes + 1 (restantes inclui o mês corrente). */
export const currentInstallment = (conta: ContaRecorrente): number =>
  Math.min(conta.total_installments, Math.max(1, conta.total_installments - conta.remaining_installments + 1))

/** Tag "Acabando" apenas nas parcelas finais (10+ de 12). */
export const isEndingSoon = (conta: ContaRecorrente): boolean =>
  conta.active && conta.remaining_installments > 0 && currentInstallment(conta) >= 10

/**
 * Tabela compartilhada de contas recorrentes com virtualização de linhas.
 *
 * Usada pela página `/recorrentes` e pela aba Recorrentes de Limites —
 * a diferença entre elas é apenas `showBank`.
 *
 * Virtualização: apenas linhas visíveis (+ overscan) são montadas no DOM;
 * espaçadores `<tr>` preservam a altura total do scroll.
 */
export function RecurringBillsTable({
  contas,
  onToggleActive,
  onEdit,
  onDelete,
  onRenew,
  renewingId,
  showBank = false,
}: RecurringBillsTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: contas.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const items = virtualizer.getVirtualItems();
  const columnCount = showBank ? 8 : 7;

  const paddingTop = items.length > 0 ? items[0].start : 0;
  const lastItem = items.length > 0 ? items[items.length - 1] : null;
  const paddingBottom = lastItem
    ? Math.max(0, virtualizer.getTotalSize() - (lastItem.start + lastItem.size))
    : 0;

  return (
    <div ref={parentRef} className="overflow-auto max-h-[70vh]">
      <table className="w-full">
        <thead>
          <tr>
            <th className="sticky top-0 z-10 bg-muted text-left px-4 py-3 text-sm font-medium text-muted-foreground">Descricao</th>
            <th className="sticky top-0 z-10 bg-muted text-left px-4 py-3 text-sm font-medium text-muted-foreground">Valor</th>
            <th className="sticky top-0 z-10 bg-muted text-left px-4 py-3 text-sm font-medium text-muted-foreground">Vencimento</th>
            <th className="sticky top-0 z-10 bg-muted text-left px-4 py-3 text-sm font-medium text-muted-foreground">Categoria</th>
            {showBank && (
              <th className="sticky top-0 z-10 bg-muted text-left px-4 py-3 text-sm font-medium text-muted-foreground">Banco</th>
            )}
            <th className="sticky top-0 z-10 bg-muted text-left px-4 py-3 text-sm font-medium text-muted-foreground">Parcelas</th>
            <th className="sticky top-0 z-10 bg-muted text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
            <th className="sticky top-0 z-10 bg-muted text-left px-4 py-3 text-sm font-medium text-muted-foreground">Acoes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {paddingTop > 0 && (
            <tr aria-hidden style={{ height: paddingTop }}>
              <td colSpan={columnCount} />
            </tr>
          )}
          {items.map((virtualRow) => {
            const conta = contas[virtualRow.index];
            return (
              <tr key={conta.id} data-index={virtualRow.index} className={`hover:bg-muted/30 ${!conta.active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 text-sm font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    {conta.description}
                    {isEndingSoon(conta) && (
                      <Badge variant="warning" className="shrink-0 gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Acabando
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">{formatCurrency(conta.amount)}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">Dia {conta.due_day}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {conta.category_name}
                  {conta.subcategory_name && ` / ${conta.subcategory_name}`}
                </td>
                {showBank && (
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {conta.bank_code ? (
                      <div className="flex items-center gap-1.5">
                        <BankLogo code={conta.bank_code} size="xs" />
                        <span>{conta.bank_code}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {currentInstallment(conta)}/{conta.total_installments}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => onToggleActive(conta)} className="flex items-center gap-1 text-sm">
                    {conta.active ? (
                      <ToggleRight className="w-5 h-5 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                    )}
                    <span className={`text-xs ${conta.active ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {conta.active ? 'Ativa' : 'Inativa'}
                    </span>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Editar"
                      aria-label={`Editar ${conta.description}`}
                      onClick={() => onEdit(conta)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {onRenew && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRenew(conta.id)}
                        disabled={renewingId === conta.id || (conta.active && conta.remaining_installments > 2)}
                        title={
                          conta.active && conta.remaining_installments > 2
                            ? 'Ainda ha parcelas restantes'
                            : 'Renovar por mais 12 meses'
                        }
                      >
                        <RefreshCw className={`w-4 h-4 ${renewingId === conta.id ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Excluir"
                      aria-label={`Excluir ${conta.description}`}
                      onClick={() => onDelete(conta.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden style={{ height: paddingBottom }}>
              <td colSpan={columnCount} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

import { AlertTriangle, Pencil, RefreshCw, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BankLogo } from "@/components/ui/bank-logo";
import { formatCurrency } from "@/lib/format";
import type { ContaRecorrente } from "@/types/recurringAccount";

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
 * Tabela compartilhada de contas recorrentes.
 *
 * Usada pela página `/recorrentes` e pela aba Recorrentes de Limites —
 * a diferença entre elas é apenas `showBank`.
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
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted/50 border-b border-border">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Descricao</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Valor</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Vencimento</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Categoria</th>
            {showBank && (
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Banco</th>
            )}
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Parcelas</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Acoes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {contas.map((conta) => (
            <tr key={conta.id} className={`hover:bg-muted/30 ${!conta.active ? 'opacity-50' : ''}`}>
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
          ))}
        </tbody>
      </table>
    </div>
  )
}

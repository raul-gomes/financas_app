import type { ContaRecorrente } from "@/types/recurringAccount";

/** Parcela atual = total - restantes + 1 (restantes inclui o mês corrente). */
export const currentInstallment = (conta: ContaRecorrente): number =>
  Math.min(conta.total_installments, Math.max(1, conta.total_installments - conta.remaining_installments + 1))

/** Tag "Acabando" apenas nas parcelas finais (10+ de 12). */
export const isEndingSoon = (conta: ContaRecorrente): boolean =>
  conta.active && conta.remaining_installments > 0 && currentInstallment(conta) >= 10

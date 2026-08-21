import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type StatCardTone = "default" | "success" | "warning" | "destructive"

interface StatCardProps {
  icon?: LucideIcon
  /** Rótulo curto acima do valor. */
  label: string
  /** Valor principal (texto formatado ou ReactNode). */
  value: React.ReactNode
  /** Observação opcional abaixo do valor (ex.: "8 contas ativas"). */
  hint?: React.ReactNode
  tone?: StatCardTone
  className?: string
}

const toneClasses: Record<StatCardTone, string> = {
  default: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  destructive: "text-destructive bg-destructive/10",
}

/**
 * Cartão de estatística/resumo (kpi) padronizado.
 *
 * Use em linhas de resumo (`grid grid-cols-2 lg:grid-cols-4 gap-4`) acima de
 * tabelas/dashboards para substituir blocos ad-hoc de Card+Label.
 */
export function StatCard({ icon: Icon, label, value, hint, tone = "default", className }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 shadow-card", className)}>
      <div className="flex items-center gap-2">
        {Icon ? (
          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", toneClasses[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className={cn("mt-2 text-xl font-bold leading-none", Icon ? "" : toneClasses[tone].split(" ")[0])}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

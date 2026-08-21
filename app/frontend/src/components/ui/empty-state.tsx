import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  /** Ícone opcional exibido dentro de um círculo bg-muted. */
  icon?: LucideIcon
  /** Mensagem principal. */
  title: React.ReactNode
  /** Texto de apoio menor. */
  description?: React.ReactNode
  /** Ação opcional (botão/link) renderizada abaixo da descrição. */
  children?: React.ReactNode
  className?: string
}

/**
 * Estado vazio padronizado (lista sem dados, busca sem resultado etc.).
 *
 * ```tsx
 * <EmptyState icon={Target} title="Nenhuma meta definida">
 *   <Button variant="link" size="sm" onClick={...}>Create primeira meta</Button>
 * </EmptyState>
 * ```
 */
export function EmptyState({ icon: Icon, title, description, children, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 py-10 px-4 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      ) : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </div>
  )
}

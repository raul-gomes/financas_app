import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  /** Ícone exibido em um quadrado bg-primary/10 arredondado. */
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  /** Conteúdo alinhado à direita (ex.: botão de criação). */
  action?: React.ReactNode
  className?: string
  /**
   * Hide icon, title and description below `md`: pages inside the app shell already show
   * their title in the mobile top bar. The action stays visible.
   */
  hideTitleOnMobile?: boolean
}

/**
 * Cabeçalho padronizado de página: ícone + título + descrição e,
 * opcionalmente, uma ação à direita.
 */
export function PageHeader({ icon: Icon, title, description, action, className, hideTitleOnMobile = false }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4",
        className ?? "mb-6",
        hideTitleOnMobile && !action && "max-md:hidden",
      )}
    >
      <div className={cn("flex items-center gap-3", hideTitleOnMobile && "max-md:hidden")}>
        {Icon ? (
          <div className="shrink-0 p-2.5 rounded-xl bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        ) : null}
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  )
}

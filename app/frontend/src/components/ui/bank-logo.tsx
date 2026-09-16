import * as React from "react"
import { useState } from "react"
import { cn } from "@/lib/utils"

export const BANK_LOGO_CDN =
  "https://cdn.jsdelivr.net/gh/wesguirra/brazil-bank-data@main/bank-logos/256/png"

/** URL do logo a partir do código FEBRABAN (ex.: '260' → .../260.png). */
export const bankLogoUrl = (code: string) => `${BANK_LOGO_CDN}/${code.padStart(3, "0")}.png`

/** Iniciais do banco (mesma regra usada no fallback do logo). */
export const bankInitials = (name: string) => {
  const words = name.replace(/S\.A\.?$/i, "").trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return words[0].slice(0, 2).toUpperCase()
}

/** Paleta do fallback com iniciais por posição do banco na lista. */
export const BANK_COLORS = [
  "bg-blue-500", "bg-orange-500", "bg-emerald-500", "bg-purple-500",
  "bg-pink-500", "bg-teal-500", "bg-red-500", "bg-indigo-500",
  "bg-cyan-500", "bg-amber-500", "bg-lime-500", "bg-rose-500",
]

/** Fallback padrão com iniciais coloridas (usado por Settings e pelo modal de transação). */
export function BankLogoFallback({
  name,
  index = 0,
  size = "sm",
  className,
}: {
  name: string
  index?: number
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded font-bold leading-none text-white",
        sizeClasses[size],
        BANK_COLORS[index % BANK_COLORS.length],
        className,
      )}
    >
      {bankInitials(name)}
    </span>
  )
}

interface BankLogoProps {
  /** Código FEBRABAN do banco. Se ausente, exibe o fallback. */
  code?: string | null
  size?: "xs" | "sm" | "md" | "lg"
  /** Classes extras aplicadas ao <img> e ao fallback padrão. */
  className?: string
  alt?: string
  /** Conteúdo custom exibido sem código ou em falha de carregamento. Padrão: badge com o código. */
  fallback?: React.ReactNode
}

const sizeClasses: Record<NonNullable<BankLogoProps["size"]>, string> = {
  xs: "w-4 h-4 text-[6px]",
  sm: "w-5 h-5 text-[8px]",
  md: "w-6 h-6 text-[10px]",
  lg: "w-10 h-10 text-sm",
}

/**
 * Logo de banco com fallback automático em caso de falha de carregamento.
 * Substitui os blocos duplicados `img + logoErrors` espalhados pelo app.
 */
export function BankLogo({ code, size = "sm", className, alt, fallback }: BankLogoProps) {
  const [failed, setFailed] = useState(false)

  if (!code || failed) {
    if (fallback) return <>{fallback}</>
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded bg-primary/10 font-bold leading-none text-primary",
          sizeClasses[size],
          className,
        )}
      >
        {code ?? "?"}
      </span>
    )
  }

  return (
    <img
      src={bankLogoUrl(code)}
      alt={alt ?? ""}
      loading="lazy"
      className={cn("shrink-0 rounded object-contain bg-card", sizeClasses[size], className)}
      onError={() => setFailed(true)}
    />
  )
}

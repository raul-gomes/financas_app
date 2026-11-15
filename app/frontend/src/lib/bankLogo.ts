// Pure helpers of the bank logos (URL, initials, fallback palette); the components live in components/ui/bank-logo.tsx

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
  "bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4",
  "bg-chart-5", "bg-chart-6", "bg-chart-7", "bg-chart-8",
  "bg-chart-9", "bg-chart-10", "bg-chart-11", "bg-chart-12",
]

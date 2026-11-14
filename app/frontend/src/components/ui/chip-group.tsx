import * as React from "react"
import { cn } from "@/lib/utils"

export interface ChipOption<T extends string> {
  value: T
  label: React.ReactNode
}

interface ChipGroupProps<T extends string> {
  options: readonly ChipOption<T>[]
  value: T
  onChange: (value: T) => void
  "aria-label": string
  /** `radio` (default) is a form choice; `tabs` switches between sections of a page. */
  variant?: "radio" | "tabs"
  className?: string
}

/**
 * Row of pill-shaped chips that scrolls horizontally instead of wrapping or
 * overflowing the screen (filters, payment method, page sections). Chips are at
 * least 44px tall on mobile.
 */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  variant = "radio",
  className,
  "aria-label": ariaLabel,
}: ChipGroupProps<T>) {
  const isTabs = variant === "tabs"
  return (
    <div
      role={isTabs ? "tablist" : "radiogroup"}
      aria-label={ariaLabel}
      className={cn(
        "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role={isTabs ? "tab" : "radio"}
            aria-checked={isTabs ? undefined : selected}
            aria-selected={isTabs ? selected : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-[44px] shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9",
              selected
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

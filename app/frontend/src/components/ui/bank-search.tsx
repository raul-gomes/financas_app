import { useEffect, useRef, useState } from "react"
import { Search, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import {
  SettingsService,
  type BrasilApiBank,
  type UserBank,
} from "@/services/settingsService"

interface BankSearchInputProps {
  /** Dispara quando um banco é criado com sucesso (para o pai atualizar a lista/seleção). */
  onBankAdded?: (bank: UserBank) => void
  disabled?: boolean
  className?: string
}

/**
 * Busca de bancos na Brasil API com autocomplete e criação via API.
 *
 * Padrão extraído de `Settings.tsx` (a página de Configurações) para ser
 * reutilizado onde houver "adicionar banco": o usuário digita o nome, um
 * dropdown lista resultados (≥2 caracteres, debounce 300ms) e ao selecionar
 * chama `SettingsService.addBank`, disparando `onBankAdded` com o banco criado.
 */
export function BankSearchInput({ onBankAdded, disabled, className }: BankSearchInputProps) {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<BrasilApiBank[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [addingBank, setAddingBank] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      const results = await SettingsService.searchBrasilApi(searchQuery)
      setSearchResults(results)
      setShowDropdown(results.length > 0)
      setHighlightedIndex(results.length > 0 ? 0 : -1)
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    if (highlightedIndex < 0 || !dropdownRef.current) return
    const items = dropdownRef.current.querySelectorAll("button")
    if (items[highlightedIndex]) {
      items[highlightedIndex].scrollIntoView({ block: "nearest" })
    }
  }, [highlightedIndex])

  const handleSelectBank = async (bank: BrasilApiBank) => {
    setShowDropdown(false)
    setSearchQuery("")
    setAddingBank(true)
    try {
      const newBank = await SettingsService.addBank({
        bank_code: bank.code?.toString() || bank.ispb,
        bank_name: bank.fullName || bank.name,
      })
      onBankAdded?.(newBank)
      toast({ title: "Banco adicionado", description: bank.fullName || bank.name })
    } catch {
      toast({ title: "Erro", description: "Falha ao adicionar banco.", variant: "destructive" })
    } finally {
      setAddingBank(false)
    }
  }

  return (
    <div className={className} ref={rootRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          disabled={disabled}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (!showDropdown || searchResults.length === 0) return

            switch (e.key) {
              case "ArrowDown":
                e.preventDefault()
                setHighlightedIndex((prev) =>
                  prev < searchResults.length - 1 ? prev + 1 : prev
                )
                break
              case "ArrowUp":
                e.preventDefault()
                setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
                break
              case "Enter": {
                e.preventDefault()
                const idx =
                  highlightedIndex >= 0 && highlightedIndex < searchResults.length
                    ? highlightedIndex
                    : 0
                handleSelectBank(searchResults[idx])
                break
              }
              case "Escape":
                e.preventDefault()
                setShowDropdown(false)
                setSearchQuery("")
                break
            }
          }}
          placeholder="Digite o nome do banco... (Enter para adicionar)"
          className="w-full pl-10 pr-4"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            Buscando...
          </span>
        )}

        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden"
          >
            {searchResults.map((bank, idx) => (
              <button
                key={bank.ispb}
                onClick={() => handleSelectBank(bank)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                disabled={addingBank}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border last:border-b-0 disabled:opacity-50 ${
                  idx === highlightedIndex
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                  {bank.code || "--"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {bank.fullName || bank.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Código: {bank.code || "N/A"} · ISPB: {bank.ispb}
                  </div>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
import * as React from "react"
import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { BankLogo } from "@/components/ui/bank-logo"
import { SettingsService, type UserBank } from "@/services/settingsService"

interface BankSelectProps {
  /** Código FEBRABAN selecionado (undefined = sem seleção). */
  value?: string
  onValueChange: (bankCode: string | undefined) => void
  disabled?: boolean
  className?: string
}

/**
 * Select de bancos do usuário com opção "+ Adicionar banco" inline.
 *
 * Extrai o padrão que existia duplicado no formulário de contas recorrentes:
 * lista carregada de `SettingsService.listBanks()`, item especial `+add` que
 * revela um mini-formulário (código + nome) e cria via `SettingsService.addBank`,
 * já selecionando o banco criado ao final.
 */
export function BankSelect({ value, onValueChange, disabled, className }: BankSelectProps) {
  const { toast } = useToast()
  const [banks, setBanks] = useState<UserBank[]>([])
  const [addingNewBank, setAddingNewBank] = useState(false)
  const [newBankCode, setNewBankCode] = useState("")
  const [newBankName, setNewBankName] = useState("")

  useEffect(() => {
    let active = true
    SettingsService.listBanks().then((list) => {
      if (active) setBanks(list)
    }).catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const handleAddBank = async () => {
    if (!newBankCode.trim() || !newBankName.trim()) {
      toast({ title: "Erro", description: "Preencha código e nome do banco.", variant: "destructive" })
      return
    }
    try {
      const created = await SettingsService.addBank({
        bank_code: newBankCode.trim(),
        bank_name: newBankName.trim(),
      })
      setBanks((prev) => [...prev, created])
      onValueChange(created.bank_code)
      setNewBankCode("")
      setNewBankName("")
      setAddingNewBank(false)
      toast({ title: "Banco adicionado", description: `${created.bank_name} (${created.bank_code})` })
    } catch {
      toast({ title: "Erro", description: "Falha ao adicionar banco.", variant: "destructive" })
    }
  }

  return (
    <div className={className}>
      <Select
        disabled={disabled}
        value={addingNewBank ? "+add" : value}
        onValueChange={(v) => {
          if (v === "+add") {
            setAddingNewBank(true)
          } else {
            setAddingNewBank(false)
            onValueChange(v)
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione um banco" />
        </SelectTrigger>
        <SelectContent>
          {banks.map((bank) => (
            <SelectItem key={bank.id} value={bank.bank_code}>
              <div className="flex items-center gap-2">
                <BankLogo code={bank.bank_code} size="sm" />
                <span>{bank.bank_name}</span>
                <span className="text-muted-foreground text-xs">({bank.bank_code})</span>
              </div>
            </SelectItem>
          ))}
          <SelectItem value="+add">
            <div className="flex items-center gap-2 text-primary font-medium">
              <Plus className="w-4 h-4" />
              <span>Add new bank</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      {addingNewBank && (
        <div className="mt-2 flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Código</Label>
            <Input placeholder="Ex: 260" value={newBankCode} onChange={(e) => setNewBankCode(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input placeholder="Ex: Nubank" value={newBankName} onChange={(e) => setNewBankName(e.target.value)} className="h-8 text-sm" />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setAddingNewBank(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleAddBank}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      )}
    </div>
  )
}

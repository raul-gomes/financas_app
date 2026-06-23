import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Upload, FileText, CheckCircle, AlertCircle, X, Plus, Banknote, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ExtractoService } from '@/services/extractoService'
import { FinancialService } from '@/services/financialService'
import { SettingsService } from '@/services/settingsService'
import { SessionData, ParsedTransaction, ConfirmTransaction } from '@/types/extracto'
import { CategorySubcategories } from '@/types/financial'
import { UserBank, BankCreate } from '@/types/settingsService'

const BANK_LOGO_CDN = 'https://cdn.jsdelivr.net/gh/wesguirra/brazil-bank-data@main/bank-logos/256/png';

const KNOWN_PAYMENT_METHODS = ['dinheiro', 'pix', 'debito', 'credito', 'transferencia', 'boleto'];

interface ExtratoDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onImported: () => void
}

export function ExtratoDialog({ open, onOpenChange, onImported }: ExtratoDialogProps) {
    const [sessions, setSessions] = useState<SessionData[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const [isConfirming, setIsConfirming] = useState(false)
    const [uploadProgress, setUploadProgress] = useState('')
    const [banks, setBanks] = useState<UserBank[]>([])
    const [categoryOptions, setCategoryOptions] = useState<CategorySubcategories | null>(null)
    const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set())

    // Inline "add bank" state
    const [addingBankSessionIdx, setAddingBankSessionIdx] = useState<number | null>(null)
    const [newBankCode, setNewBankCode] = useState('')
    const [newBankName, setNewBankName] = useState('')

    // Per-row "Outros" state
    const [showNewCategoria, setShowNewCategoria] = useState<Record<string, boolean>>({})
    const [newCategoriaNome, setNewCategoriaNome] = useState<Record<string, string>>({})
    const [showNewSubcategoria, setShowNewSubcategoria] = useState<Record<string, boolean>>({})
    const [newSubcategoriaNome, setNewSubcategoriaNome] = useState<Record<string, string>>({})
    const [showNewFormaPagamento, setShowNewFormaPagamento] = useState<Record<string, boolean>>({})
    const [newFormaPagamentoNome, setNewFormaPagamentoNome] = useState<Record<string, string>>({})
    const [parceladoMap, setParceladoMap] = useState<Record<string, boolean>>({})
    const [totalParcelasMap, setTotalParcelasMap] = useState<Record<string, number>>({})

    const { toast } = useToast()

    const rowKey = (sIdx: number, rIdx: number) => `${sIdx}-${rIdx}`

    useEffect(() => {
        if (open) {
            FinancialService.getCategorySubcategories('all').then(setCategoryOptions).catch(() => {})
            SettingsService.listBanks().then(setBanks).catch(() => {})
        }
    }, [open])

    // ---- Upload ----
    const handleFileSelect = async (selectedFiles: FileList | File[]) => {
        const fileArray = Array.from(selectedFiles)
        if (fileArray.length === 0) return
        setIsUploading(true)
        try {
            setUploadProgress(`Processando ${fileArray.length} arquivo${fileArray.length > 1 ? 's' : ''}...`)
            const result = await ExtractoService.uploadMultiple(fileArray)
            setSessions(result)
        } catch {
            toast({ title: 'Erro', description: 'Falha ao processar o extrato. Verifique o formato do arquivo.', variant: 'destructive' })
        } finally {
            setIsUploading(false)
            setUploadProgress('')
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const droppedFiles = e.dataTransfer.files
        if (droppedFiles.length > 0) handleFileSelect(droppedFiles)
    }

    // ---- Session helpers ----
    const updateSession = (sIdx: number, updates: Partial<SessionData>) => {
        setSessions(prev => prev.map((s, i) => i === sIdx ? { ...s, ...updates } : s))
    }

    const updateTransaction = (sIdx: number, rIdx: number, updates: Partial<ParsedTransaction>) => {
        setSessions(prev => prev.map((s, i) =>
            i === sIdx ? {
                ...s,
                transactions: s.transactions.map((t, j) => j === rIdx ? { ...t, ...updates } : t)
            } : s
        ))
    }

    // ---- Row edit handlers ----
    const handleFormaPagamentoChange = (sIdx: number, rIdx: number, value: string) => {
        const key = rowKey(sIdx, rIdx)
        if (value === 'outros') {
            setShowNewFormaPagamento(prev => ({ ...prev, [key]: true }))
            updateTransaction(sIdx, rIdx, { forma_pagamento: '' })
        } else {
            setShowNewFormaPagamento(prev => ({ ...prev, [key]: false }))
            setNewFormaPagamentoNome(prev => ({ ...prev, [key]: '' }))
            updateTransaction(sIdx, rIdx, { forma_pagamento: value })
        }
    }

    const handleCategoriaChange = (sIdx: number, rIdx: number, value: string) => {
        const key = rowKey(sIdx, rIdx)
        if (value === 'outros') {
            setShowNewCategoria(prev => ({ ...prev, [key]: true }))
            updateTransaction(sIdx, rIdx, { categoria_id: undefined, subcategoria_id: undefined })
        } else {
            const catId = parseInt(value)
            setShowNewCategoria(prev => ({ ...prev, [key]: false }))
            setNewCategoriaNome(prev => ({ ...prev, [key]: '' }))
            // Auto-select first subcategory
            const catObj = categoryOptions?.opcoes.find(c => c.id === catId)
            const firstSub = catObj?.subcategorias[0]
            updateTransaction(sIdx, rIdx, {
                categoria_id: catId,
                subcategoria_id: firstSub?.id,
            })
        }
    }

    const handleSubcategoriaChange = (sIdx: number, rIdx: number, value: string) => {
        const key = rowKey(sIdx, rIdx)
        if (value === 'outros') {
            setShowNewSubcategoria(prev => ({ ...prev, [key]: true }))
            updateTransaction(sIdx, rIdx, { subcategoria_id: undefined })
        } else {
            setShowNewSubcategoria(prev => ({ ...prev, [key]: false }))
            setNewSubcategoriaNome(prev => ({ ...prev, [key]: '' }))
            updateTransaction(sIdx, rIdx, { subcategoria_id: parseInt(value) })
        }
    }

    const handleNaturezaChange = (sIdx: number, rIdx: number, natureza: string) => {
        updateTransaction(sIdx, rIdx, { natureza })
    }

    // ---- Bank ----
    const handleBankSelect = (sIdx: number, value: string) => {
        if (value === '+add') {
            setAddingBankSessionIdx(sIdx)
            setNewBankCode('')
            setNewBankName('')
        } else {
            updateSession(sIdx, { bankCode: value })
            setAddingBankSessionIdx(null)
        }
    }

    const handleAddBank = async (sIdx: number) => {
        if (!newBankCode.trim() || !newBankName.trim()) {
            toast({ title: 'Erro', description: 'Preencha código e nome do banco.', variant: 'destructive' })
            return
        }
        try {
            const payload: BankCreate = { bank_code: newBankCode.trim(), bank_name: newBankName.trim() }
            const created = await SettingsService.addBank(payload)
            setBanks(prev => [...prev, created])
            updateSession(sIdx, { bankCode: created.bank_code })
            setAddingBankSessionIdx(null)
            setNewBankCode('')
            setNewBankName('')
            toast({ title: 'Banco adicionado', description: `${created.bank_name} (${created.bank_code})` })
        } catch {
            toast({ title: 'Erro', description: 'Falha ao adicionar banco.', variant: 'destructive' })
        }
    }

    const cancelAddBank = () => {
        setAddingBankSessionIdx(null)
        setNewBankCode('')
        setNewBankName('')
    }

    const selectedBank = (sIdx: number) => banks.find(b => b.bank_code === sessions[sIdx]?.bankCode)

    // ---- Confirm ----
    const buildConfirmPayload = (session: SessionData): ConfirmTransaction[] => {
        return session.transactions.map((t, rIdx) => {
            const key = rowKey(sessions.indexOf(session), rIdx)
            const base: ConfirmTransaction = {
                data: t.data,
                descricao: t.descricao,
                valor: t.valor,
                tipo: t.tipo,
                forma_pagamento: showNewFormaPagamento[key] ? newFormaPagamentoNome[key] : t.forma_pagamento,
                natureza: t.natureza,
                bank_code: session.bankCode || undefined,
            }

            if (showNewCategoria[key]) {
                base.categoria_nome = newCategoriaNome[key]
            } else {
                base.categoria_id = t.categoria_id!
            }

            if (showNewSubcategoria[key]) {
                base.subcategoria_nome = newSubcategoriaNome[key]
            } else {
                base.subcategoria_id = t.subcategoria_id
            }

            // Parcelamento
            if (parceladoMap[key]) {
                base.total_parcelas = totalParcelasMap[key] || 2
            }

            return base
        })
    }

    const validateSession = (session: SessionData, sIdx: number): string | null => {
        if (!session.bankCode) return 'Selecione um banco para esta sessão.'

        for (let i = 0; i < session.transactions.length; i++) {
            const t = session.transactions[i]
            const key = rowKey(sIdx, i)

            const hasCategoria = showNewCategoria[key]
                ? newCategoriaNome[key]?.trim()
                : t.categoria_id

            const hasDescricao = t.descricao?.trim()
            const hasValor = t.valor > 0
            const hasFormaPagamento = showNewFormaPagamento[key]
                ? newFormaPagamentoNome[key]?.trim()
                : t.forma_pagamento

            if (!hasDescricao) return `Transação #${i + 1}: descrição vazia.`
            if (!hasValor) return `Transação #${i + 1}: valor inválido.`
            if (!hasCategoria) return `Transação #${i + 1}: categoria não atribuída.`
            if (!hasFormaPagamento) return `Transação #${i + 1}: forma de pagamento não preenchida.`
        }
        return null
    }

    const confirmSession = async (sIdx: number) => {
        const session = sessions[sIdx]
        const error = validateSession(session, sIdx)
        if (error) {
            toast({ title: 'Validação', description: error, variant: 'destructive' })
            return
        }

        setIsConfirming(true)
        try {
            const payload = { transacoes: buildConfirmPayload(session) }
            const result = await ExtractoService.confirm(payload)
            updateSession(sIdx, { isConfirmed: true })
            toast({ title: 'Sucesso', description: `${result.criadas} transações importadas de "${session.filename}"!` })

            // Check if all sessions are confirmed
            const updated = sessions.map((s, i) => i === sIdx ? { ...s, isConfirmed: true } : s)
            const allDone = updated.every(s => s.isConfirmed)
            if (allDone) {
                setTimeout(() => {
                    setSessions([])
                    onImported()
                    onOpenChange(false)
                }, 1000)
            }
        } catch {
            toast({ title: 'Erro', description: `Falha ao confirmar sessão "${session.filename}".`, variant: 'destructive' })
        } finally {
            setIsConfirming(false)
        }
    }

    const confirmAll = async () => {
        for (let i = 0; i < sessions.length; i++) {
            const s = sessions[i]
            if (s.isConfirmed) continue

            const error = validateSession(s, i)
            if (error) {
                toast({ title: `Validação em "${s.filename}"`, description: error, variant: 'destructive' })
                return
            }
        }

        setIsConfirming(true)
        let allOk = true
        for (let i = 0; i < sessions.length; i++) {
            if (sessions[i].isConfirmed) continue
            try {
                const payload = { transacoes: buildConfirmPayload(sessions[i]) }
                await ExtractoService.confirm(payload)
                updateSession(i, { isConfirmed: true })
            } catch {
                toast({ title: 'Erro', description: `Falha ao confirmar "${sessions[i].filename}". As anteriores foram salvas.`, variant: 'destructive' })
                allOk = false
                break
            }
        }
        setIsConfirming(false)

        if (allOk) {
            toast({ title: 'Sucesso', description: 'Todas as sessões foram importadas!' })
            setTimeout(() => {
                setSessions([])
                onImported()
                onOpenChange(false)
            }, 500)
        }
    }

    const handleCancel = () => {
        setSessions([])
        setAddingBankSessionIdx(null)
        setShowNewCategoria({})
        setNewCategoriaNome({})
        setShowNewSubcategoria({})
        setNewSubcategoriaNome({})
        setShowNewFormaPagamento({})
        setNewFormaPagamentoNome({})
        setParceladoMap({})
        setTotalParcelasMap({})
        onOpenChange(false)
    }

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

    const totals = sessions.reduce((acc, s) => ({
        total: acc.total + s.transactions.length,
        entradas: acc.entradas + s.transactions.filter(t => t.tipo === 'entrada').length,
        saidas: acc.saidas + s.transactions.filter(t => t.tipo === 'saida').length,
        totalEntradas: acc.totalEntradas + s.transactions.filter(t => t.tipo === 'entrada').reduce((sum, t) => sum + t.valor, 0),
        totalSaidas: acc.totalSaidas + s.transactions.filter(t => t.tipo === 'saida').reduce((sum, t) => sum + t.valor, 0),
    }), { total: 0, entradas: 0, saidas: 0, totalEntradas: 0, totalSaidas: 0 })

    const allConfirmed = sessions.length > 0 && sessions.every(s => s.isConfirmed)
    const pendingCount = sessions.filter(s => !s.isConfirmed).length

    // ============================================================
    // RENDER
    // ============================================================
    if (sessions.length === 0) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Importar Extrato Bancário</DialogTitle>
                    </DialogHeader>
                    <div
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer"
                        onClick={() => document.getElementById('file-input-extrato')?.click()}
                    >
                        <input
                            id="file-input-extrato"
                            type="file"
                            accept=".csv,.ofx,.qfx"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                                const selected = e.target.files
                                if (selected && selected.length > 0) handleFileSelect(selected)
                            }}
                        />
                        {isUploading ? (
                            <div className="flex flex-col items-center gap-4">
                                <FileText className="w-12 h-12 text-muted-foreground animate-pulse" />
                                <p className="text-lg text-muted-foreground">{uploadProgress || 'Processando extrato...'}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <Upload className="w-12 h-12 text-muted-foreground" />
                                <p className="text-lg text-muted-foreground">Arraste os arquivos aqui ou clique para selecionar</p>
                                <p className="text-sm text-muted-foreground">Formatos aceitos: CSV, OFX, QFX (múltiplos arquivos)</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onOpenChange={(open) => { if (!open) handleCancel() }}>
            <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
                <DialogHeader className="shrink-0">
                    <div className="flex justify-between items-center">
                        <div>
                            <DialogTitle>Revisar Extrato</DialogTitle>
                            <p className="text-muted-foreground text-sm mt-1">
                                {sessions.length} arquivo{sessions.length > 1 ? 's' : ''} — {totals.total} transações
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" size="sm" onClick={handleCancel}>
                                <X className="w-4 h-4 mr-2" />Cancelar
                            </Button>
                            {pendingCount > 0 && (
                                <Button
                                    onClick={confirmAll}
                                    disabled={isConfirming || allConfirmed}
                                    size="sm"
                                    className="bg-gradient-primary"
                                >
                                    {isConfirming ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                    )}
                                    {isConfirming ? 'Importando...' : `Confirmar Todas (${pendingCount})`}
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                {/* Summary cards */}
                <div className="grid grid-cols-4 gap-4 shrink-0">
                    <div className="bg-card rounded-lg p-4 border border-border">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="text-2xl font-bold">{totals.total}</p>
                    </div>
                    <div className="bg-card rounded-lg p-4 border border-border">
                        <p className="text-sm text-muted-foreground">Entradas</p>
                        <p className="text-2xl font-bold text-green-600">{totals.entradas}</p>
                    </div>
                    <div className="bg-card rounded-lg p-4 border border-border">
                        <p className="text-sm text-muted-foreground">Saídas</p>
                        <p className="text-2xl font-bold text-red-600">{totals.saidas}</p>
                    </div>
                    <div className="bg-card rounded-lg p-4 border border-border">
                        <p className="text-sm text-green-600">Total Entradas</p>
                        <p className="text-lg font-bold text-green-600">{formatCurrency(totals.totalEntradas)}</p>
                        <p className="text-sm text-red-600">Total Saídas</p>
                        <p className="text-lg font-bold text-red-600">{formatCurrency(totals.totalSaidas)}</p>
                    </div>
                </div>

                {/* Sessions */}
                <div className="mt-4 flex-1 overflow-y-auto space-y-4">
                    {sessions.map((session, sIdx) => {
                        const bank = selectedBank(sIdx)
                        const hasBank = !!session.bankCode
                        const isPending = !session.isConfirmed

                        return (
                            <div
                                key={sIdx}
                                className={`rounded-lg border-2 overflow-hidden transition-colors ${
                                    session.isConfirmed
                                        ? 'border-green-500 opacity-80'
                                        : hasBank
                                        ? 'border-amber-500'
                                        : 'border-amber-500'
                                }`}
                            >
                                {/* Session Header */}
                                <div className={`px-4 py-3 flex items-center gap-3 flex-wrap ${
                                    session.isConfirmed ? 'bg-green-50' : 'bg-amber-50'
                                }`}>
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <FileText className="w-5 h-5 shrink-0 text-muted-foreground" />
                                        <span className="font-semibold text-sm truncate">{session.filename}</span>
                                        {session.isConfirmed && (
                                            <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full shrink-0">
                                                Confirmado ✓
                                            </span>
                                        )}
                                        <span className="text-xs text-muted-foreground shrink-0">
                                            {session.transactions.length} transação{session.transactions.length > 1 ? 'ões' : ''}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs text-muted-foreground">Banco:</span>
                                        <Select
                                            value={session.bankCode}
                                            onValueChange={(v) => handleBankSelect(sIdx, v)}
                                            disabled={session.isConfirmed}
                                        >
                                            <SelectTrigger className={`h-8 text-xs min-w-[180px] ${!hasBank && isPending ? 'border-amber-400 border-2' : ''}`}>
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {banks.map((b) => (
                                                    <SelectItem key={b.id} value={b.bank_code}>
                                                        <div className="flex items-center gap-2">
                                                            {!logoErrors.has(b.bank_code) ? (
                                                                <img
                                                                    src={`${BANK_LOGO_CDN}/${b.bank_code.padStart(3, '0')}.png`}
                                                                    alt=""
                                                                    className="w-4 h-4 rounded object-contain bg-card"
                                                                    onError={() => setLogoErrors((prev) => new Set(prev).add(b.bank_code))}
                                                                />
                                                            ) : (
                                                                <div className="w-4 h-4 rounded bg-primary/10 text-primary font-bold text-[6px] flex items-center justify-center">
                                                                    {b.bank_code}
                                                                </div>
                                                            )}
                                                            <span>{b.bank_name} ({b.bank_code})</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                                <SelectItem value="+add">
                                                    <div className="flex items-center gap-2 text-primary font-medium">
                                                        <Plus className="w-4 h-4" />
                                                        <span>Adicionar novo banco</span>
                                                    </div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>

                                        {isPending && (
                                            <Button
                                                size="sm"
                                                disabled={!hasBank || isConfirming}
                                                onClick={() => confirmSession(sIdx)}
                                                className={hasBank ? 'bg-amber-500 hover:bg-amber-600' : ''}
                                            >
                                                {isConfirming ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <CheckCircle className="w-4 h-4" />
                                                )}
                                                <span className="ml-1">Confirmar</span>
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Inline Add Bank */}
                                {addingBankSessionIdx === sIdx && (
                                    <div className="px-4 py-3 bg-white border-b border-border">
                                        <div className="flex items-end gap-3 max-w-lg">
                                            <div className="flex-1 space-y-1">
                                                <Label className="text-xs">Código</Label>
                                                <Input
                                                    placeholder="Ex: 260"
                                                    value={newBankCode}
                                                    onChange={e => setNewBankCode(e.target.value)}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <Label className="text-xs">Nome</Label>
                                                <Input
                                                    placeholder="Ex: Nubank"
                                                    value={newBankName}
                                                    onChange={e => setNewBankName(e.target.value)}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <Button size="sm" variant="outline" onClick={cancelAddBank}>
                                                Cancelar
                                            </Button>
                                            <Button size="sm" onClick={() => handleAddBank(sIdx)}>
                                                <Plus className="w-4 h-4 mr-1" /> Adicionar
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Session Table */}
                                {!session.isConfirmed && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50 border-b border-border">
                                                <tr>
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Data</th>
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Descrição</th>
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Valor</th>
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Tipo</th>
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Parcelas</th>
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Forma Pagto</th>
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Nat.</th>
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Categoria</th>
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Subcategoria</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {session.transactions.map((trans, rIdx) => {
                                                    const key = rowKey(sIdx, rIdx)
                                                    const catObj = categoryOptions?.opcoes.find(c => c.id === trans.categoria_id)
                                                    const subs = catObj?.subcategorias || []
                                                    const filteredCats = categoryOptions?.opcoes.filter(
                                                        c => !trans.tipo || !c.tipo || c.tipo === trans.tipo
                                                    ) || []

                                                    return (
                                                        <tr key={rIdx} className="hover:bg-muted/30">
                                                            <td className="px-3 py-2 text-xs whitespace-nowrap">{trans.data}</td>
                                                            <td className="px-3 py-2 min-w-[140px]">
                                                                <input
                                                                    type="text"
                                                                    value={trans.descricao}
                                                                    onChange={(e) => updateTransaction(sIdx, rIdx, { descricao: e.target.value })}
                                                                    className="w-full text-xs bg-transparent border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                                                                />
                                                            </td>
                                                            <td className={`px-3 py-2 text-xs font-medium whitespace-nowrap ${
                                                                trans.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'
                                                            }`}>
                                                                {trans.tipo === 'saida' ? '-' : ''}{formatCurrency(trans.valor)}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                                                    trans.tipo === 'entrada'
                                                                        ? 'bg-green-100 text-green-700'
                                                                        : 'bg-red-100 text-red-700'
                                                                }`}>
                                                                    {trans.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 whitespace-nowrap">
                                                                <div className="flex items-center gap-1">
                                                                    <Switch
                                                                        id={`parcelado-${key}`}
                                                                        checked={parceladoMap[key] || false}
                                                                        onCheckedChange={(checked) => {
                                                                            setParceladoMap(prev => ({ ...prev, [key]: checked }))
                                                                            if (checked && !totalParcelasMap[key]) {
                                                                                setTotalParcelasMap(prev => ({ ...prev, [key]: 2 }))
                                                                            }
                                                                        }}
                                                                        className="scale-75"
                                                                    />
                                                                    {parceladoMap[key] && (
                                                                        <Input
                                                                            type="number"
                                                                            min="2"
                                                                            value={totalParcelasMap[key] || 2}
                                                                            onChange={e => setTotalParcelasMap(prev => ({ ...prev, [key]: parseInt(e.target.value) || 2 }))}
                                                                            className="h-7 w-14 text-xs"
                                                                        />
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2 min-w-[120px]">
                                                                <Select
                                                                    value={showNewFormaPagamento[key] ? 'outros' : trans.forma_pagamento}
                                                                    onValueChange={(v) => handleFormaPagamentoChange(sIdx, rIdx, v)}
                                                                >
                                                                    <SelectTrigger className="h-7 text-xs">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                                                        <SelectItem value="pix">PIX</SelectItem>
                                                                        <SelectItem value="debito">Débito</SelectItem>
                                                                        <SelectItem value="credito">Crédito</SelectItem>
                                                                        <SelectItem value="transferencia">Transferência</SelectItem>
                                                                        <SelectItem value="boleto">Boleto</SelectItem>
                                                                        <SelectItem value="outros">Outros...</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                {showNewFormaPagamento[key] && (
                                                                    <Input
                                                                        placeholder="Nova forma de pagamento"
                                                                        value={newFormaPagamentoNome[key] || ''}
                                                                        onChange={e => {
                                                                            setNewFormaPagamentoNome(prev => ({ ...prev, [key]: e.target.value }))
                                                                            updateTransaction(sIdx, rIdx, { forma_pagamento: e.target.value })
                                                                        }}
                                                                        className="h-7 text-xs mt-1"
                                                                    />
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <div className="flex items-center gap-1">
                                                                    <span className={`text-[10px] font-medium ${trans.natureza === 'pj' ? 'text-muted-foreground' : 'text-foreground'}`}>PF</span>
                                                                    <Switch
                                                                        checked={trans.natureza === 'pj'}
                                                                        onCheckedChange={(checked) => handleNaturezaChange(sIdx, rIdx, checked ? 'pj' : 'pf')}
                                                                        className="scale-75"
                                                                    />
                                                                    <span className={`text-[10px] font-medium ${trans.natureza === 'pj' ? 'text-foreground' : 'text-muted-foreground'}`}>PJ</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2 min-w-[130px]">
                                                                <Select
                                                                    value={showNewCategoria[key] ? 'outros' : (trans.categoria_id ? String(trans.categoria_id) : '')}
                                                                    onValueChange={(v) => handleCategoriaChange(sIdx, rIdx, v)}
                                                                >
                                                                    <SelectTrigger className="h-7 text-xs">
                                                                        <SelectValue placeholder="Selecione..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {filteredCats.map(cat => (
                                                                            <SelectItem key={cat.id} value={String(cat.id)}>
                                                                                {cat.categoria}
                                                                            </SelectItem>
                                                                        ))}
                                                                        <SelectItem value="outros">Outros...</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                {showNewCategoria[key] && (
                                                                    <Input
                                                                        placeholder="Nova categoria"
                                                                        value={newCategoriaNome[key] || ''}
                                                                        onChange={e => {
                                                                            setNewCategoriaNome(prev => ({ ...prev, [key]: e.target.value }))
                                                                            updateTransaction(sIdx, rIdx, { categoria_id: undefined })
                                                                        }}
                                                                        className="h-7 text-xs mt-1"
                                                                    />
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 min-w-[130px]">
                                                                {catObj ? (
                                                                    <>
                                                                        <Select
                                                                            value={showNewSubcategoria[key] ? 'outros' : (trans.subcategoria_id ? String(trans.subcategoria_id) : '')}
                                                                            onValueChange={(v) => handleSubcategoriaChange(sIdx, rIdx, v)}
                                                                        >
                                                                            <SelectTrigger className="h-7 text-xs">
                                                                                <SelectValue placeholder="Selecione..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {subs.map(sub => (
                                                                                    <SelectItem key={sub.id} value={String(sub.id)}>
                                                                                        {sub.nome}
                                                                                    </SelectItem>
                                                                                ))}
                                                                                <SelectItem value="outros">Outros...</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                        {showNewSubcategoria[key] && (
                                                                            <Input
                                                                                placeholder="Nova subcategoria"
                                                                                value={newSubcategoriaNome[key] || ''}
                                                                                onChange={e => {
                                                                                    setNewSubcategoriaNome(prev => ({ ...prev, [key]: e.target.value }))
                                                                                    updateTransaction(sIdx, rIdx, { subcategoria_id: undefined })
                                                                                }}
                                                                                className="h-7 text-xs mt-1"
                                                                            />
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <span className="text-xs text-muted-foreground">-</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Session validation warnings */}
                                {isPending && session.transactions.some(t => !t.categoria_id) && (
                                    <div className="px-4 py-2 flex items-center gap-2 text-amber-600 bg-amber-50/50 border-t border-border">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <span className="text-xs">
                                            {session.transactions.filter(t => !t.categoria_id).length} transação(ões) sem categoria
                                        </span>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </DialogContent>
        </Dialog>
    )
}

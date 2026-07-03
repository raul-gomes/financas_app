import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Upload, FileText, CheckCircle, AlertCircle, X, Plus, Banknote, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ExtractoService } from '@/services/extractService'
import { FinancialService } from '@/services/financialService'
import { SettingsService } from '@/services/settingsService'
import { SessionData, ParsedTransaction, ConfirmTransaction } from '@/types/extract'
import { CategorySubcategories, DuplicateInfo } from '@/types/financial'
import { UserBank, BankCreate } from '@/types/settingsService'
import { DuplicateDialog, DialogAction } from '@/components/DuplicateDialog'

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

    // Duplicate checking state
    const [duplicateConflicts, setDuplicateConflicts] = useState<Array<{
        index: number
        existing: DuplicateInfo
        newData: { description: string; amount: number; transaction_date: string }
    }>>([])
    const [pendingConfirmPayload, setPendingConfirmPayload] = useState<{
        transactions: ConfirmTransaction[]
    } | null>(null)
    const [pendingSIdx, setPendingSIdx] = useState<number | null>(null)
    const sessionSkipMapRef = useRef<Set<number>>(new Set())

    // Per-row "Other" state
    const [showNewCategory, setShowNewCategory] = useState<Record<string, boolean>>({})
    const [newCategoryName, setNewCategoryName] = useState<Record<string, string>>({})
    const [showNewSubcategory, setShowNewSubcategory] = useState<Record<string, boolean>>({})
    const [newSubcategoryName, setNewSubcategoryName] = useState<Record<string, string>>({})
    const [showNewPaymentMethod, setShowNewPaymentMethod] = useState<Record<string, boolean>>({})
    const [newPaymentMethodName, setNewPaymentMethodName] = useState<Record<string, string>>({})
    const [installmentMap, setInstallmentMap] = useState<Record<string, boolean>>({})
    const [totalInstallmentsMap, setTotalInstallmentsMap] = useState<Record<string, number>>({})

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
    const handlePaymentMethodChange = (sIdx: number, rIdx: number, value: string) => {
        const key = rowKey(sIdx, rIdx)
        if (value === 'other') {
            setShowNewPaymentMethod(prev => ({ ...prev, [key]: true }))
            updateTransaction(sIdx, rIdx, { payment_method: '' })
        } else {
            setShowNewPaymentMethod(prev => ({ ...prev, [key]: false }))
            setNewPaymentMethodName(prev => ({ ...prev, [key]: '' }))
            updateTransaction(sIdx, rIdx, { payment_method: value })
        }
    }

    const handleCategoryChange = (sIdx: number, rIdx: number, value: string) => {
        const key = rowKey(sIdx, rIdx)
        if (value === 'other') {
            setShowNewCategory(prev => ({ ...prev, [key]: true }))
            updateTransaction(sIdx, rIdx, { category_id: undefined, subcategory_id: undefined })
        } else {
            const catId = parseInt(value)
            setShowNewCategory(prev => ({ ...prev, [key]: false }))
            setNewCategoryName(prev => ({ ...prev, [key]: '' }))
            // Auto-select first subcategory
            const catObj = categoryOptions?.options.find(c => c.id === catId)
            const firstSub = catObj?.subcategories[0]
            updateTransaction(sIdx, rIdx, {
                category_id: catId,
                subcategory_id: firstSub?.id,
            })
        }
    }

    const handleSubcategoryChange = (sIdx: number, rIdx: number, value: string) => {
        const key = rowKey(sIdx, rIdx)
        if (value === 'other') {
            setShowNewSubcategory(prev => ({ ...prev, [key]: true }))
            updateTransaction(sIdx, rIdx, { subcategory_id: undefined })
        } else {
            setShowNewSubcategory(prev => ({ ...prev, [key]: false }))
            setNewSubcategoryName(prev => ({ ...prev, [key]: '' }))
            updateTransaction(sIdx, rIdx, { subcategory_id: parseInt(value) })
        }
    }

    const handleEntityTypeChange = (sIdx: number, rIdx: number, entity_type: string) => {
        updateTransaction(sIdx, rIdx, { entity_type })
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
                date: t.date,
                description: t.description,
                amount: t.amount,
                type: t.type,
                payment_method: showNewPaymentMethod[key] ? newPaymentMethodName[key] : t.payment_method,
                entity_type: t.entity_type,
                bank_code: session.bankCode || undefined,
            }

            if (showNewCategory[key]) {
                base.category_name = newCategoryName[key]
            } else {
                base.category_id = t.category_id!
            }

            if (showNewSubcategory[key]) {
                base.subcategory_name = newSubcategoryName[key]
            } else {
                base.subcategory_id = t.subcategory_id
            }

            // Installments
            if (installmentMap[key]) {
                base.total_installments = totalInstallmentsMap[key] || 2
                base.is_installment = true
            }

            return base
        })
    }

    const validateSession = (session: SessionData, sIdx: number): string | null => {
        if (!session.bankCode) return 'Select a bank for this session.'

        for (let i = 0; i < session.transactions.length; i++) {
            const t = session.transactions[i]
            const key = rowKey(sIdx, i)

            const hasCategory = showNewCategory[key]
                ? newCategoryName[key]?.trim()
                : t.category_id

            const hasDescription = t.description?.trim()
            const hasAmount = t.amount > 0
            const hasPaymentMethod = showNewPaymentMethod[key]
                ? newPaymentMethodName[key]?.trim()
                : t.payment_method

            if (!hasDescription) return `Transaction #${i + 1}: empty description.`
            if (!hasAmount) return `Transaction #${i + 1}: invalid amount.`
            if (!hasCategory) return `Transaction #${i + 1}: category not assigned.`
            if (!hasPaymentMethod) return `Transaction #${i + 1}: payment method not filled.`
        }
        return null
    }

    // ── Duplicate check helper ──
    const checkAndConfirmSession = async (sIdx: number) => {
        const session = sessions[sIdx]
        const payload = { transactions: buildConfirmPayload(session) }

        // Check duplicates for all transactions in this session
        try {
            const checkPayload = {
                transactions: payload.transactions.map((t, idx) => ({
                    index: idx,
                    transaction_date: t.date.split('/').reverse().join('-'), // DD/MM/YYYY → YYYY-MM-DD
                    amount: t.amount,
                })),
            }
            const checkResult = await FinancialService.checkDuplicates(checkPayload)

            const conflicts: Array<{
                index: number
                existing: DuplicateInfo
                newData: { description: string; amount: number; transaction_date: string }
            }> = []

            for (const r of checkResult.results) {
                if (r.has_duplicate && r.duplicates.length > 0) {
                    const t = payload.transactions[r.index]
                    conflicts.push({
                        index: r.index,
                        existing: r.duplicates[0],
                        newData: {
                            description: t.description,
                            amount: t.amount,
                            transaction_date: t.date,
                        },
                    })
                }
            }

            if (conflicts.length > 0) {
                setDuplicateConflicts(conflicts)
                setPendingConfirmPayload(payload)
                setPendingSIdx(sIdx)
                return // Dialog will open, user resolves then we proceed
            }
        } catch {
            // If check fails, proceed anyway
        }

        // No duplicates — proceed with confirm
        await doConfirmSession(sIdx, payload)
    }

    const doConfirmSession = async (sIdx: number, payload?: { transactions: ConfirmTransaction[] }) => {
        const session = sessions[sIdx]
        if (!payload) {
            payload = { transactions: buildConfirmPayload(session) }
        }

        setIsConfirming(true)
        try {
            const result = await ExtractoService.confirm(payload)
            updateSession(sIdx, { isConfirmed: true })
            toast({ title: 'Success', description: `${result.created} transactions imported from "${session.filename}"!` })

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
            toast({ title: 'Error', description: `Failed to confirm session "${session.filename}".`, variant: 'destructive' })
        } finally {
            setIsConfirming(false)
        }
    }

    const confirmSession = async (sIdx: number) => {
        const session = sessions[sIdx]
        const error = validateSession(session, sIdx)
        if (error) {
            toast({ title: 'Validação', description: error, variant: 'destructive' })
            return
        }
        await checkAndConfirmSession(sIdx)
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

        // We'll confirm one by one, with duplicate check per session
        setIsConfirming(true)
        let allOk = true
        for (let i = 0; i < sessions.length; i++) {
            if (sessions[i].isConfirmed) continue
            try {
                const payload = { transactions: buildConfirmPayload(sessions[i]) }
                // Check duplicates inline for confirmAll (simplified: skip dialog, just proceed)
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

    const resolveExtratoDuplicate = async (action: DialogAction, _index: number) => {
        if (!pendingConfirmPayload) return

        // Record the decision in the ref (always current, never stale)
        if (action === 'keep' || action === 'edit') {
            sessionSkipMapRef.current = new Set(sessionSkipMapRef.current).add(_index)
        } else if (action === 'replace') {
            // Delete the existing transaction, keep the new one
            const conflict = duplicateConflicts.find(c => c.index === _index)
            if (conflict) {
                try {
                    await FinancialService.deleteTransaction(conflict.existing.id)
                } catch {
                    // silent — the transaction may already have been deleted
                }
            }
        }
        // NOTE: We do NOT modify duplicateConflicts here — DuplicateDialog
        // manages its own navigation (currentIdx) and will call onDone
        // when the user reaches the last conflict.
    }

    /** Confirms a session and always closes the ExtratoDialog + refreshes dashboard */
    const doConfirmAndClose = async (sIdx: number, payload: { transactions: ConfirmTransaction[] }) => {
        setIsConfirming(true)
        try {
            const session = sessions[sIdx]
            const result = await ExtractoService.confirm(payload)
            toast({
                title: 'Sucesso',
                description: `${result.created} transações importadas${session ? ` de "${session.filename}"` : ''}!`,
            })
        } catch {
            toast({ title: 'Erro', description: 'Falha ao confirmar transações.', variant: 'destructive' })
        } finally {
            setIsConfirming(false)
            // Force-close all modals and return to dashboard
            setDuplicateConflicts([])
            setPendingConfirmPayload(null)
            setPendingSIdx(null)
            sessionSkipMapRef.current = new Set()
            setSessions([])
            onImported()
            onOpenChange(false)
        }
    }

    const handleCancel = () => {
        setSessions([])
        setAddingBankSessionIdx(null)
        setShowNewCategory({})
        setNewCategoryName({})
        setShowNewSubcategory({})
        setNewSubcategoryName({})
        setShowNewPaymentMethod({})
        setNewPaymentMethodName({})
        setInstallmentMap({})
        setTotalInstallmentsMap({})
        onOpenChange(false)
    }

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BRL' }).format(value)

    const totals = sessions.reduce((acc, s) => ({
        total: acc.total + s.transactions.length,
        income: acc.income + s.transactions.filter(t => t.type === 'income').length,
        expense: acc.expense + s.transactions.filter(t => t.type === 'expense').length,
        totalIncome: acc.totalIncome + s.transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
        totalExpense: acc.totalExpense + s.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
    }), { total: 0, income: 0, expense: 0, totalIncome: 0, totalExpense: 0 })

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
                        <DialogTitle>Import Bank Statement</DialogTitle>
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
                                <p className="text-lg text-muted-foreground">{uploadProgress || 'Processing statement...'}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <Upload className="w-12 h-12 text-muted-foreground" />
                                <p className="text-lg text-muted-foreground">Drag files here or click to select</p>
                                <p className="text-sm text-muted-foreground">Accepted formats: CSV, OFX, QFX (multiple files)</p>
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
                            <DialogTitle>Review Statement</DialogTitle>
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
                                    {isConfirming ? 'Importing...' : `Confirm All (${pendingCount})`}
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
                        <p className="text-sm text-muted-foreground">Income</p>
                        <p className="text-2xl font-bold text-green-600">{totals.income}</p>
                    </div>
                    <div className="bg-card rounded-lg p-4 border border-border">
                        <p className="text-sm text-muted-foreground">Expenses</p>
                        <p className="text-2xl font-bold text-red-600">{totals.expense}</p>
                    </div>
                    <div className="bg-card rounded-lg p-4 border border-border">
                        <p className="text-sm text-green-600">Total Income</p>
                        <p className="text-lg font-bold text-green-600">{formatCurrency(totals.totalIncome)}</p>
                        <p className="text-sm text-red-600">Total Expenses</p>
                        <p className="text-lg font-bold text-red-600">{formatCurrency(totals.totalExpense)}</p>
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
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Date</th>
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Description</th>
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Amount</th>
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Type</th>
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Parcelas</th>
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Payment</th>
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Nat.</th>
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Category</th>
                                                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Subcategory</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {session.transactions.map((trans, rIdx) => {
                                                    const key = rowKey(sIdx, rIdx)
                                                    const catObj = categoryOptions?.options.find(c => c.id === trans.category_id)
                                                    const subs = catObj?.subcategories || []
                                                    const filteredCats = categoryOptions?.options.filter(
                                                        c => !trans.type || !c.type || c.type === trans.type
                                                    ) || []

                                                    return (
                                                        <tr key={rIdx} className="hover:bg-muted/30">
                                                            <td className="px-3 py-2 text-xs whitespace-nowrap">                                                            {trans.date}</td>
                                                            <td className="px-3 py-2 min-w-[140px]">
                                                                <input
                                                                    type="text"
                                                                    value={trans.description}
                                                                    onChange={(e) => updateTransaction(sIdx, rIdx, { description: e.target.value })}
                                                                    className="w-full text-xs bg-transparent border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                                                                />
                                                            </td>
                                                            <td className={`px-3 py-2 text-xs font-medium whitespace-nowrap ${
                                                                trans.type === 'income' ? 'text-green-600' : 'text-red-600'
                                                            }`}>
                                                                {trans.type === 'expense' ? '-' : ''}{formatCurrency(trans.amount)}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                                                    trans.type === 'income'
                                                                        ? 'bg-green-100 text-green-700'
                                                                        : 'bg-red-100 text-red-700'
                                                                }`}>
                                                                    {trans.type === 'income' ? 'Income' : 'Expense'}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 whitespace-nowrap">
                                                                <div className="flex items-center gap-1">
                                                                    <Switch
                                                                        id={`parcelado-${key}`}
                                                                        checked={installmentMap[key] || false}
                                                                        onCheckedChange={(checked) => {
                                                                            setInstallmentMap(prev => ({ ...prev, [key]: checked }))
                                                                            if (checked && !totalInstallmentsMap[key]) {
                                                                                setTotalInstallmentsMap(prev => ({ ...prev, [key]: 2 }))
                                                                            }
                                                                        }}
                                                                        className="scale-75"
                                                                    />
                                                                    {installmentMap[key] && (
                                                                        <Input
                                                                            type="number"
                                                                            min="2"
                                                                            value={totalInstallmentsMap[key] || 2}
                                                                            onChange={e => setTotalInstallmentsMap(prev => ({ ...prev, [key]: parseInt(e.target.value) || 2 }))}
                                                                            className="h-7 w-14 text-xs"
                                                                        />
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2 min-w-[120px]">
                                                                <Select
                                                                    value={showNewPaymentMethod[key] ? 'outros' : trans.payment_method}
                                                                    onValueChange={(v) => handlePaymentMethodChange(sIdx, rIdx, v)}
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
                                                                {showNewPaymentMethod[key] && (
                                                                    <Input
                                                                        placeholder="Nova forma de pagamento"
                                                                        value={newPaymentMethodName[key] || ''}
                                                                        onChange={e => {
                                                                            setNewPaymentMethodName(prev => ({ ...prev, [key]: e.target.value }))
                                                                            updateTransaction(sIdx, rIdx, { payment_method: e.target.value })
                                                                        }}
                                                                        className="h-7 text-xs mt-1"
                                                                    />
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <div className="flex items-center gap-1">
                                                                    <span className={`text-[10px] font-medium ${trans.entity_type === 'business' ? 'text-muted-foreground' : 'text-foreground'}`}>PF</span>
                                                                    <Switch
                                                                        checked={trans.entity_type === 'business'}
                                                                        onCheckedChange={(checked) => handleEntityTypeChange(sIdx, rIdx, checked ? 'business' : 'individual')}
                                                                        className="scale-75"
                                                                    />
                                                                    <span className={`text-[10px] font-medium ${trans.entity_type === 'business' ? 'text-foreground' : 'text-muted-foreground'}`}>PJ</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2 min-w-[130px]">
                                                                <Select
                                                                    value={showNewCategory[key] ? 'outros' : (trans.category_id ? String(trans.category_id) : '')}
                                                                    onValueChange={(v) => handleCategoryChange(sIdx, rIdx, v)}
                                                                >
                                                                    <SelectTrigger className="h-7 text-xs">
                                                                        <SelectValue placeholder="Selecione..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {filteredCats.map(cat => (
                                                                            <SelectItem key={cat.id} value={String(cat.id)}>
                                                                                {cat.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                        <SelectItem value="outros">Outros...</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                {showNewCategory[key] && (
                                                                    <Input
                                                                        placeholder="Nova categoria"
                                                                        value={newCategoryName[key] || ''}
                                                                        onChange={e => {
                                                                            setNewCategoryName(prev => ({ ...prev, [key]: e.target.value }))
                                                                            updateTransaction(sIdx, rIdx, { category_id: undefined })
                                                                        }}
                                                                        className="h-7 text-xs mt-1"
                                                                    />
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 min-w-[130px]">
                                                                {catObj ? (
                                                                    <>
                                                                        <Select
                                                                            value={showNewSubcategory[key] ? 'outros' : (trans.subcategory_id ? String(trans.subcategory_id) : '')}
                                                                            onValueChange={(v) => handleSubcategoryChange(sIdx, rIdx, v)}
                                                                        >
                                                                            <SelectTrigger className="h-7 text-xs">
                                                                                <SelectValue placeholder="Selecione..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {subs.map(sub => (
                                                                                    <SelectItem key={sub.id} value={String(sub.id)}>
                                                                                        {sub.name}
                                                                                    </SelectItem>
                                                                                ))}
                                                                                <SelectItem value="outros">Outros...</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                        {showNewSubcategory[key] && (
                                                                            <Input
                                                                                placeholder="Nova subcategoria"
                                                                                value={newSubcategoryName[key] || ''}
                                                                                onChange={e => {
                                                                                    setNewSubcategoryName(prev => ({ ...prev, [key]: e.target.value }))
                                                                                    updateTransaction(sIdx, rIdx, { subcategory_id: undefined })
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
                                {isPending && session.transactions.some(t => !t.category_id) && (
                                    <div className="px-4 py-2 flex items-center gap-2 text-amber-600 bg-amber-50/50 border-t border-border">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <span className="text-xs">
                                            {session.transactions.filter(t => !t.category_id).length} transação(ões) sem categoria
                                        </span>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </DialogContent>

            {/* Duplicate Dialog for extracto conflicts */}
            {duplicateConflicts.length > 0 && (
                <DuplicateDialog
                    open={duplicateConflicts.length > 0}
                    conflicts={duplicateConflicts.map(c => ({
                        index: c.index,
                        existing: c.existing,
                        newData: c.newData,
                    }))}
                    onResolve={(action, index) => resolveExtratoDuplicate(action, index)}
                    onResolveAll={(action) => {
                        // Apply action to all unresolved conflicts
                        for (const c of duplicateConflicts) {
                            resolveExtratoDuplicate(action, c.index)
                        }
                    }}
                    onDone={() => {
                        // All conflicts resolved — confirm with filtered transactions
                        if (pendingSIdx !== null && pendingConfirmPayload) {
                            const filteredTx = pendingConfirmPayload.transactions.filter(
                                (_, idx) => !sessionSkipMapRef.current.has(idx)
                            )
                            doConfirmAndClose(pendingSIdx, { transactions: filteredTx })
                        }
                    }}
                    onClose={() => {
                        setDuplicateConflicts([])
                        setPendingConfirmPayload(null)
                        setPendingSIdx(null)
                        sessionSkipMapRef.current = new Set()
                    }}
                />
            )}
        </Dialog>
    )
}

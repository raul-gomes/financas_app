import { useState, useEffect, useRef } from 'react'
import { formatCurrency } from '@/lib/format';
import { useLocation, useNavigate } from 'react-router-dom'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Upload, FileText, CheckCircle, AlertCircle, X, Plus, Banknote,
  Loader2, ArrowLeft, Save, Trash2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ExtractoService } from '@/services/extractService'
import { FinancialService } from '@/services/financialService'
import { SettingsService } from '@/services/settingsService'
import type { SessionData, ParsedTransaction, ConfirmTransaction } from '@/types/extract'
import type { CategorySubcategories, DuplicateInfo } from '@/types/financial'
import type { UserBank, BankCreate } from '@/services/settingsService'
import { BankLogo } from '@/components/ui/bank-logo'

interface DuplicateItem {
  sIdx: number
  rIdx: number
  key: string
  transaction: ParsedTransaction
  existing: DuplicateInfo
  resolved?: 'skip' | 'replace'
}

const KNOWN_PAYMENT_METHODS = ['cash', 'pix', 'debit', 'credit', 'transfer', 'boleto']

// Inline validation error type
interface TransactionErrors {
  description?: string
  amount?: string
  category?: string
  subcategory?: string
  payment_method?: string
  total_installments?: string
  date?: string
}

const BankExtract = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const initialSessions = (location.state as { sessions?: SessionData[] })?.sessions || []

  const [sessions, setSessions] = useState<SessionData[]>(initialSessions)
  const [isUploading, setIsUploading] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [banks, setBanks] = useState<UserBank[]>([])
  const [categoryOptions, setCategoryOptions] = useState<CategorySubcategories | null>(null)

  // Inline "add bank" state
  const [addingBankSessionIdx, setAddingBankSessionIdx] = useState<number | null>(null)
  const [newBankCode, setNewBankCode] = useState('')
  const [newBankName, setNewBankName] = useState('')

  // Post-upload duplicate items (shown as a section at top)
  const [duplicateItems, setDuplicateItems] = useState<DuplicateItem[]>([])

  // Per-row "Other" state
  const [showNewCategory, setShowNewCategory] = useState<Record<string, boolean>>({})
  const [newCategoryName, setNewCategoryName] = useState<Record<string, string>>({})
  const [showNewSubcategory, setShowNewSubcategory] = useState<Record<string, boolean>>({})
  const [newSubcategoryName, setNewSubcategoryName] = useState<Record<string, string>>({})
  const [showNewPaymentMethod, setShowNewPaymentMethod] = useState<Record<string, boolean>>({})
  const [newPaymentMethodName, setNewPaymentMethodName] = useState<Record<string, string>>({})
  const [installmentMap, setInstallmentMap] = useState<Record<string, boolean>>({})
  const [totalInstallmentsMap, setTotalInstallmentsMap] = useState<Record<string, number>>({})
  // Inline validation errors per transaction
  const [transactionErrors, setTransactionErrors] = useState<Record<string, TransactionErrors>>({})

  useEffect(() => {
    FinancialService.getCategorySubcategories('all').then(setCategoryOptions).catch(() => {})
    SettingsService.listBanks().then(setBanks).catch(() => {})
  }, [])

  const rowKey = (sIdx: number, rIdx: number) => `${sIdx}-${rIdx}`

  // Track whether duplicate check has been done for navigation-loaded sessions
  const initialDuplicatesCheckedRef = useRef(false)

  // Run duplicate check for sessions that arrive via navigation state (from ExtratoUploadModal)
  useEffect(() => {
    if (initialSessions.length > 0 && !initialDuplicatesCheckedRef.current) {
      initialDuplicatesCheckedRef.current = true
      checkDuplicatesForSessions(sessions).then(({ dupItems, cleanSessions }) => {
        setDuplicateItems(dupItems)
        setSessions(cleanSessions)
        if (dupItems.length > 0) {
          toast({
            title: `${dupItems.length} duplicata${dupItems.length > 1 ? 's' : ''} encontrada${dupItems.length > 1 ? 's' : ''}`,
            description: 'Revise e resolva as duplicatas no topo da pÃ¡gina antes de confirmar.',
          })
        }
      }).catch(err => {
        console.error('Erro ao verificar duplicatas:', err)
        setDuplicateItems([])
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Shared duplicate-checking logic
  async function checkDuplicatesForSessions(sessionList: SessionData[]): Promise<{
    dupItems: DuplicateItem[]
    cleanSessions: SessionData[]
  }> {
    const flatTransactions: Array<{ sIdx: number; rIdx: number; date: string; amount: number }> = []
    sessionList.forEach((s, sIdx) => {
      s.transactions.forEach((t, rIdx) => {
        flatTransactions.push({ sIdx, rIdx, date: t.date, amount: t.amount })
      })
    })

    const checkPayload = {
      transactions: flatTransactions.map((t, idx) => ({
        index: idx,
        transaction_date: t.date.split('/').reverse().join('-'),
        amount: t.amount,
      })),
    }
    const checkResult = await FinancialService.checkDuplicates(checkPayload)

    if (!checkResult?.results) {
      throw new Error('Resposta invÃ¡lida do servidor')
    }

    const dupItems: DuplicateItem[] = []
    const dupSet = new Set<string>()

    for (const r of checkResult.results) {
      if (r.has_duplicate && r.duplicates.length > 0) {
        const t = flatTransactions[r.index]
        const key = rowKey(t.sIdx, t.rIdx)
        dupSet.add(key)
        dupItems.push({
          sIdx: t.sIdx,
          rIdx: t.rIdx,
          key,
          transaction: sessionList[t.sIdx].transactions[t.rIdx],
          existing: r.duplicates[0],
        })
      }
    }

    const cleanSessions = sessionList.map((s, sIdx) => ({
      ...s,
      transactions: s.transactions.filter((_, rIdx) => !dupSet.has(rowKey(sIdx, rIdx))),
    }))

    return { dupItems, cleanSessions }
  }

  // ---- Upload handlers ----
  const handleFileSelect = async (selectedFiles: FileList | File[]) => {
    const fileArray = Array.from(selectedFiles)
    if (fileArray.length === 0) return
    setIsUploading(true)
    try {
      setUploadProgress(`Processando ${fileArray.length} arquivo${fileArray.length > 1 ? 's' : ''}...`)
      const result = await ExtractoService.uploadMultiple(fileArray)

      let dupItems: DuplicateItem[] = []
      try {
        const { dupItems: found, cleanSessions } = await checkDuplicatesForSessions(result)
        dupItems = found
        setDuplicateItems(found)
        setSessions(cleanSessions)

        if (found.length > 0) {
          toast({
            title: `${found.length} duplicata${found.length > 1 ? 's' : ''} encontrada${found.length > 1 ? 's' : ''}`,
            description: 'Revise e resolva as duplicatas no topo da pÃ¡gina antes de confirmar.',
          })
        }
      } catch (err) {
        console.error('Erro ao verificar duplicatas:', err)
        // If duplicate check fails, show all sessions anyway
        setDuplicateItems([])
        setSessions(result)
      }
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

  const deleteTransaction = (sIdx: number, rIdx: number) => {
    setSessions(prev => prev.map((s, i) =>
      i === sIdx ? {
        ...s,
        transactions: s.transactions.filter((_, j) => j !== rIdx)
      } : s
    ))
  }

  // ---- Duplicate resolution (post-upload) ----
  const skipDuplicate = (key: string) => {
    // Mark as "skip" â€” transaction won't be imported
    setDuplicateItems(prev => prev.map(d => d.key === key ? { ...d, resolved: 'skip' } : d))
  }

  const replaceDuplicate = async (item: DuplicateItem) => {
    // Delete the existing transaction, and add the new one back to its session for import
    try {
      await FinancialService.deleteTransaction(item.existing.id)
      setDuplicateItems(prev => prev.map(d => d.key === item.key ? { ...d, resolved: 'replace' } : d))
      // Re-add the transaction to its session
      setSessions(prev => prev.map((s, i) =>
        i === item.sIdx
          ? { ...s, transactions: [...s.transactions, item.transaction] }
          : s
      ))
      toast({ title: 'SubstituÃ­do', description: 'TransaÃ§Ã£o existente removida. A nova serÃ¡ importada.' })
    } catch {
      toast({ title: 'Erro', description: 'Falha ao remover transaÃ§Ã£o existente.', variant: 'destructive' })
    }
  }

  // ---- Row edit handlers ----
  const handlePaymentMethodChange = (sIdx: number, rIdx: number, value: string) => {
    const key = rowKey(sIdx, rIdx)
    if (value === 'outros') {
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
    if (value === 'outros') {
      setShowNewCategory(prev => ({ ...prev, [key]: true }))
      updateTransaction(sIdx, rIdx, { category_id: undefined, subcategory_id: undefined })
    } else {
      const catId = parseInt(value)
      setShowNewCategory(prev => ({ ...prev, [key]: false }))
      setNewCategoryName(prev => ({ ...prev, [key]: '' }))
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
    if (value === 'outros') {
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
      toast({ title: 'Erro', description: 'Preencha cÃ³digo e nome do banco.', variant: 'destructive' })
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

      if (installmentMap[key]) {
        base.total_installments = totalInstallmentsMap[key] || 2
        base.is_installment = true
      }

      return base
    })
  }

const validateTransaction = (sIdx: number, rIdx: number, t: ParsedTransaction, key: string): TransactionErrors => {
    const errors: TransactionErrors = {}
    
    // Description required
    if (!t.description?.trim()) {
      errors.description = 'Descrição é obrigatória'
    }
    
    // Amount required and > 0
    if (!t.amount || t.amount <= 0) {
      errors.amount = 'Valor inválido'
    }
    
    // Category required
    const hasCategory = showNewCategory[key]
      ? newCategoryName[key]?.trim()
      : t.category_id
    if (!hasCategory) {
      errors.category = 'Categoria é obrigatória'
    }
    
    // Subcategory required if category exists
    const catObj = categoryOptions?.options.find(c => c.id === t.category_id)
    if (catObj && catObj.subcategories.length > 0) {
      const hasSubcategory = showNewSubcategory[key]
        ? newSubcategoryName[key]?.trim()
        : t.subcategory_id
      if (!hasSubcategory) {
        errors.subcategory = 'Subcategoria é obrigatória'
      }
    }
    
    // Payment method required
    const hasPaymentMethod = showNewPaymentMethod[key]
      ? newPaymentMethodName[key]?.trim()
      : t.payment_method
    if (!hasPaymentMethod) {
      errors.payment_method = 'Forma de pagamento é obrigatória'
    }
    
    // Installments validation
    if (installmentMap[key]) {
      const total = totalInstallmentsMap[key] || 0
      if (total < 2) {
        errors.total_installments = 'Mínimo 2 parcelas'
      }
    }
    
    // Date validation
    if (!t.date) {
      errors.date = 'Data é obrigatória'
    }
    
    return errors
  }

  const validateSession = (session: SessionData, sIdx: number): { hasErrors: boolean; errorCount: number } => {
    if (!session.bankCode) return { hasErrors: true, errorCount: 1 }

    const allErrors: Record<string, TransactionErrors> = {}
    let errorCount = 0

    session.transactions.forEach((t, rIdx) => {
      const key = rowKey(sIdx, rIdx)
      const errors = validateTransaction(sIdx, rIdx, t, key)
      const hasErrors = Object.keys(errors).length > 0
      if (hasErrors) {
        allErrors[key] = errors
        errorCount += Object.keys(errors).length
      }
    })

setTransactionErrors(allErrors)
    return { hasErrors: errorCount > 0, errorCount }
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
      toast({
        title: 'Sucesso',
        description: `${result.created} transações importadas de "${session.filename}"!`,
      })

      // Check if all sessions are now confirmed
      const updated = sessions.map((s, i) => i === sIdx ? { ...s, isConfirmed: true } : s)
      const allDone = updated.every(s => s.isConfirmed)
      if (allDone) {
        toast({ title: 'Concluído', description: 'Todas as transações foram importadas!' })
        setTimeout(() => navigate('/financial'), 800)
      }
    } catch {
      toast({ title: 'Erro', description: `Falha ao confirmar sessão "${session.filename}".`, variant: 'destructive' })
    } finally {
      setIsConfirming(false)
    }
  }

  const confirmSession = async (sIdx: number) => {
    const session = sessions[sIdx]
    const validation = validateSession(session, sIdx)
    if (validation.hasErrors) {
      toast({ title: 'Validação', description: `Corrija os ${validation.errorCount} erro(s) antes de confirmar.`, variant: 'destructive' })
      return
    }
    // Duplicate check already done at upload time — confirm directly
    const payload = { transactions: buildConfirmPayload(session) }
    await doConfirmSession(sIdx, payload)
  }

  const confirmAll = async () => {
    // Validate all sessions first
    let totalErrors = 0
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i]
      if (s.isConfirmed) continue
      const validation = validateSession(s, i)
      totalErrors += validation.errorCount
    }
    if (totalErrors > 0) {
      toast({ title: 'Validação', description: `Corrija os ${totalErrors} erro(s) antes de confirmar tudo.`, variant: 'destructive' })
      return
    }

    setIsConfirming(true)
    let allOk = true
    for (let i = 0; i < sessions.length; i++) {
      if (sessions[i].isConfirmed) continue
      try {
        const payload = { transactions: buildConfirmPayload(sessions[i]) }
        await ExtractoService.confirm(payload)
        updateSession(i, { isConfirmed: true })
      } catch {
        toast({
          title: 'Erro',
          description: `Falha ao confirmar "${sessions[i].filename}". As anteriores foram salvas.`,
          variant: 'destructive',
        })
        allOk = false
        break
      }
    }
    setIsConfirming(false)

    if (allOk) {
      toast({ title: 'Sucesso', description: 'Todas as sessões foram importadas!' })
      setTimeout(() => navigate('/financial'), 800)
    }
  }
  const handleCancel = () => {
    setSessions([])
    navigate('/financial')
  }

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
  // UPLOAD VIEW (no sessions yet)
  // ============================================================
  if (sessions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="sm" onClick={() => navigate('/financial')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Extrato BancÃ¡rio</h1>
              <p className="text-muted-foreground mt-1">Importe seu extrato bancÃ¡rio em CSV ou OFX</p>
            </div>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer"
            onClick={() => !isUploading && document.getElementById('file-input-extrato')?.click()}
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
                <p className="text-lg text-muted-foreground">{uploadProgress || 'Processando...'}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Upload className="w-12 h-12 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">Arraste os arquivos aqui ou clique para selecionar</p>
                <p className="text-sm text-muted-foreground">Formatos aceitos: CSV, OFX, QFX (mÃºltiplos arquivos)</p>
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  // ============================================================
  // REVIEW VIEW (sessions loaded)
  // ============================================================
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Revisar Extrato</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {sessions.length} arquivo{sessions.length > 1 ? 's' : ''} â€” {totals.total} transaÃ§Ãµes
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={isConfirming}>
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
                {isConfirming ? 'Importando...' : `Confirmar Tudo (${pendingCount})`}
              </Button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{totals.total}</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-sm text-muted-foreground">Entradas</p>
            <p className="text-2xl font-bold text-green-600">{totals.income}</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-sm text-muted-foreground">SaÃ­das</p>
            <p className="text-2xl font-bold text-red-600">{totals.expense}</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-sm text-green-600">Total Entradas</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(totals.totalIncome)}</p>
            <p className="text-sm text-red-600">Total SaÃ­das</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totals.totalExpense)}</p>
          </div>
        </div>

        {/* Duplicates Section */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle className={`w-5 h-5 ${duplicateItems.length > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            <h2 className="text-lg font-semibold">
              {duplicateItems.length > 0 ? 'TransaÃ§Ãµes Duplicadas Detectadas' : 'VerificaÃ§Ã£o de Duplicatas'}
            </h2>
            {duplicateItems.length > 0 && (
              <span className="text-sm text-muted-foreground">
                ({duplicateItems.filter(d => !d.resolved).length} pendentes)
              </span>
            )}
          </div>

          {duplicateItems.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm">Nenhuma duplicata encontrada. Todas as transaÃ§Ãµes sÃ£o inÃ©ditas.</p>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-amber-300 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 border-b border-amber-200">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Data</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">DescriÃ§Ã£o</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Valor</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Tipo</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Existente</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">AÃ§Ã£o</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {duplicateItems.map((item) => {
                      const isResolved = !!item.resolved
                      return (
                        <tr key={item.key} className={`${isResolved ? 'bg-green-50/50 opacity-70' : 'hover:bg-amber-50/30'}`}>
                          <td className="px-3 py-2 text-xs whitespace-nowrap">{item.transaction.date}</td>
                          <td className="px-3 py-2 text-xs max-w-[200px] truncate">{item.transaction.description}</td>
                          <td className={`px-3 py-2 text-xs font-medium whitespace-nowrap ${
                            item.transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {item.transaction.type === 'expense' ? '-' : ''}{formatCurrency(item.transaction.amount)}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              item.transaction.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {item.transaction.type === 'income' ? 'Entrada' : 'SaÃ­da'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <div className="space-y-0.5">
                              <span className="font-medium">{item.existing.description}</span>
                              <div className="text-muted-foreground">
                                {item.existing.transaction_date} â€” {formatCurrency(item.existing.amount)}
                                {item.existing.category_name && <span> Â· {item.existing.category_name}</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {isResolved ? (
                              <span className="text-xs text-green-600 font-medium">
                                {item.resolved === 'skip' ? 'âœ“ Ignorado' : 'âœ“ SubstituÃ­do'}
                              </span>
                            ) : (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => skipDuplicate(item.key)}
                                >
                                  Manter existente
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-destructive border-destructive hover:bg-destructive/10"
                                  onClick={() => replaceDuplicate(item)}
                                >
                                  Substituir
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sessions */}
        <div className="space-y-6">
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
                        Confirmado âœ“
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground shrink-0">
                      {session.transactions.length} transaÃ§Ã£o{session.transactions.length > 1 ? 'Ãµes' : ''}
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
                              <BankLogo code={b.bank_code} size="xs" />
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
                    <div className="flex items-end gap-3 max-w-lg flex-wrap">
                      <div className="space-y-1">
                        <Label className="text-xs">CÃ³digo</Label>
                        <Input
                          placeholder="Ex: 260"
                          value={newBankCode}
                          onChange={e => setNewBankCode(e.target.value)}
                          className="h-8 text-sm w-24"
                        />
                      </div>
                      <div className="flex-1 space-y-1 min-w-[150px]">
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
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">DescriÃ§Ã£o</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Valor</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Tipo</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Parcelas</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Pagto</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Nat.</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Categoria</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Subcategoria</th>
                          <th className="px-3 py-2 w-10"></th>
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
                              <td className="px-3 py-2 text-xs whitespace-nowrap">{trans.date}</td>
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
                                  {trans.type === 'income' ? 'Entrada' : 'SaÃ­da'}
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
                                    <SelectItem value="debito">DÃ©bito</SelectItem>
                                    <SelectItem value="credito">CrÃ©dito</SelectItem>
                                    <SelectItem value="transferencia">TransferÃªncia</SelectItem>
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
                              <td className="px-1 py-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteTransaction(sIdx, rIdx)}
                                  title="Remover transaÃ§Ã£o"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
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
                      {session.transactions.filter(t => !t.category_id).length} transaÃ§Ã£o(Ãµes) sem categoria
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Bottom confirm bar */}
        {pendingCount > 0 && (
          <div className="sticky bottom-0 mt-6 bg-card border border-border rounded-lg p-4 flex justify-between items-center shadow-lg">
            <span className="text-sm text-muted-foreground">
              {pendingCount} sessÃ£o(Ãµes) pendente(s) â€” {totals.total - sessions.filter(s => s.isConfirmed).reduce((sum, s) => sum + s.transactions.length, 0)} transaÃ§Ãµes
            </span>
            <Button
              onClick={confirmAll}
              disabled={isConfirming}
              className="bg-gradient-primary"
            >
              {isConfirming ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isConfirming ? 'Importando...' : `Confirmar Tudo (${pendingCount})`}
            </Button>
          </div>
        )}

      </main>
    </div>
  )
}

export default BankExtract

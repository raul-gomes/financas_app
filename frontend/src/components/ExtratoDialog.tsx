import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ExtractoService } from '@/services/extractoService'
import { FinancialService } from '@/services/financialService'
import { UploadResponse, ParsedTransaction, ConfirmTransaction } from '@/types/extracto'
import { CategorySubcategories } from '@/types/financial'

interface ExtratoDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onImported: () => void
}

export function ExtratoDialog({ open, onOpenChange, onImported }: ExtratoDialogProps) {
    const [files, setFiles] = useState<File[]>([])
    const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null)
    const [transactions, setTransactions] = useState<ParsedTransaction[]>([])
    const [categoryOptions, setCategoryOptions] = useState<CategorySubcategories | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [isConfirming, setIsConfirming] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<string>('')
    const { toast } = useToast()

    useEffect(() => {
        if (open) {
            FinancialService.getCategorySubcategories('all').then(setCategoryOptions).catch(() => {})
        }
    }, [open])

    const handleFileSelect = async (selectedFiles: FileList | File[]) => {
        const fileArray = Array.from(selectedFiles)
        if (fileArray.length === 0) return
        setFiles(fileArray)
        setIsUploading(true)
        try {
            setUploadProgress(`Processando ${fileArray.length} arquivo${fileArray.length > 1 ? 's' : ''}...`)
            const { result, filenames } = await ExtractoService.uploadMultiple(fileArray)
            setUploadResult(result)
            setTransactions(result.transacoes.map(t => ({
                ...t,
                categoria_id: undefined,
                subcategoria_id: undefined,
                forma_pagamento: t.forma_pagamento || 'pix',
                natureza: t.natureza || 'pf'
            })))
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

    const handleDescricaoChange = (index: number, descricao: string) => {
        setTransactions(prev => prev.map((t, i) => i === index ? { ...t, descricao } : t))
    }

    const handleCategoryChange = (index: number, catId: number) => {
        const catObj = categoryOptions?.opcoes.find(c => c.id === catId)
        const subObj = catObj?.subcategorias[0]
        setTransactions(prev => prev.map((t, i) => i === index ? { ...t, categoria_id: catObj?.id, subcategoria_id: subObj?.id } : t))
    }

    const handleSubcategoryChange = (index: number, subId: number) => {
        setTransactions(prev => prev.map((t, i) => i === index ? { ...t, subcategoria_id: subId } : t))
    }

    const handleFormaPagamentoChange = (index: number, forma: string) => {
        setTransactions(prev => prev.map((t, i) => i === index ? { ...t, forma_pagamento: forma } : t))
    }

    const handleNaturezaChange = (index: number, natureza: string) => {
        setTransactions(prev => prev.map((t, i) => i === index ? { ...t, natureza } : t))
    }

    const handleConfirm = async () => {
        const unassigned = transactions.filter(t => !t.categoria_id || !t.subcategoria_id)
        if (unassigned.length > 0) {
            toast({ title: 'Atencao', description: `${unassigned.length} transacoes sem categoria. Atribua todas antes de confirmar.`, variant: 'destructive' })
            return
        }
        const invalidDesc = transactions.filter(t => !t.descricao || !t.descricao.trim())
        if (invalidDesc.length > 0) {
            toast({ title: 'Atencao', description: `${invalidDesc.length} transacoes com descricao vazia. Preencha todas antes de confirmar.`, variant: 'destructive' })
            return
        }
        const invalidValor = transactions.filter(t => !t.valor || t.valor <= 0)
        if (invalidValor.length > 0) {
            toast({ title: 'Atencao', description: `${invalidValor.length} transacoes com valor invalido.`, variant: 'destructive' })
            return
        }
        setIsConfirming(true)
        const confirmPayload: ConfirmTransaction[] = transactions.map(t => ({
            data: t.data, descricao: t.descricao, valor: t.valor, tipo: t.tipo,
            categoria_id: t.categoria_id!, subcategoria_id: t.subcategoria_id!,
            forma_pagamento: t.forma_pagamento || 'pix', natureza: t.natureza || 'pf',
        }))
        try {
            const result = await ExtractoService.confirm({ transacoes: confirmPayload })
            toast({ title: 'Sucesso', description: `${result.criadas} transacoes importadas!` })
            setFiles([])
            setUploadResult(null)
            setTransactions([])
            onImported()
            onOpenChange(false)
        } catch {
            toast({ title: 'Erro', description: 'Falha ao confirmar extrato.', variant: 'destructive' })
        } finally {
            setIsConfirming(false)
        }
    }

    const handleCancel = () => {
        setFiles([])
        setUploadResult(null)
        setTransactions([])
        onOpenChange(false)
    }

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

    if (!uploadResult) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Importar Extrato Bancario</DialogTitle>
                    </DialogHeader>
                    <div
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer"
                        onClick={() => document.getElementById('file-input-modal')?.click()}
                    >
                        <input
                            id="file-input-modal"
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
                                <p className="text-sm text-muted-foreground">Formatos aceitos: CSV, OFX, QFX (multiplos arquivos)</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl">
                <DialogHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <DialogTitle>Revisar Extrato</DialogTitle>
                            <p className="text-muted-foreground text-sm mt-1">{files.map(f => f.name).join(', ')} — {uploadResult.total} transacoes</p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" size="sm" onClick={handleCancel}>
                                <X className="w-4 h-4 mr-2" />Cancelar
                            </Button>
                            <Button onClick={handleConfirm} disabled={isConfirming} size="sm" className="bg-gradient-primary">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                {isConfirming ? 'Importando...' : `Confirmar ${uploadResult.total}`}
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="bg-card rounded-lg p-4 border border-border">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="text-2xl font-bold">{uploadResult.total}</p>
                    </div>
                    <div className="bg-card rounded-lg p-4 border border-border">
                        <p className="text-sm text-green-600">Entradas</p>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(uploadResult.total_entradas)}</p>
                    </div>
                    <div className="bg-card rounded-lg p-4 border border-border">
                        <p className="text-sm text-red-600">Saidas</p>
                        <p className="text-2xl font-bold text-red-600">{formatCurrency(uploadResult.total_saidas)}</p>
                    </div>
                </div>

                <div className="mt-4 max-h-[60vh] overflow-y-auto">
                    <div className="bg-card rounded-lg border border-border">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-b border-border">
                                <tr>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Data</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Descricao</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Valor</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Tipo</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Forma Pagamento</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Natureza</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Categoria</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Subcategoria</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {transactions.map((trans, index) => {
                                    const catObj = categoryOptions?.opcoes.find(c => c.id === trans.categoria_id)
                                    return (
                                        <tr key={index} className="hover:bg-muted/30">
                                            <td className="px-4 py-3 text-sm text-foreground">{trans.data}</td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={trans.descricao}
                                                    onChange={(e) => handleDescricaoChange(index, e.target.value)}
                                                    className="w-full text-sm bg-transparent border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                                                />
                                            </td>
                                            <td className={`px-4 py-3 text-sm font-medium ${trans.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                                                {trans.tipo === 'saida' ? '-' : ''}{formatCurrency(trans.valor)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    trans.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {trans.tipo === 'entrada' ? 'Entrada' : 'Saida'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Select value={trans.forma_pagamento} onValueChange={(v) => handleFormaPagamentoChange(index, v)}>
                                                    <SelectTrigger className="h-8 text-sm">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pix">PIX</SelectItem>
                                                        <SelectItem value="debito">Debito</SelectItem>
                                                        <SelectItem value="credito">Credito</SelectItem>
                                                        <SelectItem value="transferencia">Transferencia</SelectItem>
                                                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                                        <SelectItem value="boleto">Boleto</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Select value={trans.natureza} onValueChange={(v) => handleNaturezaChange(index, v)}>
                                                    <SelectTrigger className="h-8 text-sm">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pf">PF</SelectItem>
                                                        <SelectItem value="pj">PJ</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                            <td className="px-4 py-3">
                                                {catObj && catObj.categoria ? (
                                                    <span className="text-sm text-foreground">{catObj.categoria}</span>
                                                ) : (
                                                    <Select onValueChange={(v) => handleCategoryChange(index, parseInt(v))}>
                                                        <SelectTrigger className="h-8 text-sm">
                                                            <SelectValue placeholder="Selecionar..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {categoryOptions?.opcoes
                                                                .filter(cat => !trans.tipo || !cat.tipo || cat.tipo === trans.tipo)
                                                                .map(cat => (
                                                                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.categoria}</SelectItem>
                                                                ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {trans.subcategoria_id ? (
                                                    <span className="text-sm text-muted-foreground">
                                                        {catObj?.subcategorias.find(s => s.id === trans.subcategoria_id)?.nome}
                                                    </span>
                                                ) : catObj ? (
                                                    <Select onValueChange={(v) => handleSubcategoryChange(index, parseInt(v))}>
                                                        <SelectTrigger className="h-8 text-sm">
                                                            <SelectValue placeholder="Selecionar..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {catObj.subcategorias.map(sub => (
                                                                <SelectItem key={sub.id} value={String(sub.id)}>{sub.nome}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {transactions.some(t => !t.categoria_id || !t.subcategoria_id) && (
                        <div className="mt-4 flex items-center gap-2 text-amber-600">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm">
                                {transactions.filter(t => !t.categoria_id || !t.subcategoria_id).length} transacoes sem categoria atribuida
                            </span>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

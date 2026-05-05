import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
    const [file, setFile] = useState<File | null>(null)
    const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null)
    const [transactions, setTransactions] = useState<ParsedTransaction[]>([])
    const [categoryOptions, setCategoryOptions] = useState<CategorySubcategories | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [isConfirming, setIsConfirming] = useState(false)
    const { toast } = useToast()

    useEffect(() => {
        if (open) {
            FinancialService.getCategorySubcategories('all').then(setCategoryOptions).catch(() => {})
        }
    }, [open])

    const handleFileSelect = async (selectedFile: File) => {
        setFile(selectedFile)
        setIsUploading(true)
        try {
            const result = await ExtractoService.upload(selectedFile)
            setUploadResult(result)
            setTransactions(result.transacoes.map(t => ({ ...t, categoria_id: undefined, subcategoria_id: undefined })))
        } catch {
            toast({ title: 'Erro', description: 'Falha ao processar o extrato. Verifique o formato do arquivo.', variant: 'destructive' })
        } finally {
            setIsUploading(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const droppedFile = e.dataTransfer.files[0]
        if (droppedFile) handleFileSelect(droppedFile)
    }

    const handleCategoryChange = (index: number, categoria: string) => {
        const catObj = categoryOptions?.opcoes.find(c => c.categoria === categoria)
        const subObj = catObj?.subcategorias[0]
        setTransactions(prev => prev.map((t, i) => i === index ? { ...t, categoria_id: catObj?.id, subcategoria_id: subObj?.id } : t))
    }

    const handleSubcategoryChange = (index: number, subcategoria: string) => {
        const catId = transactions[index].categoria_id
        const subObj = categoryOptions?.opcoes.find(c => c.id === catId)?.subcategorias.find(s => s.nome === subcategoria)
        setTransactions(prev => prev.map((t, i) => i === index ? { ...t, subcategoria_id: subObj?.id } : t))
    }

    const handleConfirm = async () => {
        const unassigned = transactions.filter(t => !t.categoria_id || !t.subcategoria_id)
        if (unassigned.length > 0) {
            toast({ title: 'Atencao', description: `${unassigned.length} transacoes sem categoria. Atribua todas antes de confirmar.`, variant: 'destructive' })
            return
        }
        setIsConfirming(true)
        const confirmPayload: ConfirmTransaction[] = transactions.map(t => ({
            data: t.data, descricao: t.descricao, valor: t.valor, tipo: t.tipo,
            categoria_id: t.categoria_id!, subcategoria_id: t.subcategoria_id!,
            forma_pagamento: 'pix', natureza: 'pf',
        }))
        try {
            const result = await ExtractoService.confirm({ transacoes: confirmPayload })
            toast({ title: 'Sucesso', description: `${result.criadas} transacoes importadas!` })
            setFile(null)
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
        setFile(null)
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
                            className="hidden"
                            onChange={(e) => {
                                const selected = e.target.files?.[0]
                                if (selected) handleFileSelect(selected)
                            }}
                        />
                        {isUploading ? (
                            <div className="flex flex-col items-center gap-4">
                                <FileText className="w-12 h-12 text-muted-foreground animate-pulse" />
                                <p className="text-lg text-muted-foreground">Processando extrato...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <Upload className="w-12 h-12 text-muted-foreground" />
                                <p className="text-lg text-muted-foreground">Arraste o arquivo aqui ou clique para selecionar</p>
                                <p className="text-sm text-muted-foreground">Formatos aceitos: CSV, OFX, QFX</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <div>
                            <DialogTitle>Revisar Extrato</DialogTitle>
                            <p className="text-muted-foreground text-sm mt-1">{file?.name} — {uploadResult.total} transacoes</p>
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

                <div className="grid grid-cols-3 gap-4 flex-shrink-0">
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

                <div className="flex-1 overflow-y-auto min-h-0">
                    <div className="bg-card rounded-lg border border-border overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
                                <tr>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Data</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Descricao</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Valor</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Tipo</th>
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
                                            <td className="px-4 py-3 text-sm text-foreground max-w-xs truncate">{trans.descricao}</td>
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
                                                {catObj && catObj.categoria ? (
                                                    <span className="text-sm text-foreground">{catObj.categoria}</span>
                                                ) : (
                                                    <select
                                                        className="text-sm border border-border rounded px-2 py-1 bg-transparent"
                                                        value=""
                                                        onChange={(e) => handleCategoryChange(index, e.target.value)}
                                                    >
                                                        <option value="">Selecionar...</option>
                                                        {categoryOptions?.opcoes.map(cat => (
                                                            <option key={cat.id} value={cat.categoria}>{cat.categoria}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {trans.subcategoria_id ? (
                                                    <span className="text-sm text-muted-foreground">
                                                        {catObj?.subcategorias.find(s => s.id === trans.subcategoria_id)?.nome}
                                                    </span>
                                                ) : catObj ? (
                                                    <select
                                                        className="text-sm border border-border rounded px-2 py-1 bg-transparent"
                                                        value=""
                                                        onChange={(e) => handleSubcategoryChange(index, e.target.value)}
                                                    >
                                                        <option value="">Selecionar...</option>
                                                        {catObj.subcategorias.map(sub => (
                                                            <option key={sub.id} value={sub.nome}>{sub.nome}</option>
                                                        ))}
                                                    </select>
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

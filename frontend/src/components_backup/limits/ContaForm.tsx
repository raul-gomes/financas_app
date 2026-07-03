import { useEffect, useState } from 'react'
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { FinancialService } from '@/services/financialService'
import { ContaRecorrente, ContaRecorrenteCreate, ContaRecorrenteUpdate } from '@/types/recurring_account'
import { CategorySubcategories } from '@/types/financial'
import { SettingsService } from '@/services/settingsService'
import type { UserBank } from '@/services/settingsService'

const BANK_LOGO_CDN = 'https://cdn.jsdelivr.net/gh/ranulagu/bank-logos@main/bank-logos/256/png'

// ===== Shared Form =====
export const ContaForm = ({ conta, onClose, onSubmit }: {
    conta: ContaRecorrente | null
    onClose: () => void
    onSubmit: (payload: ContaRecorrenteCreate | ContaRecorrenteUpdate) => void
}) => {
    const [form, setForm] = useState({
        descricao: conta?.descricao || '',
        valor: conta?.valor?.toString() || '',
        dia_vencimento: conta?.dia_vencimento?.toString() || '1',
        natureza: conta?.natureza || 'pf' as 'pf' | 'pj',
        forma_pagamento: conta?.forma_pagamento || 'pix',
        bank_code: conta?.bank_code || '',
        data_inicio: conta?.data_inicio?.split('T')[0] || new Date().toISOString().split('T')[0],
        data_fim: conta?.data_fim?.split('T')[0] || '',
        categoria: conta?.categoria_nome || '',
        subcategoria: conta?.subcategoria_nome || '',
    })
    const [newCategory, setNewCategory] = useState('')
    const [newSubcategory, setNewSubcategory] = useState('')
    const [showNewCategoryInput, setShowNewCategoryInput] = useState(false)
    const [showNewSubcategoryInput, setShowNewSubcategoryInput] = useState(false)
    const [categoryOptions, setCategoryOptions] = useState<CategorySubcategories | null>(null)
    const [banks, setBanks] = useState<UserBank[]>([])
    const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set())
    const [addingNewBank, setAddingNewBank] = useState(false)
    const [newBankCode, setNewBankCode] = useState('')
    const [newBankName, setNewBankName] = useState('')
    const { toast } = useToast()

    useEffect(() => {
        SettingsService.listBanks().then(setBanks).catch(() => {})
    }, [])

    useEffect(() => {
        FinancialService.getCategorySubcategories(form.natureza, 'saida')
            .then(options => setCategoryOptions(options))
            .catch(() => {})
    }, [form.natureza])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.descricao || !form.valor) return

        const payload: any = {
            descricao: form.descricao,
            valor: parseFloat(form.valor),
            dia_vencimento: parseInt(form.dia_vencimento),
            natureza: form.natureza,
            forma_pagamento: form.forma_pagamento,
            bank_code: form.bank_code || undefined,
            data_inicio: form.data_inicio,
            data_fim: form.data_fim || undefined,
        }

        if (form.categoria && form.subcategoria) {
            const catObj = categoryOptions?.opcoes.find(c => c.categoria === form.categoria)
            const subObj = catObj?.subcategorias.find(s => s.nome === form.subcategoria)
            if (catObj && subObj) {
                payload.categoria_id = catObj.id
                payload.subcategoria_id = subObj.id
            } else {
                payload.categoria_nome = form.categoria
                payload.subcategoria_nome = form.subcategoria
            }
        }
        onSubmit(payload)
    }

    return (
        <Card className="border border-border">
            <CardHeader><CardTitle>{conta ? 'Editar Conta Recorrente' : 'Nova Conta Recorrente'}</CardTitle></CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Descricao</Label><Input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} required /></div>
                    <div className="space-y-2"><Label>Valor</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} required /></div>
                    <div className="space-y-2"><Label>Dia Vencimento</Label><Input type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => setForm({...form, dia_vencimento: e.target.value})} required /></div>
                    <div className="space-y-2">
                        <Label>Natureza</Label>
                        <Select value={form.natureza} onValueChange={v => {
                            setForm({...form, natureza: v as 'pf'|'pj', categoria: '', subcategoria: ''})
                            setShowNewCategoryInput(false)
                            setShowNewSubcategoryInput(false)
                        }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="pf">Pessoa Fisica</SelectItem><SelectItem value="pj">Pessoa Juridica</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Forma Pagamento</Label>
                        <Select value={form.forma_pagamento} onValueChange={v => setForm({...form, forma_pagamento: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pix">PIX</SelectItem><SelectItem value="debito">Debito</SelectItem><SelectItem value="credito">Credito</SelectItem>
                                <SelectItem value="boleto">Boleto</SelectItem><SelectItem value="transferencia">Transferencia</SelectItem><SelectItem value="dinheiro">Dinheiro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Banco</Label>
                        <Select
                            value={addingNewBank ? '+add' : form.bank_code}
                            onValueChange={value => {
                                if (value === '+add') {
                                    setAddingNewBank(true);
                                } else {
                                    setAddingNewBank(false);
                                    setForm({...form, bank_code: value});
                                }
                            }}
                        >
                            <SelectTrigger><SelectValue placeholder="Selecione um banco" /></SelectTrigger>
                            <SelectContent>
                                {banks.map(bank => (
                                    <SelectItem key={bank.id} value={bank.bank_code}>
                                        <div className="flex items-center gap-2">
                                            {!logoErrors.has(bank.bank_code) ? (
                                                <img
                                                    src={`${BANK_LOGO_CDN}/${bank.bank_code.padStart(3, '0')}.png`}
                                                    alt=""
                                                    className="w-5 h-5 rounded object-contain bg-card"
                                                    onError={() => setLogoErrors(prev => new Set(prev).add(bank.bank_code))}
                                                />
                                            ) : (
                                                <div className="w-5 h-5 rounded bg-primary/10 text-primary font-bold text-[8px] flex items-center justify-center">
                                                    {bank.bank_code}
                                                </div>
                                            )}
                                            <span>{bank.bank_name}</span>
                                            <span className="text-muted-foreground text-xs">({bank.bank_code})</span>
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
                        {addingNewBank && (
                            <div className="mt-2 flex items-end gap-2">
                                <div className="flex-1 space-y-1">
                                    <Label className="text-xs">Código</Label>
                                    <Input placeholder="Ex: 260" value={newBankCode} onChange={e => setNewBankCode(e.target.value)} className="h-8 text-sm" />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <Label className="text-xs">Nome</Label>
                                    <Input placeholder="Ex: Nubank" value={newBankName} onChange={e => setNewBankName(e.target.value)} className="h-8 text-sm" />
                                </div>
                                <Button size="sm" variant="outline" onClick={() => setAddingNewBank(false)}>Cancelar</Button>
                                <Button size="sm" onClick={async () => {
                                    if (!newBankCode.trim() || !newBankName.trim()) {
                                        toast({ title: 'Erro', description: 'Preencha código e nome do banco.', variant: 'destructive' });
                                        return;
                                    }
                                    try {
                                        const created = await SettingsService.addBank({
                                            bank_code: newBankCode.trim(),
                                            bank_name: newBankName.trim(),
                                        });
                                        setBanks(prev => [...prev, created]);
                                        setForm({...form, bank_code: created.bank_code});
                                        setAddingNewBank(false);
                                        toast({ title: 'Banco adicionado', description: `${created.bank_name} (${created.bank_code})` });
                                    } catch {
                                        toast({ title: 'Erro', description: 'Falha ao adicionar banco.', variant: 'destructive' });
                                    }
                                }}>
                                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                                </Button>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2"><Label>Data Inicio</Label><Input type="date" value={form.data_inicio} onChange={e => setForm({...form, data_inicio: e.target.value})} required /></div>
                    <div className="space-y-2"><Label>Data Fim (opcional)</Label><Input type="date" value={form.data_fim} onChange={e => setForm({...form, data_fim: e.target.value})} /></div>
                    <div className="space-y-2">
                        <Label>Categoria</Label>
                        <Select value={showNewCategoryInput ? 'outros' : form.categoria} onValueChange={v => {
                            if (v === 'outros') {
                                setShowNewCategoryInput(true)
                                setForm({...form, categoria: '', subcategoria: ''})
                            } else {
                                setShowNewCategoryInput(false)
                                setNewCategory('')
                                setForm({...form, categoria: v, subcategoria: ''})
                            }
                        }}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                                {categoryOptions?.opcoes.map(c => <SelectItem key={c.id} value={c.categoria}>{c.categoria}</SelectItem>)}
                                <SelectItem value="outros">Outros</SelectItem>
                            </SelectContent>
                        </Select>
                        {showNewCategoryInput && (
                            <div className="space-y-2 mt-2">
                                <Label>Nova Categoria</Label>
                                <Input placeholder="Digite a nova categoria" value={newCategory} onChange={e => {
                                    setNewCategory(e.target.value)
                                    setForm({...form, categoria: e.target.value.trim(), subcategoria: ''})
                                }} />
                            </div>
                        )}
                    </div>
                    {form.categoria && (
                        <div className="space-y-2">
                            <Label>Subcategoria</Label>
                            <Select value={showNewSubcategoryInput ? 'outros' : form.subcategoria} onValueChange={v => {
                                if (v === 'outros') {
                                    setShowNewSubcategoryInput(true)
                                    setForm({...form, subcategoria: ''})
                                } else {
                                    setShowNewSubcategoryInput(false)
                                    setNewSubcategory('')
                                    setForm({...form, subcategoria: v})
                                }
                            }}>
                                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                    {categoryOptions?.opcoes.find(c => c.categoria === form.categoria)?.subcategorias.map(s => (
                                        <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>
                                    ))}
                                    <SelectItem value="outros">Outros</SelectItem>
                                </SelectContent>
                            </Select>
                            {showNewSubcategoryInput && (
                                <div className="space-y-2 mt-2">
                                    <Label>Nova Subcategoria</Label>
                                    <Input placeholder="Digite a nova subcategoria" value={newSubcategory} onChange={e => {
                                        setNewSubcategory(e.target.value)
                                        setForm({...form, subcategoria: e.target.value.trim()})
                                    }} />
                                </div>
                            )}
                        </div>
                    )}
                    <div className="col-span-2 flex gap-2">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
                        <Button type="submit" className="flex-1 bg-gradient-primary">{conta ? 'Salvar' : 'Criar'}</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}

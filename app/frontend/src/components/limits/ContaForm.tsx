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
import { ContaRecorrente, ContaRecorrenteCreate, ContaRecorrenteUpdate } from '@/types/recurringAccount'
import { CategorySubcategories } from '@/types/financial'
import { SettingsService } from '@/services/settingsService'
import type { UserBank } from '@/services/settingsService'

const BANK_LOGO_CDN = 'https://cdn.jsdelivr.net/gh/wesguirra/brazil-bank-data@main/bank-logos/256/png'

// ===== Shared Form =====
export const ContaForm = ({ conta, onClose, onSubmit, defaultEntityType }: {
    conta: ContaRecorrente | null
    onClose: () => void
    onSubmit: (payload: ContaRecorrenteCreate | ContaRecorrenteUpdate) => void
    defaultEntityType?: 'individual' | 'business'
}) => {
    const [form, setForm] = useState({
        description: conta?.description || '',
        amount: conta?.amount?.toString() || '',
        due_day: conta?.due_day?.toString() || '1',
        entity_type: conta?.entity_type || defaultEntityType || 'individual' as 'individual' | 'business',
        payment_method: conta?.payment_method || 'pix',
        bank_code: conta?.bank_code || '',
        start_date: conta?.start_date?.split('T')[0] || new Date().toISOString().split('T')[0],
        end_date: conta?.end_date?.split('T')[0] || '',
        category_name: conta?.category_name || '',
        subcategory_name: conta?.subcategory_name || '',
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
        FinancialService.getCategorySubcategories(form.entity_type, 'expense')
            .then(options => setCategoryOptions(options))
            .catch(() => {})
    }, [form.entity_type])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.description || !form.amount) return

        const payload: any = {
            description: form.description,
            amount: parseFloat(form.amount),
            due_day: parseInt(form.due_day),
            entity_type: form.entity_type,
            payment_method: form.payment_method,
            bank_code: form.bank_code || undefined,
            start_date: form.start_date,
            end_date: form.end_date || undefined,
        }

        if (form.category_name && form.subcategory_name) {
            const catObj = categoryOptions?.options.find(c => c.name === form.category_name)
            const subObj = catObj?.subcategories.find(s => s.name === form.subcategory_name)
            if (catObj && subObj) {
                payload.category_id = catObj.id
                payload.subcategory_id = subObj.id
            } else {
                payload.category_name = form.category_name
                payload.subcategory_name = form.subcategory_name
            }
        }
        onSubmit(payload)
    }

    return (
        <Card className="border border-border">
            <CardHeader><CardTitle>{conta ? 'Edit Recurring Account' : 'New Recurring Account'}</CardTitle></CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} required /></div>
                    <div className="space-y-2"><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required /></div>
                    <div className="space-y-2"><Label>Due Day</Label><Input type="number" min="1" max="31" value={form.due_day} onChange={e => setForm({...form, due_day: e.target.value})} required /></div>
                    <div className="space-y-2">
                        <Label>Entity Type</Label>
                        <Select value={form.entity_type} onValueChange={v => {
                            setForm({...form, entity_type: v as 'individual'|'business', category_name: '', subcategory_name: ''})
                            setShowNewCategoryInput(false)
                            setShowNewSubcategoryInput(false)
                        }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="individual">Pessoa Fisica</SelectItem><SelectItem value="business">Pessoa Juridica</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <Select value={form.payment_method} onValueChange={v => setForm({...form, payment_method: v})}>
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
                                        <span>Add new bank</span>
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
                                <Button size="sm" variant="outline" onClick={() => setAddingNewBank(false)}>Cancel</Button>
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
                                    <Plus className="w-4 h-4 mr-1" /> Add
                                </Button>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} required /></div>
                    <div className="space-y-2"><Label>End Date (optional)</Label><Input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} /></div>
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={showNewCategoryInput ? 'outros' : form.category_name} onValueChange={v => {
                            if (v === 'outros') {
                                setShowNewCategoryInput(true)
                                setForm({...form, category_name: '', subcategory_name: ''})
                            } else {
                                setShowNewCategoryInput(false)
                                setNewCategory('')
                                setForm({...form, category_name: v, subcategory_name: ''})
                            }
                        }}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                                {categoryOptions?.options.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                                <SelectItem value="outros">Outros</SelectItem>
                            </SelectContent>
                        </Select>
                        {showNewCategoryInput && (
                            <div className="space-y-2 mt-2">
                                <Label>Nova Category</Label>
                                <Input placeholder="Type new category" value={newCategory} onChange={e => {
                                    setNewCategory(e.target.value)
                                    setForm({...form, category_name: e.target.value.trim(), subcategory_name: ''})
                                }} />
                            </div>
                        )}
                    </div>
                    {form.category_name && (
                        <div className="space-y-2">
                            <Label>Subcategory</Label>
                            <Select value={showNewSubcategoryInput ? 'outros' : form.subcategory_name} onValueChange={v => {
                                if (v === 'outros') {
                                    setShowNewSubcategoryInput(true)
                                    setForm({...form, subcategory_name: ''})
                                } else {
                                    setShowNewSubcategoryInput(false)
                                    setNewSubcategory('')
                                    setForm({...form, subcategory_name: v})
                                }
                            }}>
                                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                    {categoryOptions?.options.find(c => c.name === form.category_name)?.subcategories.map(s => (
                                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                    ))}
                                    <SelectItem value="outros">Outros</SelectItem>
                                </SelectContent>
                            </Select>
                            {showNewSubcategoryInput && (
                                <div className="space-y-2 mt-2">
                                    <Label>Nova Subcategory</Label>
                                    <Input placeholder="Type new subcategory" value={newSubcategory} onChange={e => {
                                        setNewSubcategory(e.target.value)
                                        setForm({...form, subcategory_name: e.target.value.trim()})
                                    }} />
                                </div>
                            )}
                        </div>
                    )}
                    <div className="col-span-2 flex gap-2">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
                        <Button type="submit" className="flex-1 bg-gradient-primary">{conta ? 'Save' : 'Create'}</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}

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
import { BankSelect } from '@/components/ui/bank-select'

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
    const { toast } = useToast()

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
                        <BankSelect
                            value={form.bank_code || undefined}
                            onValueChange={code => setForm(prev => ({ ...prev, bank_code: code ?? '' }))}
                        />
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

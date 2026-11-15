import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ExtractAddBankFormProps {
  onSubmit: (bankCode: string, bankName: string) => void;
  onCancel: () => void;
}

/** Inline form (code + name) to register a bank without leaving the review. */
export function ExtractAddBankForm({ onSubmit, onCancel }: ExtractAddBankFormProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="px-4 py-3 bg-white border-b border-border">
      <div className="flex items-end gap-3 max-w-lg flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">Código</Label>
          <Input placeholder="Ex: 260" value={code} onChange={(e) => setCode(e.target.value)} className="h-8 text-sm w-24" />
        </div>
        <div className="flex-1 space-y-1 min-w-[150px]">
          <Label className="text-xs">Nome</Label>
          <Input placeholder="Ex: Nubank" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
        </div>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" onClick={() => onSubmit(code, name)}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>
    </div>
  );
}

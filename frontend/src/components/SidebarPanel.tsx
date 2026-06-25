import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetasList } from './MetasList';
import { ComprasList } from './ComprasList';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface SidebarPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SidebarPanel({ open, onClose }: SidebarPanelProps) {
  const [mesRef] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  return (
    <div
      className={`h-full border-r border-border bg-card transition-all duration-300 overflow-hidden ${
        open ? 'w-[280px] opacity-100' : 'w-0 opacity-0'
      }`}
    >
      <div className="flex h-full w-[280px] flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Metas e Compras</h2>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs — key força remount ao abrir/fechar para dados frescos */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <Tabs key={String(open)} defaultValue="metas" className="w-full">
            <TabsList className="w-full mb-3">
              <TabsTrigger value="metas" className="flex-1 text-xs">Metas</TabsTrigger>
              <TabsTrigger value="compras" className="flex-1 text-xs">Compras</TabsTrigger>
            </TabsList>
            <TabsContent value="metas" className="mt-0">
              <MetasList mesRef={mesRef} />
            </TabsContent>
            <TabsContent value="compras" className="mt-0">
              <ComprasList mesRef={mesRef} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

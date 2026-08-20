import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetasList } from '@/components/MetasList';
import { ComprasList } from '@/components/ComprasList';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarPanelProps {
  open: boolean;
  onClose: () => void;
  entityType?: string;
}

export function SidebarPanel({ open, onClose, entityType }: SidebarPanelProps) {
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

        {/* Tabs — key força refetch ao abrir/fechar sidebar */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <Tabs defaultValue="metas" className="w-full">
            <TabsList className="w-full mb-3">
              <TabsTrigger value="metas" className="flex-1 text-xs">Metas</TabsTrigger>
              <TabsTrigger value="compras" className="flex-1 text-xs">Compras</TabsTrigger>
            </TabsList>
            <TabsContent value="metas" className="mt-0">
              <MetasList sidebarOpen={open} entityType={entityType} />
            </TabsContent>
            <TabsContent value="compras" className="mt-0">
              <ComprasList sidebarOpen={open} entityType={entityType} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

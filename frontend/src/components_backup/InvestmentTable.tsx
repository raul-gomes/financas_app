import { useState, useMemo } from 'react';
import { Investment } from '@/types/financial';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { AddInvestmentDialog } from '@/components/AddInvestmentDialog';
import { EditInvestmentDialog } from '@/components/EditInvestmentDialog';

interface InvestmentTableProps {
  investments: Investment[];
  onAddInvestment: (investment: Omit<Investment, 'id'>) => void;
  onEditInvestment: (id: string, investment: Omit<Investment, 'id'>) => void;
  onDeleteInvestment: (id: string) => void;
}

export const InvestmentTable = ({
  investments,
  onAddInvestment,
  onEditInvestment,
  onDeleteInvestment
}: InvestmentTableProps) => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    const sign = percentage >= 0 ? '+' : '';
    return `${sign}${percentage.toFixed(2)}%`;
  };

  // Filtrar investimentos por busca
  const filteredInvestments = useMemo(() => {
    return investments.filter(investment => 
      investment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      investment.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [investments, searchTerm]);

  const rendaVariavel = filteredInvestments.filter(inv => inv.type === 'variavel');
  const rendaFixa = filteredInvestments.filter(inv => inv.type === 'fixa');

  const InvestmentRow = ({ investment }: { investment: Investment }) => (
    <div className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{investment.name}</span>
          <Badge variant="secondary" className="text-xs">
            {investment.category}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Qtd: {investment.quantity}</span>
          <span>{formatCurrency(investment.currentPrice)}</span>
          <span className="font-medium">{formatCurrency(investment.totalValue)}</span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          {investment.profit >= 0 ? (
            <TrendingUp className="h-3 w-3 text-green-500" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-500" />
          )}
          <span className={`text-xs font-medium ${
            investment.profit >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            {formatCurrency(investment.profit)} ({formatPercentage(investment.profitPercentage)})
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setEditingInvestment(investment)}
        >
          <Edit className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onDeleteInvestment(investment.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-lg">Meus Investimentos</CardTitle>
          <Button 
            onClick={() => setShowAddDialog(true)}
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
        
        {/* Campo de Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar investimentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-6 pt-0">
        <Tabs defaultValue="variavel" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="variavel">Renda Variável</TabsTrigger>
            <TabsTrigger value="fixa">Renda Fixa</TabsTrigger>
          </TabsList>
          
          <TabsContent value="variavel" className="flex-1 overflow-hidden mt-0">
            <div className="h-full overflow-y-auto space-y-3 pr-2">
              {rendaVariavel.length > 0 ? (
                rendaVariavel.map((investment) => (
                  <InvestmentRow key={investment.id} investment={investment} />
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <p>Nenhum investimento de renda variável encontrado</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="fixa" className="flex-1 overflow-hidden mt-0">
            <div className="h-full overflow-y-auto space-y-3 pr-2">
              {rendaFixa.length > 0 ? (
                rendaFixa.map((investment) => (
                  <InvestmentRow key={investment.id} investment={investment} />
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <p>Nenhum investimento de renda fixa encontrado</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Dialogs */}
      <AddInvestmentDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdd={onAddInvestment}
      />
      
      {editingInvestment && (
        <EditInvestmentDialog
          open={!!editingInvestment}
          onOpenChange={() => setEditingInvestment(null)}
          investment={editingInvestment}
          onEdit={(updatedInvestment) => {
            onEditInvestment(editingInvestment.id, updatedInvestment);
            setEditingInvestment(null);
          }}
        />
      )}
    </Card>
  );
};
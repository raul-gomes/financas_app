import { useState } from 'react';
import { InvestmentDashboard } from '@/components/InvestmentDashboard';
import { InvestmentTable } from '@/components/InvestmentTable';
import { Investment } from '@/types/financial';
import { mockInvestments, mockPortfolioEvolution } from '@/data/mockData';
import { TrendingUp, DollarSign, ChevronDown, Settings } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const Investments = () => {
  const [investments, setInvestments] = useState<Investment[]>(mockInvestments);

  const handleAddInvestment = (newInvestment: Omit<Investment, 'id'>) => {
    const investment: Investment = {
      ...newInvestment,
      id: Date.now().toString()
    };
    setInvestments(prev => [...prev, investment]);
  };

  const handleEditInvestment = (id: string, updatedInvestment: Omit<Investment, 'id'>) => {
    setInvestments(prev => 
      prev.map(inv => inv.id === id ? { ...updatedInvestment, id } : inv)
    );
  };

  const handleDeleteInvestment = (id: string) => {
    setInvestments(prev => prev.filter(inv => inv.id !== id));
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-card shadow-elegant border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Investimentos</h1>
                <p className="text-sm text-muted-foreground">Acompanhamento da carteira de investimentos</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Menu
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/" className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Financeiro
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/investments" className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Investimentos
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Serviços
                    <span className="ml-auto text-xs text-muted-foreground">Em breve</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-[calc(100vh-200px)]">
          {/* Dashboard - 60% da tela (lado esquerdo) */}
          <div className="lg:col-span-3 animate-fade-in">
            <InvestmentDashboard
              investments={investments}
              portfolioEvolution={mockPortfolioEvolution}
            />
          </div>

          {/* Tabela de Investimentos - 40% da tela (lado direito) */}
          <div className="lg:col-span-2 animate-slide-up">
            <InvestmentTable
              investments={investments}
              onAddInvestment={handleAddInvestment}
              onEditInvestment={handleEditInvestment}
              onDeleteInvestment={handleDeleteInvestment}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Investments;
import { Link } from 'react-router-dom';
import { Card } from 'primereact/card';
import { Button } from '@/components/ui/button';
import { DollarSign, BarChart3, TrendingUp } from 'lucide-react';

export default function Index() {
  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold mb-8">Bem-vindo ao FinanceTracker</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {/* Cartão genérico sem navegação */}
        <Card className="shadow-card border-none p-6 flex flex-col items-center">
          <BarChart3 className="h-12 w-12 text-primary mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Visão Geral</h2>
          <p className="text-center text-muted-foreground mb-4">
            Informações gerais sobre o sistema.
          </p>
          <Button variant="secondary" disabled>
            Você está aqui
          </Button>
        </Card>

        {/* Cartão Financeiro */}
        <Card className="shadow-card border-none p-6 flex flex-col items-center">
          <DollarSign className="h-12 w-12 text-success mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Financeiro</h2>
          <p className="text-center text-muted-foreground mb-4">
            Controle de receitas, despesas e metas.
          </p>
          <Link to="/financial">
            <Button variant="outline">Acessar Financeiro</Button>
          </Link>
        </Card>

        {/* Cartão Investimentos */}
        <Card className="shadow-card border-none p-6 flex flex-col items-center">
          <TrendingUp className="h-12 w-12 text-accent mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Investimentos</h2>
          <p className="text-center text-muted-foreground mb-4">
            Acompanhamento da evolução da carteira.
          </p>
          <Link to="/investments">
            <Button variant="outline">Acessar Investimentos</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}

import { TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

const Investments = () => {
  return (
    <div className="min-h-screen bg-gradient-subtle px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <PageHeader icon={TrendingUp} title="Investimentos" description="Acompanhe seus ativos e carteira de investimentos" className="mb-8" />

        {/* Under construction card */}
        <Card className="shadow-card border-none">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="p-4 rounded-full bg-primary/10 mb-6">
              <TrendingUp className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Em construção
            </h2>
            <p className="text-muted-foreground text-center max-w-md">
              Esta página está sendo desenvolvida. Em breve você poderá gerenciar seus investimentos aqui.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Investments;

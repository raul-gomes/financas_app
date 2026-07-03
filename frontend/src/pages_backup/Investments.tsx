import { TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const Investments = () => {
  return (
    <div className="min-h-screen bg-gradient-subtle px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Investimentos</h1>
            <p className="text-muted-foreground">Acompanhe seus ativos e carteira de investimentos</p>
          </div>
        </div>

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

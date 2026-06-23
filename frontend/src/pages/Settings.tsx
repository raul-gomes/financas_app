import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Settings as SettingsIcon, DollarSign, Palette, Info } from 'lucide-react';

const Settings = () => {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
            <p className="text-sm text-muted-foreground">Preferências e informações do sistema</p>
          </div>
        </div>

        {/* General Settings */}
        <Card className="shadow-card border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4 text-primary" />
              Aparência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Tema</Label>
                <p className="text-xs text-muted-foreground">Alternar entre tema claro e escuro</p>
              </div>
              <span className="text-sm text-muted-foreground">Em breve</span>
            </div>
          </CardContent>
        </Card>

        {/* Financial Settings */}
        <Card className="shadow-card border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-primary" />
              Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Moeda padrão</Label>
                <p className="text-xs text-muted-foreground">BRL (R$) — definido pelo sistema</p>
              </div>
              <span className="text-sm font-medium">BRL</span>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card className="shadow-card border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-primary" />
              Sobre
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Versão</span>
              <span className="font-medium text-foreground">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>Framework</span>
              <span className="font-medium text-foreground">React + Vite</span>
            </div>
            <div className="flex justify-between">
              <span>Backend</span>
              <span className="font-medium text-foreground">FastAPI (Python)</span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;

import { useMemo, useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { FlippableChart } from '@/components/charts/FlippableChart';
import { IncomeChart } from '@/components/charts/IncomeChart';
import { CategoryBreakdownSection } from '@/components/CategoryBreakdownSection';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Send, CreditCard, Banknote, Receipt, type LucideIcon } from 'lucide-react';
import {
  YearlyData,
  DailyData,
  SelectedMonth,
  Transaction,
  CategoryBreakdown,
  IncomeBySubcategoria,
} from '@/types/financial';
import { SettingsService, UserBank } from '@/services/settingsService';
import { BankBreakdownModal, BankBreakdownItem } from '@/components/dialogs/BankBreakdownModal';

interface FinancialDashboardProps {
  yearlyData: YearlyData[];
  totalInvested: number;
  monthlyGoal: number;
  currentMonthExpenses: number;
  dateRange: { from: Date; to: Date };
  transactions: Transaction[];
  selectedMonth: SelectedMonth | null;
  highlightedMonth?: SelectedMonth | null;
  incomeBreakdown: IncomeBySubcategoria | null;
  categoryBreakdown: CategoryBreakdown | null;
  onMonthSelect?: (monthIndex: number, year: number) => void;
  onBackClick: () => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  creditCardLimit?: number;
  fixedExpenses?: number;
  variableExpenses?: number;
}

export function FinancialDashboard({
  yearlyData,
  totalInvested,
  monthlyGoal,
  currentMonthExpenses,
  dateRange,
  transactions,
  selectedMonth,
  highlightedMonth,
  incomeBreakdown,
  categoryBreakdown,
  onMonthSelect,
  onBackClick,
  onPrevMonth,
  onNextMonth,
  creditCardLimit = 0,
  fixedExpenses = 0,
  variableExpenses = 0,
}: FinancialDashboardProps) {
  const [banks, setBanks] = useState<UserBank[]>([]);
  const [breakdownModal, setBreakdownModal] = useState<{
    open: boolean;
    title: string;
    total: number;
    items: BankBreakdownItem[];
    icon: LucideIcon;
    theme: 'primary' | 'success' | 'destructive' | 'warning';
  } | null>(null);

  useEffect(() => {
    SettingsService.listBanks().then(setBanks).catch(() => {});
  }, []);

  const getBankName = (bankCode: string | null): string => {
    if (!bankCode) return '';
    return banks.find(b => b.bank_code === bankCode)?.bank_name || bankCode;
  };

  const buildBankBreakdown = (
    filterFn: (t: Transaction) => boolean,
    valueFn: (t: Transaction) => number = t => t.amount,
  ): BankBreakdownItem[] => {
    const groups = new Map<string, number>();
    transactions.filter(filterFn).forEach((t) => {
      if (!t.bank_code) return;
      groups.set(t.bank_code, (groups.get(t.bank_code) || 0) + valueFn(t));
    });
    return Array.from(groups.entries()).map(([code, amount]) => ({
      bank_code: code,
      bank_name: getBankName(code),
      amount,
    }));
  };

  const handleBarClick = (month: string, year?: number) => {
    const monthIndexMap: Record<string, number> = {
      'Jan': 0, 'Fev': 1, 'Mar': 2, 'Abr': 3, 'Mai': 4, 'Jun': 5,
      'Jul': 6, 'Ago': 7, 'Set': 8, 'Out': 9, 'Nov': 10, 'Dez': 11,
    };
    const monthIndex = monthIndexMap[month];
    if (monthIndex !== undefined && onMonthSelect) {
      onMonthSelect(monthIndex, year ?? new Date().getFullYear());
    }
  };

  // Compute daily data from transactions for the selected month
  const dailyData: DailyData[] = useMemo(() => {
    if (!selectedMonth) return [];
    const daysInMonth = new Date(selectedMonth.year, selectedMonth.index + 1, 0).getDate();
    const days: DailyData[] = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      income: 0,
      expenses: 0,
      investment: 0,
    }));

    transactions.forEach((t) => {
      const date = new Date(t.transaction_date);
      if (date.getMonth() === selectedMonth.index && date.getFullYear() === selectedMonth.year) {
        const dayIdx = date.getDate() - 1;
        if (t.type === 'income') days[dayIdx].income += t.amount;
        else if (t.type === 'expense') days[dayIdx].expenses += t.amount;
        else if (t.type === 'investment') days[dayIdx].investment += t.amount;
      }
    });

    return days;
  }, [transactions, selectedMonth]);

  const pixTotal = transactions
    .filter(t => t.type === 'expense' && t.payment_method === 'pix')
    .reduce((sum, t) => sum + t.amount, 0);

  const creditTotal = transactions
    .filter(t => t.type === 'expense' && t.payment_method === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const debitTotal = transactions
    .filter(t => t.type === 'expense' && t.payment_method === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);

  // Parcelas a Pagar — apenas saídas marcadas como parceladas
  const installmentItems = transactions.filter(
    t => t.type === 'expense' && t.is_installment === true
  );
  const totalParcelasRestantes = installmentItems.reduce(
    (sum, t) => sum + ((t.total_installments ?? 1) - (t.installment_number ?? 1)) * t.amount, 0
  );
  const countParcelasRestantes = installmentItems.reduce(
    (sum, t) => sum + ((t.total_installments ?? 1) - (t.installment_number ?? 1)), 0
  );

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto">
      {/* Métricas Principais - 4 cards uniformes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0">
        {/* Pix Card */}
        <div
          className="animate-slide-up h-full flex flex-col cursor-pointer"
          style={{ animationDelay: '0ms' }}
          onClick={() => {
            const items = buildBankBreakdown(t => t.type === 'expense' && t.payment_method === 'pix');
            if (items.length > 0) {
              setBreakdownModal({
                open: true,
                title: 'Pix',
                total: pixTotal,
                icon: Send,
                theme: 'primary',
                items,
              });
            }
          }}
        >
          <Card className="shadow-card border-none bg-primary/10 h-full hover:brightness-95 transition-all flex flex-col">
            <div className="p-4 flex flex-col h-full justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pix</p>
                  <p className="text-xl font-bold text-foreground">
                    <AnimatedNumber value={pixTotal} withDelay={100} />
                  </p>
                </div>
                <Send className="h-6 w-6 text-primary/70" />
              </div>
              <div className="h-4" /> {/* spacer for uniform height */}
            </div>
          </Card>
        </div>

        {/* Cartão de Crédito Card */}
        <div
          className="animate-slide-up h-full flex flex-col cursor-pointer"
          style={{ animationDelay: '100ms' }}
          onClick={() => {
            const items = buildBankBreakdown(t => t.type === 'expense' && t.payment_method === 'credit');
            if (items.length > 0) {
              setBreakdownModal({
                open: true,
                title: 'Cartão de Crédito',
                total: creditTotal,
                icon: CreditCard,
                theme: 'success',
                items,
              });
            }
          }}
        >
          <Card className="shadow-card border-none bg-success/10 h-full hover:brightness-95 transition-all flex flex-col">
            <div className="p-4 flex flex-col h-full justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Cartão de Crédito</p>
                  <p className="text-xl font-bold text-foreground">
                    <AnimatedNumber value={creditTotal} withDelay={250} />
                  </p>
                </div>
                <CreditCard className="h-6 w-6 text-success/70" />
              </div>
              {creditCardLimit > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{(creditTotal / creditCardLimit * 100).toFixed(0)}% usado</span>
                    <span>Limite: R$ {creditCardLimit.toLocaleString('en-US')}</span>
                  </div>
                  <div className="w-full bg-white/30 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        creditTotal > creditCardLimit
                          ? 'bg-destructive'
                          : creditTotal > creditCardLimit * 0.7
                          ? 'bg-warning'
                          : 'bg-success'
                      }`}
                      style={{ width: `${Math.min(100, (creditTotal / creditCardLimit) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Cartão de Débito Card */}
        <div
          className="animate-slide-up h-full flex flex-col cursor-pointer"
          style={{ animationDelay: '200ms' }}
          onClick={() => {
            const items = buildBankBreakdown(t => t.type === 'expense' && t.payment_method === 'debit');
            if (items.length > 0) {
              setBreakdownModal({
                open: true,
                title: 'Cartão de Débito',
                total: debitTotal,
                icon: Banknote,
                theme: 'destructive',
                items,
              });
            }
          }}
        >
          <Card className="shadow-card border-none bg-destructive/10 h-full hover:brightness-95 transition-all flex flex-col">
            <div className="p-4 flex flex-col h-full justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Cartão de Débito</p>
                  <p className="text-xl font-bold text-foreground">
                    <AnimatedNumber value={debitTotal} withDelay={400} />
                  </p>
                </div>
                <Banknote className="h-6 w-6 text-destructive/70" />
              </div>
              <div className="h-4" /> {/* spacer for uniform height */}
            </div>
          </Card>
        </div>

        {/* Parcelas a Pagar */}
        <div
          className="animate-slide-up h-full flex flex-col cursor-pointer"
          style={{ animationDelay: '300ms' }}
          onClick={() => {
            const groups = new Map<string, number>();
            installmentItems.forEach(t => {
              const amt = ((t.total_installments ?? 1) - (t.installment_number ?? 1)) * t.amount;
              const code = t.bank_code || 'sem-banco';
              groups.set(code, (groups.get(code) || 0) + amt);
            });
            const items = Array.from(groups.entries()).map(([code, amt]) => ({
              bank_code: code === 'sem-banco' ? '' : code,
              bank_name: code === 'sem-banco' ? 'Sem banco' : getBankName(code),
              amount: amt,
            }));
            if (items.length > 0) {
              setBreakdownModal({
                open: true,
                title: 'Parcelas a Pagar',
                total: totalParcelasRestantes,
                icon: Receipt,
                theme: 'warning',
                items,
              });
            }
          }}
        >
          <Card className="shadow-card border-none bg-warning/10 h-full hover:brightness-95 transition-all flex flex-col">
            <div className="p-4 flex flex-col h-full justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Parcelas a Pagar</p>
                  <p className="text-xl font-bold text-foreground">
                    <AnimatedNumber value={totalParcelasRestantes} withDelay={550} />
                  </p>
                  {countParcelasRestantes > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {countParcelasRestantes} parcela{countParcelasRestantes !== 1 ? 's' : ''} · {installmentItems.length} transação{installmentItems.length !== 1 ? 'ões' : ''}
                    </p>
                  )}
                </div>
                <Receipt className="h-6 w-6 text-warning/70" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Grafico de Barras - Rendimento Anual / Diario */}
      <div className="animate-slide-up shadow-card border-none rounded-lg bg-card flex-shrink-0" style={{ animationDelay: '400ms' }}>
        <div className="px-4 py-2 h-[400px] w-full">
          <FlippableChart
            yearlyData={yearlyData}
            dailyData={dailyData}
            monthlyGoal={monthlyGoal}
            selectedMonth={selectedMonth}
            highlightedMonth={highlightedMonth}
            onMonthClick={handleBarClick}
            onBackClick={onBackClick}
            onPrevMonth={onPrevMonth}
            onNextMonth={onNextMonth}
          />
        </div>
      </div>

      {/* Gastos Fixos vs Variáveis — logo abaixo do gráfico */}
      <div className="animate-slide-up" style={{ animationDelay: '600ms' }}>
        <Card className="shadow-card border-none flex-shrink-0">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Gastos Fixos vs Variáveis</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span className="text-success font-medium">Fixos: R$ {fixedExpenses.toLocaleString('en-US')}</span>
                <span className="text-warning font-medium">Variáveis: R$ {variableExpenses.toLocaleString('en-US')}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 flex overflow-hidden">
                <div
                  className="bg-success transition-all duration-700 ease-out"
                  style={{
                    width: `${fixedExpenses + variableExpenses > 0
                      ? (fixedExpenses / (fixedExpenses + variableExpenses)) * 100
                      : 0}%`
                  }}
                />
                <div
                  className="bg-warning transition-all duration-700 ease-out"
                  style={{
                    width: `${fixedExpenses + variableExpenses > 0
                      ? (variableExpenses / (fixedExpenses + variableExpenses)) * 100
                      : 0}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
      </div>

      {/* Income + Category charts in a 2-column grid */}
      <div className="animate-slide-up grid grid-cols-1 lg:grid-cols-2 gap-4 flex-shrink-0" style={{ animationDelay: '800ms' }}>
        <Card className="shadow-card border-none">
          <IncomeChart
            breakdown={incomeBreakdown}
            dateRange={dateRange}
          />
        </Card>
        <CategoryBreakdownSection
          categoryBreakdown={categoryBreakdown}
        />
      </div>

      {/* Bank Breakdown Modal */}
      {breakdownModal && (
        <BankBreakdownModal
          open={breakdownModal.open}
          onClose={() => setBreakdownModal(null)}
          title={breakdownModal.title}
          total={breakdownModal.total}
          icon={breakdownModal.icon}
          theme={breakdownModal.theme}
          items={breakdownModal.items}
        />
      )}
    </div>
  );
}

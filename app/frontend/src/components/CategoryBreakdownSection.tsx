import { useState, useEffect, useMemo } from 'react';
import { Card } from 'primereact/card';
import { AnimatedNumber } from './AnimatedNumber';
import { CategoryBreakdown, CategoryExpense } from '@/types/financial';
import { formatCurrency } from '@/lib/format';

interface CategoryBreakdownSectionProps {
  categoryBreakdown: CategoryBreakdown | null;
}

export function CategoryBreakdownSection({
  categoryBreakdown,
}: CategoryBreakdownSectionProps) {
  const [animateBars, setAnimateBars] = useState(false);

  // Trigger bar fill animation whenever category data changes
  useEffect(() => {
    setAnimateBars(false);
    const timer = setTimeout(() => setAnimateBars(true), 50);
    return () => clearTimeout(timer);
  }, [categoryBreakdown]);

  // Converter dados de categoria do payload para formato interno
  const dynamicCategoryExpenses: CategoryExpense[] = useMemo(() => {
    return categoryBreakdown?.categories
      ? categoryBreakdown.categories
          .map((category, idx) => {
            if (category.total <= 0) return null;

            const barMax = category.limit > 0 ? category.limit : category.total;
            const hue = (idx * 40) % 360;

            // Converte array subcategorias (obj[] tipo {name, amount}) em objeto Record<name, number>
            const subcategoriesMap: Record<string, number> = {};
            category.subcategories.forEach((sub) => {
              subcategoriesMap[sub.name] = parseFloat(sub.amount);
            });

            return {
              category: category.name,
              amount: category.total,
              percentage: barMax > 0 ? (category.total / barMax) * 100 : 0,
              color: `hsl(${hue}, 60%, 55%)`,
              subcategories: {
                ...subcategoriesMap,
                total: category.total,
                limite: barMax,
              },
            } as CategoryExpense;
          })
          .filter((item): item is CategoryExpense => item !== null)
      : [];
  }, [categoryBreakdown]);

  return (
    <Card className="shadow-card border-none h-full">
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-4">Gastos por Categoria</h3>
        {dynamicCategoryExpenses.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhum gasto registrado para o período selecionado.
          </p>
        ) : (
          <div className="space-y-4">
            {dynamicCategoryExpenses.map((category, idxCat) => (
              <div key={idxCat} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-sm"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="font-medium">{category.category}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      <AnimatedNumber
                        value={category.amount}
                        withDelay={100 + idxCat * 150}
                      />
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <AnimatedNumber
                        value={category.percentage}
                        duration={800}
                        format={(v) => v.toFixed(1)}
                        suffix="%"
                        withDelay={200 + idxCat * 150}
                      />
                    </p>
                  </div>
                </div>
                <div className="relative">
                  {category.subcategories &&
                    Object.entries(category.subcategories)
                      .filter(
                        ([sub, val]) =>
                          sub !== 'total' &&
                          sub !== 'limite' &&
                          (val as number) > 0
                      ).length > 0 ? (
                    <div className="flex h-3 rounded border border-border overflow-visible">
                      {Object.entries(category.subcategories)
                        .filter(
                          ([sub, val]) =>
                            sub !== 'total' &&
                            sub !== 'limite' &&
                            (val as number) > 0
                        )
                        .map(([subcat, amt], idxSub) => {
                          const amount = amt as number;
                          const widthPercent =
                            category.subcategories.limite > 0
                              ? (amount / category.subcategories.limite) * 100
                              : 0;
                          const hue = (idxSub * 60 + idxCat * 15) % 360;
                          const bgColor = `hsl(${hue},60%,55%)`;
                          return (
                            <div
                              key={subcat}
                              className="h-full relative group"
                              style={{
                                width: animateBars
                                  ? `${widthPercent}%`
                                  : '0%',
                                transition:
                                  'width 1s cubic-bezier(0.25, 0.1, 0.25, 1)',
                                backgroundColor: bgColor,
                              }}
                            >
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded shadow-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-auto max-w-[90vw]">
                                <div className="font-medium">{subcat}</div>
                                <div className="text-muted-foreground">
                                  {formatCurrency(amount)}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                      {/* Área Restante do Limite */}
                      {category.subcategories.limite > category.amount && (
                        <div
                          className="h-full bg-muted/30 relative group flex-1"
                          style={{
                            width: animateBars
                              ? `${Math.max(0, 100 - (category.amount / category.subcategories.limite * 100))}%`
                              : '0%',
                            transition:
                              'width 1s cubic-bezier(0.25, 0.1, 0.25, 1)',
                          }}
                        >
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded shadow-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-auto">
                            <div className="font-medium text-success">
                              Disponível
                            </div>
                            <div className="text-muted-foreground">
                              {formatCurrency(
                                category.subcategories.limite -
                                  category.amount
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-3 rounded bg-muted/30 overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{
                          width: animateBars
                            ? `${category.percentage}%`
                            : '0%',
                          transition:
                            'width 1s cubic-bezier(0.25, 0.1, 0.25, 1)',
                          backgroundColor: category.color,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
